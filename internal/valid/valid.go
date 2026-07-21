// Package valid — kiểm tra hợp lệ input, port từ server/valid.js. Thuần, không phụ thuộc.
package valid

import (
	"regexp"
	"strconv"
	"strings"
	"time"
)

var (
	reYmd     = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)
	reMonth   = regexp.MustCompile(`^\d{4}-\d{2}$`)
	reNum     = regexp.MustCompile(`^-?\d+(\.\d+)?$`)
	reLetter  = regexp.MustCompile(`[a-zA-Z]`)
	reDigit   = regexp.MustCompile(`\d`)
	reEmail   = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]+$`)
	reNonDig  = regexp.MustCompile(`\D`)
	rePrivA   = regexp.MustCompile(`^127\.`)
	rePrivLL  = regexp.MustCompile(`^169\.254\.`)
	rePriv10  = regexp.MustCompile(`^10\.`)
	rePriv192 = regexp.MustCompile(`^192\.168\.`)
	rePriv172 = regexp.MustCompile(`^172\.(1[6-9]|2\d|3[01])\.`)
	rePrivV6U = regexp.MustCompile(`^(fc|fd)[0-9a-f]{2}:`)
	rePrivV6L = regexp.MustCompile(`^fe80:`)
)

// IsValidYmd: 'YYYY-MM-DD' phải là ngày có thật. server/valid.js:4-11
func IsValidYmd(s string) bool {
	if !reYmd.MatchString(s) {
		return false
	}
	y, _ := strconv.Atoi(s[0:4])
	m, _ := strconv.Atoi(s[5:7])
	d, _ := strconv.Atoi(s[8:10])
	if y < 1900 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31 {
		return false
	}
	dt := time.Date(y, time.Month(m), d, 0, 0, 0, 0, time.UTC)
	return dt.Year() == y && int(dt.Month()) == m && dt.Day() == d
}

// YmdOrNull: hợp lệ -> con trỏ chuỗi; không -> nil (lưu NULL). server/valid.js:13
func YmdOrNull(s string) *string {
	if IsValidYmd(s) {
		return &s
	}
	return nil
}

func Digits(s string) string { return reNonDig.ReplaceAllString(s, "") }

// IsValidPhone: 8–15 chữ số. server/valid.js:16
func IsValidPhone(s string) bool {
	d := Digits(s)
	return len(d) >= 8 && len(d) <= 15
}

// IsValidGender: chỉ 'male'|'female'. server/valid.js:23
func IsValidGender(s string) bool { return s == "male" || s == "female" }

// IsValidMonth: 'YYYY-MM', tháng 01..12. server/valid.js:26-31
func IsValidMonth(s string) bool {
	if !reMonth.MatchString(s) {
		return false
	}
	y, _ := strconv.Atoi(s[0:4])
	m, _ := strconv.Atoi(s[5:7])
	return y >= 1900 && y <= 2200 && m >= 1 && m <= 12
}

type settingRange struct{ min, max float64 }

// SettingNum: bảng min/max cho khoá settings số. server/valid.js:36-52
var SettingNum = map[string]settingRange{
	"room_fee": {0, 100000000}, "water_fee": {0, 100000000},
	"electric_unit": {0, 1000000}, "service_fee": {0, 100000000},
	"washing_fee": {0, 100000000}, "parking_fee": {0, 100000000}, "deposit_fee": {0, 100000000},
	"room_price_A": {0, 100000000}, "room_price_B": {0, 100000000},
	"room_price_C": {0, 100000000}, "room_price_D": {0, 100000000},
	"partial_half_min": {0, 31}, "partial_full_min": {0, 31},
	"due_day_from": {1, 31}, "due_day_to": {1, 31},
	"violation_mail_threshold": {1, 100}, "smtp_port": {1, 65535},
	"overdue_remind_days": {1, 365}, "shortterm_max_days": {1, 365},
	"deposit_notice_min_days": {0, 365}, "partial_half_factor": {0, 1},
	"room_cap_A": {1, 20}, "room_cap_B": {1, 20}, "room_cap_C": {1, 20}, "room_cap_D": {1, 20},
	"checkout_max_future_days": {1, 3650}, "max_cccd_mb": {1, 15},
}

// CheckSetting trả chuỗi lỗi nếu sai, "" nếu hợp lệ. server/valid.js:54-64
func CheckSetting(key, raw string) string {
	spec, ok := SettingNum[key]
	if !ok {
		return ""
	}
	s := strings.TrimSpace(raw)
	if s == "" || !reNum.MatchString(s) {
		return `"` + key + `" phải là số (đang nhận: "` + raw + `")`
	}
	n, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return `"` + key + `" phải là số`
	}
	if n < spec.min {
		return `"` + key + `" không được nhỏ hơn ` + trimFloat(spec.min) + ` (đang nhận: ` + trimFloat(n) + `)`
	}
	if n > spec.max {
		return `"` + key + `" không được lớn hơn ` + trimFloat(spec.max) + ` (đang nhận: ` + trimFloat(n) + `)`
	}
	return ""
}

func trimFloat(f float64) string { return strconv.FormatFloat(f, 'f', -1, 64) }

// CheckPassword: chính sách mật khẩu chung. server/valid.js:83-96
var matKhauPhoBien = map[string]bool{
	"12345678": true, "123456789": true, "1234567890": true, "password": true, "password1": true,
	"qwerty": true, "qwertyuiop": true, "abc12345": true, "11111111": true, "00000000": true,
	"iloveyou": true, "admin123": true, "esuhai123": true, "88888888": true, "12341234": true,
	"aa123456": true, "a1234567": true, "matkhau": true, "ktx12345": true,
}

func CheckPassword(pw string, context []string) string {
	s := pw
	if len(s) < 8 {
		return "Mật khẩu tối thiểu 8 ký tự"
	}
	if len(s) > 72 {
		return "Mật khẩu tối đa 72 ký tự"
	}
	if !reLetter.MatchString(s) || !reDigit.MatchString(s) {
		return "Mật khẩu cần có cả chữ và số"
	}
	low := strings.ToLower(s)
	if matKhauPhoBien[low] {
		return "Mật khẩu quá dễ đoán, vui lòng chọn mật khẩu khác"
	}
	if allSameRune(s) {
		return "Mật khẩu không được chỉ gồm một ký tự lặp lại"
	}
	for _, c := range context {
		cc := strings.ToLower(strings.TrimSpace(c))
		if len(cc) >= 3 && strings.Contains(low, cc) {
			return "Mật khẩu không được chứa tên đăng nhập hoặc tên của bạn"
		}
	}
	return ""
}

// allSameRune tương đương regex ^(.)\1+$ (JS backreference — Go RE2 không có).
func allSameRune(s string) bool {
	rs := []rune(s)
	if len(rs) < 2 {
		return false
	}
	for _, r := range rs[1:] {
		if r != rs[0] {
			return false
		}
	}
	return true
}

// IsValidEmail. server/valid.js:99-102
func IsValidEmail(s string) bool {
	s = strings.TrimSpace(s)
	return reEmail.MatchString(s) && len(s) <= 254
}

// IsPrivateHost: chặn SSRF. server/valid.js:107-119
func IsPrivateHost(host string) bool {
	h := strings.ToLower(strings.TrimSpace(host))
	h = strings.TrimPrefix(strings.TrimSuffix(h, "]"), "[")
	if h == "" {
		return true
	}
	if h == "localhost" || strings.HasSuffix(h, ".localhost") || h == "0.0.0.0" || h == "::" || h == "::1" {
		return true
	}
	return rePrivA.MatchString(h) || rePrivLL.MatchString(h) || rePriv10.MatchString(h) ||
		rePriv192.MatchString(h) || rePriv172.MatchString(h) || rePrivV6U.MatchString(h) || rePrivV6L.MatchString(h)
}

// IsValidPort: 1..65535. server/valid.js:122-125
func IsValidPort(p string) bool {
	n, err := strconv.Atoi(strings.TrimSpace(p))
	return err == nil && n >= 1 && n <= 65535
}

// NormalizeBool: "true"/"1"/"yes"/"on" -> true. server/valid.js:128-131
func NormalizeBool(v string) bool {
	s := strings.ToLower(strings.TrimSpace(v))
	return s == "true" || s == "1" || s == "yes" || s == "on"
}

// InitialPasswordMin: mật khẩu cấp nhanh cho HV (>=6, luôn kèm must_change_password). server/valid.js:147
const InitialPasswordMin = 6

// TooLongField: một cặp (khoá, trần độ dài) — giữ THỨ TỰ để báo lỗi giống Node (Object.entries).
type TooLongField struct {
	Key string
	Max int
}

// TooLong: chặn độ dài trường TEXT tự do. Trả chuỗi lỗi hoặc "". server/valid.js:135-142
// Dùng đếm rune (xấp xỉ .length UTF-16 của JS cho ký tự BMP tiếng Việt).
func TooLong(get func(string) (string, bool), limits []TooLongField) string {
	for _, f := range limits {
		v, ok := get(f.Key)
		if !ok {
			continue
		}
		n := len([]rune(v))
		if n > f.Max {
			return `Trường "` + f.Key + `" quá dài (tối đa ` + strconv.Itoa(f.Max) + ` ký tự, đang nhận ` + strconv.Itoa(n) + `)`
		}
	}
	return ""
}
