package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// Nhóm path nhận ảnh base64 (CCCD/giới thiệu/PDF) -> body lớn 16MB. Còn lại 2MB. server/index.js:45-47
var bigBodyPrefixes = []string{"/api/public", "/api/students", "/api/applications", "/api/media", "/api/invoices", "/api/settings"}

const (
	bigLimit   = 16 << 20 // 16MB
	smallLimit = 2 << 20  // 2MB
)

// BodyLimit giới hạn kích thước body theo path (chống DoS). MaxBytesReader trả lỗi khi vượt ->
// handler bind lỗi -> tầng lỗi dịch 413.
func BodyLimit() gin.HandlerFunc {
	return func(c *gin.Context) {
		limit := int64(smallLimit)
		p := c.Request.URL.Path
		for _, pre := range bigBodyPrefixes {
			if strings.HasPrefix(p, pre) {
				limit = int64(bigLimit)
				break
			}
		}
		if c.Request.Body != nil {
			c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, limit)
		}
		c.Next()
	}
}
