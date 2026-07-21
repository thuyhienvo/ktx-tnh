package middleware

import "testing"

// BL-15: khoá rate-limit phải gộp IPv6 về /64 (xoay hậu tố trong dải KHÔNG ra khoá mới),
// còn IPv4 giữ nguyên từng địa chỉ.
func TestNormIP(t *testing.T) {
	cases := []struct{ in, want string }{
		// IPv4 giữ nguyên
		{"127.0.0.1", "127.0.0.1"},
		{"203.0.113.9", "203.0.113.9"},
		// IPv6 gộp /64
		{"2001:db8:abcd:1234:1:2:3:4", "2001:db8:abcd:1234::/64"},
		{"2001:db8:abcd:1234:ff:ee:dd:cc", "2001:db8:abcd:1234::/64"},
		// Không parse được -> nguyên chuỗi
		{"", ""},
		{"garbage", "garbage"},
	}
	for _, c := range cases {
		if got := normIP(c.in); got != c.want {
			t.Errorf("normIP(%q) = %q; muốn %q", c.in, got, c.want)
		}
	}

	// Hai địa chỉ IPv6 KHÁC hậu tố nhưng CÙNG /64 -> CÙNG khoá (không lách được).
	a := normIP("2001:db8:abcd:1234:aaaa:bbbb:cccc:dddd")
	b := normIP("2001:db8:abcd:1234:1111:2222:3333:4444")
	if a != b {
		t.Errorf("cùng /64 phải cùng khoá: %q vs %q", a, b)
	}
	// Khác /64 -> khoá khác.
	d := normIP("2001:db8:abcd:9999:1111:2222:3333:4444")
	if a == d {
		t.Errorf("khác /64 phải khác khoá: %q == %q", a, d)
	}
}
