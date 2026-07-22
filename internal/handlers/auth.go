package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	"golang.org/x/crypto/bcrypt"
	"ktx/internal/auth"
	"ktx/internal/loginguard"
	"ktx/internal/valid"
)

type loginUser struct {
	ID           int
	Username     string
	PasswordHash *string
	Role         string
	FullName     string
	StudentID    *int
	FacilityID   *int
	MustChange   bool
	TokenEpoch   int
	Approved     bool
	Email        *string
	AuthProvider *string
}

func (h *Handlers) loadLoginUser(c *gin.Context, username string) (*loginUser, error) {
	var u loginUser
	err := h.pool().QueryRow(c.Request.Context(),
		`SELECT id, username, password_hash, role, full_name, student_id, facility_id,
		        must_change_password, token_epoch, approved, email, auth_provider
		 FROM users WHERE lower(username) = lower($1) AND deleted_at IS NULL`, username).
		Scan(&u.ID, &u.Username, &u.PasswordHash, &u.Role, &u.FullName, &u.StudentID, &u.FacilityID,
			&u.MustChange, &u.TokenEpoch, &u.Approved, &u.Email, &u.AuthProvider)
	if err != nil {
		return nil, err
	}
	return &u, nil
}

// Login: POST /api/auth/login — xác thực + đặt cookie, KHÔNG trả token/user. server/routes/auth.routes.js:31-82
func (h *Handlers) Login(c *gin.Context) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	_ = c.ShouldBindJSON(&body) // field lạ (portal…) bị bỏ qua; body hỏng -> username rỗng -> 400 dưới
	username, password := body.Username, body.Password
	if username == "" || password == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Nhập tên đăng nhập và mật khẩu"})
		return
	}
	now := time.Now().UnixMilli()

	if khoa, conLai := h.Guard.TruocKhiThu(username, now); khoa {
		phut := (conLai + 59) / 60
		loginLog(h, c, nil, trimSpace(username), "", "bị khoá (đang trong thời gian khoá)")
		c.JSON(http.StatusTooManyRequests, gin.H{"error": fmt.Sprintf("Tài khoản tạm khoá do đăng nhập sai quá nhiều lần. Vui lòng thử lại sau %d phút.", phut)})
		return
	}

	user, err := h.loadLoginUser(c, trimSpace(username))
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Lỗi máy chủ"})
		return
	}

	// SSO thuần (không có mật khẩu) -> câu lỗi CHUNG với sai mật khẩu (không lộ tài khoản dùng SSO)
	if user != nil && user.PasswordHash == nil {
		h.Guard.GhiNhanKetQua(username, false, now)
		loginLog(h, c, &user.ID, user.Username, user.Role, "tài khoản chỉ đăng nhập bằng Microsoft (không có mật khẩu)")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Sai tên đăng nhập hoặc mật khẩu"})
		return
	}

	if user == nil || bcrypt.CompareHashAndPassword([]byte(*user.PasswordHash), []byte(password)) != nil {
		khoaMoi := h.Guard.GhiNhanKetQua(username, false, now)
		var uid *int
		var uname, urole string
		if user != nil {
			uid, uname, urole = &user.ID, user.Username, user.Role
		} else {
			uname = trimSpace(username)
		}
		ket := "SAI mật khẩu"
		if khoaMoi {
			ket = "SAI mật khẩu — vượt ngưỡng, KHOÁ tài khoản"
		}
		loginLog(h, c, uid, uname, urole, ket)
		if khoaMoi {
			c.JSON(http.StatusTooManyRequests, gin.H{"error": fmt.Sprintf("Đăng nhập sai quá nhiều lần. Tài khoản tạm khoá %d phút để bảo vệ.", loginguard.KhoaMs/60000)})
			return
		}
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Sai tên đăng nhập hoặc mật khẩu"})
		return
	}

	// Học viên đã bị xoá hồ sơ -> không cho đăng nhập
	if user.Role == "student" && user.StudentID != nil {
		var one int
		if h.pool().QueryRow(c.Request.Context(), "SELECT 1 FROM students WHERE id=$1 AND deleted_at IS NULL", *user.StudentID).Scan(&one) != nil {
			loginLog(h, c, &user.ID, user.Username, user.Role, "tài khoản học viên đã bị xoá hồ sơ")
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Tài khoản không còn hiệu lực"})
			return
		}
	}

	// SSO tự tạo, chưa duyệt
	if !user.Approved {
		h.Guard.GhiNhanKetQua(username, true, now)
		loginLog(h, c, &user.ID, user.Username, user.Role, "tài khoản chờ admin duyệt")
		c.JSON(http.StatusForbidden, gin.H{"error": "Tài khoản đang chờ quản trị viên duyệt. Vui lòng liên hệ ban quản lý."})
		return
	}

	h.Guard.GhiNhanKetQua(username, true, now)
	loginLog(h, c, &user.ID, user.Username, user.Role, "đăng nhập thành công")
	token, err := h.Auth.SignToken(user.ID, user.Username, user.Role, user.StudentID, user.TokenEpoch)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Lỗi máy chủ"})
		return
	}
	h.Auth.SetAuthCookie(c, token)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// Logout: POST /api/auth/logout — THU HỒI vé rồi xoá cookie. server/routes/auth.routes.js:86-93
func (h *Handlers) Logout(c *gin.Context) {
	if t := h.Auth.ReadToken(c); t != "" {
		if id, ok := h.Auth.TokenUserID(t); ok {
			_ = h.Auth.RevokeTokens(c.Request.Context(), id)
		}
	}
	h.Auth.ClearAuthCookie(c)
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// Me: GET /api/auth/me — thông tin người đang đăng nhập. server/routes/auth.routes.js:96-102
func (h *Handlers) Me(c *gin.Context) {
	u := auth.CurrentUser(c)
	var (
		id                  int
		username, role      string
		fullName            string
		studentID, facID    *int
		mustChange, approved bool
		email, authProvider *string
	)
	err := h.pool().QueryRow(c.Request.Context(),
		`SELECT id, username, role, full_name, student_id, facility_id, must_change_password, email, auth_provider, approved
		 FROM users WHERE id = $1`, u.ID).
		Scan(&id, &username, &role, &fullName, &studentID, &facID, &mustChange, &email, &authProvider, &approved)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Tài khoản không tồn tại"})
		return
	}
	c.JSON(http.StatusOK, publicUser(id, username, role, fullName, studentID, facID, mustChange, email, authProvider, approved))
}

// publicUser: shape /auth/me + /login từng trả. server/routes/auth.routes.js:13-23
func publicUser(id int, username, role, fullName string, studentID, facID *int, mustChange bool, email, authProvider *string, approved bool) gin.H {
	ap := "local"
	if authProvider != nil && *authProvider != "" {
		ap = *authProvider
	}
	var em interface{}
	if email != nil && *email != "" {
		em = *email
	}
	var fid interface{}
	if facID != nil {
		fid = *facID
	}
	var sid interface{}
	if studentID != nil {
		sid = *studentID
	}
	return gin.H{
		"id": id, "username": username, "role": role, "full_name": fullName,
		"student_id": sid, "must_change_password": mustChange,
		"facility_id": fid, "email": em, "auth_provider": ap, "approved": approved,
	}
}

// ChangePassword: POST /api/auth/change-password. server/routes/auth.routes.js:105-126
func (h *Handlers) ChangePassword(c *gin.Context) {
	u := auth.CurrentUser(c)
	var body struct {
		OldPassword string `json:"oldPassword"`
		NewPassword string `json:"newPassword"`
	}
	_ = c.ShouldBindJSON(&body)

	var username, fullName string
	var hash *string
	if err := h.pool().QueryRow(c.Request.Context(),
		"SELECT username, full_name, password_hash FROM users WHERE id = $1", u.ID).
		Scan(&username, &fullName, &hash); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Lỗi máy chủ"})
		return
	}
	if loiMk := valid.CheckPassword(body.NewPassword, []string{username, fullName}); loiMk != "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mật khẩu mới: " + lowerFirst(loiMk)})
		return
	}
	if hash == nil || bcrypt.CompareHashAndPassword([]byte(*hash), []byte(body.OldPassword)) != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mật khẩu hiện tại không đúng"})
		return
	}
	if bcrypt.CompareHashAndPassword([]byte(*hash), []byte(body.NewPassword)) == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Mật khẩu mới phải khác mật khẩu hiện tại"})
		return
	}
	newHash, err := bcrypt.GenerateFromPassword([]byte(body.NewPassword), 10)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Lỗi máy chủ"})
		return
	}
	if _, err := h.pool().Exec(c.Request.Context(),
		"UPDATE users SET password_hash = $1, must_change_password = false WHERE id = $2", string(newHash), u.ID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Lỗi máy chủ"})
		return
	}
	_ = h.Auth.RevokeTokens(c.Request.Context(), u.ID)

	var fid int
	var uname, role string
	var sid *int
	var epoch int
	if err := h.pool().QueryRow(c.Request.Context(),
		"SELECT id, username, role, student_id, token_epoch FROM users WHERE id=$1", u.ID).
		Scan(&fid, &uname, &role, &sid, &epoch); err == nil {
		if token, e := h.Auth.SignToken(fid, uname, role, sid, epoch); e == nil {
			h.Auth.SetAuthCookie(c, token)
		}
	}
	c.JSON(http.StatusOK, gin.H{"ok": true})
}

// SSOConfig: GET /api/auth/sso/config — chỉ trả {enabled}. server/routes/auth.routes.js:136-139
func (h *Handlers) SSOConfig(c *gin.Context) {
	cfg := h.SSO.Config(c.Request.Context())
	// tenantId + clientId KHÔNG bí mật (đằng nào cũng nằm trong URL uỷ quyền). Trình duyệt cần chúng để
	// tự dựng yêu cầu đăng nhập + đổi mã (luồng SPA, không secret). Chỉ trả khi đã bật.
	out := gin.H{"enabled": cfg.Enabled}
	if cfg.Enabled {
		out["tenantId"] = cfg.TenantID
		out["clientId"] = cfg.ClientID
	}
	c.JSON(http.StatusOK, out)
}

func trimSpace(s string) string {
	i, j := 0, len(s)
	for i < j && (s[i] == ' ' || s[i] == '\t' || s[i] == '\n' || s[i] == '\r') {
		i++
	}
	for j > i && (s[j-1] == ' ' || s[j-1] == '\t' || s[j-1] == '\n' || s[j-1] == '\r') {
		j--
	}
	return s[i:j]
}
