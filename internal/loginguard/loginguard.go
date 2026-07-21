// Package loginguard — chống dò mật khẩu theo TÀI KHOẢN (không chỉ theo IP), lưu RAM.
// Port từ server/login-guard.js. Khác Node: Go đa luồng nên PHẢI có mutex (Node đơn luồng không cần).
package loginguard

import (
	"context"
	"encoding/json"
	"strings"
	"sync"

	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	MaxFail = 10                 // số lần sai liên tiếp trước khi khoá
	CuaSoMs = 15 * 60 * 1000     // đếm trong cửa sổ 15 phút
	KhoaMs  = 15 * 60 * 1000     // khoá 15 phút
)

type entry struct {
	fails   []int64 // mốc thời gian (ms) các lần sai
	khoaDen int64   // ms; > now nghĩa là đang khoá
}

type Guard struct {
	mu sync.Mutex
	m  map[string]*entry
}

func New() *Guard { return &Guard{m: map[string]*entry{}} }

func key(username string) string { return strings.ToLower(strings.TrimSpace(username)) }

func (g *Guard) donRac(now int64) {
	for k, v := range g.m {
		kept := v.fails[:0]
		for _, t := range v.fails {
			if now-t < CuaSoMs {
				kept = append(kept, t)
			}
		}
		v.fails = kept
		if len(v.fails) == 0 && (v.khoaDen == 0 || v.khoaDen < now) {
			delete(g.m, k)
		}
	}
}

// TruocKhiThu: gọi TRƯỚC khi thử mật khẩu. Trả (đang khoá?, số giây còn lại). server/login-guard.js:26-31
func (g *Guard) TruocKhiThu(username string, now int64) (bool, int) {
	g.mu.Lock()
	defer g.mu.Unlock()
	v := g.m[key(username)]
	if v != nil && v.khoaDen > now {
		conLai := int((v.khoaDen - now + 999) / 1000) // Math.ceil
		return true, conLai
	}
	return false, 0
}

// GhiNhanKetQua: gọi SAU khi thử. success -> xoá lịch sử; sai -> cộng 1, đủ ngưỡng thì khoá.
// Trả khoaMoi = true nếu vừa CHUYỂN sang trạng thái khoá. server/login-guard.js:34-46
func (g *Guard) GhiNhanKetQua(username string, success bool, now int64) bool {
	k := key(username)
	if k == "" {
		return false
	}
	g.mu.Lock()
	defer g.mu.Unlock()
	if success {
		delete(g.m, k)
		return false
	}
	v := g.m[k]
	if v == nil {
		v = &entry{}
	}
	kept := v.fails[:0]
	for _, t := range v.fails {
		if now-t < CuaSoMs {
			kept = append(kept, t)
		}
	}
	v.fails = append(kept, now)
	khoaMoi := false
	if len(v.fails) >= MaxFail {
		v.khoaDen = now + KhoaMs
		v.fails = nil
		khoaMoi = true
	}
	g.m[k] = v
	g.donRac(now)
	return khoaMoi
}

// LogEntry: dữ liệu ghi nhật ký đăng nhập.
type LogEntry struct {
	UserID   *int
	Username string
	Role     string
	IP       string
	UA       string
	KetQua   string
}

// GhiNhatKyDangNhap: ghi audit_log cho MỌI lần đăng nhập (kể cả thất bại). server/login-guard.js:56-65
// Nhật ký hỏng KHÔNG được chặn đăng nhập — chỉ log ra server.
func GhiNhatKyDangNhap(ctx context.Context, pool *pgxpool.Pool, e LogEntry) {
	ua := e.UA
	if len(ua) > 120 {
		ua = ua[:120]
	}
	detailBytes, _ := json.Marshal(map[string]string{"ip": e.IP, "ketQua": e.KetQua, "ua": ua})
	detail := string(detailBytes)
	if len(detail) > 460 {
		detail = detail[:460]
	}
	_, err := pool.Exec(ctx,
		"INSERT INTO audit_log (user_id, username, role, method, path, detail) VALUES ($1,$2,$3,$4,$5,$6)",
		e.UserID, e.Username, e.Role, "LOGIN", "/api/auth/login", detail)
	if err != nil {
		// không chặn đăng nhập; chỉ để lại dấu vết ở log server
		println("[login-guard] không ghi được nhật ký đăng nhập:", err.Error())
	}
}
