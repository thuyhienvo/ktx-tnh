package handlers

import (
	"context"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
	"ktx/internal/sso"
)

// Handler SSO Microsoft (start/callback). Port từ server/routes/auth.routes.js:148-216 + sso.js.

// ssoRedirectURI: địa chỉ callback — ENV ép trước, else proto://host/api/auth/sso/callback. sso.js:47-51
func (h *Handlers) ssoRedirectURI(c *gin.Context) string {
	if v := os.Getenv("SSO_REDIRECT_URI"); strings.TrimSpace(v) != "" {
		return strings.TrimSpace(v)
	}
	proto := c.GetHeader("X-Forwarded-Proto")
	if proto == "" {
		if c.Request.TLS != nil {
			proto = "https"
		} else {
			proto = "http"
		}
	}
	proto = strings.TrimSpace(strings.Split(proto, ",")[0])
	return proto + "://" + c.Request.Host + "/api/auth/sso/callback"
}

func (h *Handlers) ssoClearCookie(c *gin.Context) {
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(sso.StateCookie, "", -1, "/api/auth/sso", "", h.Cfg.CookieSecure, true)
}

// SSOStart: GET /api/auth/sso/start -> 302 sang Microsoft. server/routes/auth.routes.js:148-160
func (h *Handlers) SSOStart(c *gin.Context) {
	urlStr, stateToken, err := h.SSO.BuildAuthRequest(c.Request.Context(), h.ssoRedirectURI(c))
	if err != nil {
		if he, ok := err.(*sso.HTTPError); ok && he.Status == 503 {
			c.String(http.StatusServiceUnavailable, "Đăng nhập Microsoft chưa được cấu hình.")
			return
		}
		serverErr(c)
		return
	}
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(sso.StateCookie, stateToken, sso.StateTTLSec, "/api/auth/sso", "", h.Cfg.CookieSecure, true)
	c.Redirect(http.StatusFound, urlStr)
}

type ssoUser struct {
	ID         int
	Username   string
	Role       string
	StudentID  *int
	TokenEpoch int
	Approved   bool
}

func (h *Handlers) ssoLoadUser(ctx context.Context, whereClause string, arg interface{}) *ssoUser {
	var u ssoUser
	err := h.pool().QueryRow(ctx,
		"SELECT id, username, role, student_id, token_epoch, approved FROM users WHERE "+whereClause+" AND deleted_at IS NULL",
		arg).Scan(&u.ID, &u.Username, &u.Role, &u.StudentID, &u.TokenEpoch, &u.Approved)
	if err != nil {
		return nil
	}
	return &u
}

// SSOCallback: GET /api/auth/sso/callback. server/routes/auth.routes.js:164-216
func (h *Handlers) SSOCallback(c *gin.Context) {
	ctx := c.Request.Context()
	veTrang := func(msg string) {
		h.ssoClearCookie(c)
		c.Redirect(http.StatusFound, "/?sso_error="+url.QueryEscape(msg))
	}
	if c.Query("error") != "" {
		veTrang("Microsoft từ chối yêu cầu đăng nhập.")
		return
	}
	if c.Query("code") == "" {
		veTrang("Thiếu mã đăng nhập từ Microsoft.")
		return
	}
	ssoCookie, _ := c.Cookie(sso.StateCookie)
	identity, err := h.SSO.ExchangeAndVerify(ctx, ssoCookie, c.Query("code"), c.Query("state"))
	if err != nil {
		msg := "Không xác thực được với Microsoft."
		if he, ok := err.(*sso.HTTPError); ok {
			msg = he.Msg
		}
		veTrang(msg)
		return
	}

	user, e := h.ssoResolveUser(ctx, identity)
	if e != nil {
		veTrang("Không tạo được tài khoản.")
		return
	}
	if user == nil {
		veTrang("Tài khoản không hợp lệ.")
		return
	}

	loginLog(h, c, &user.ID, user.Username, user.Role, "đăng nhập Microsoft")
	h.ssoClearCookie(c)
	// Cấp vé cho CẢ tài khoản đang chờ duyệt. Middleware pendingAllow chỉ cho tài khoản pending gọi
	// /me + /logout (mọi thứ khác 403), nên giao diện gọi được /me -> hiện màn "chờ duyệt"
	// (renderChoDuyet). Nếu KHÔNG cấp vé thì /me trả 401 "Chưa đăng nhập" -> người dùng bị bí, không
	// biết mình đã đăng nhập Microsoft xong và đang chờ duyệt.
	token, err := h.Auth.SignToken(user.ID, user.Username, user.Role, user.StudentID, user.TokenEpoch)
	if err != nil {
		veTrang("Lỗi cấp phiên.")
		return
	}
	h.Auth.SetAuthCookie(c, token)
	if !user.Approved {
		c.Redirect(http.StatusFound, "/?sso_pending=1")
		return
	}
	c.Redirect(http.StatusFound, "/")
}

// ssoResolveUser: từ danh tính Microsoft -> user trong CSDL. (1) khớp sso_subject; (2) khớp email ->
// liên kết; (3) chưa có -> tạo 'pending' chờ duyệt. Dùng chung cho callback (server-side) và verify (SPA).
func (h *Handlers) ssoResolveUser(ctx context.Context, identity sso.Identity) (*ssoUser, error) {
	if u := h.ssoLoadUser(ctx, "sso_subject = $1", identity.Subject); u != nil {
		return u, nil
	}
	if byEmail := h.ssoLoadUser(ctx, "lower(email) = lower($1)", identity.Email); byEmail != nil {
		_, _ = h.pool().Exec(ctx,
			`UPDATE users SET sso_subject = $1, auth_provider = CASE WHEN password_hash IS NULL THEN 'sso' ELSE 'both' END WHERE id = $2`,
			identity.Subject, byEmail.ID)
		return h.ssoLoadUser(ctx, "id = $1", byEmail.ID), nil
	}
	fullName := identity.FullName
	if fullName == "" {
		fullName = identity.Email
	}
	var newID int
	if e := h.pool().QueryRow(ctx,
		`INSERT INTO users (username, password_hash, role, full_name, email, sso_subject, auth_provider, approved)
		 VALUES ($1, NULL, 'pending', $2, $3, $4, 'sso', false) RETURNING id`,
		identity.Email, fullName, identity.Email, identity.Subject).Scan(&newID); e != nil {
		return nil, e
	}
	return h.ssoLoadUser(ctx, "id = $1", newID), nil
}

// SSOVerify: POST /api/auth/sso/verify {id_token} — LUỒNG SPA (không secret). Trình duyệt tự đổi mã ở
// Microsoft bằng PKCE rồi gửi id_token về đây; server KIỂM (JWKS) + tìm/tạo user + CẤP COOKIE PHIÊN
// ktx_token. Token Microsoft chỉ dùng MỘT LẦN để xác minh danh tính — mọi API sau đó dùng cookie của
// app (thu hồi/khoá tức thì qua token_epoch + đọc DB mỗi request), KHÔNG phụ thuộc hạn token Microsoft.
func (h *Handlers) SSOVerify(c *gin.Context) {
	ctx := c.Request.Context()
	var body struct {
		IDToken string `json:"id_token"`
	}
	if err := c.ShouldBindJSON(&body); err != nil || strings.TrimSpace(body.IDToken) == "" {
		badRequest(c, "Thiếu id_token")
		return
	}
	identity, err := h.SSO.VerifyIDToken(ctx, body.IDToken, "") // nonce đã kiểm phía trình duyệt
	if err != nil {
		if he, ok := err.(*sso.HTTPError); ok {
			c.JSON(he.Status, gin.H{"error": he.Msg})
			return
		}
		serverErr(c)
		return
	}
	user, e := h.ssoResolveUser(ctx, identity)
	if e != nil {
		serverErr(c)
		return
	}
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Tài khoản không hợp lệ."})
		return
	}
	loginLog(h, c, &user.ID, user.Username, user.Role, "đăng nhập Microsoft")
	token, err := h.Auth.SignToken(user.ID, user.Username, user.Role, user.StudentID, user.TokenEpoch)
	if err != nil {
		serverErr(c)
		return
	}
	h.Auth.SetAuthCookie(c, token) // cấp vé cho CẢ pending (pendingAllow cho /me + /logout)
	c.JSON(http.StatusOK, gin.H{"ok": true, "pending": !user.Approved})
}
