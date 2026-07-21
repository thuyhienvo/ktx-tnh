package db

import "regexp"

// hasTxnControl phát hiện lệnh điều khiển transaction cấp cao trong file migration
// (BEGIN/COMMIT/ROLLBACK/END/SAVEPOINT/START TRANSACTION). Wrapper đã tự bọc BEGIN..COMMIT;
// file tự COMMIT/END sẽ đóng SỚM transaction -> half-apply. (server/db.js:82-91)
//
// Bản Node dùng regex có BACKREFERENCE \1 để khớp dollar-quote ($tag$..$tag$) — Go RE2 KHÔNG hỗ trợ,
// nên ở đây lược comment / dollar-quote / chuỗi bằng SCANNER TAY rồi mới dò từ khoá.
func hasTxnControl(sql string) bool {
	s := stripSQLNoise(sql)
	return reCommitEtc.MatchString(s) || reBegin.MatchString(s) || reEnd.MatchString(s)
}

var (
	reCommitEtc = regexp.MustCompile(`(?i)\b(?:commit|rollback|savepoint|start\s+transaction)\b`)
	reBegin     = regexp.MustCompile(`(?i)(?:^|;)\s*begin\b`)
	reEnd       = regexp.MustCompile(`(?i)(?:^|;)\s*end\b\s*(?:;|$)`)
)

func isIdentByte(b byte) bool {
	return b == '_' || (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') || (b >= '0' && b <= '9')
}

// stripSQLNoise thay block comment /*..*/, line comment --.., khối dollar-quote $tag$..$tag$,
// và chuỗi 'literal' bằng khoảng trắng — để KHÔNG báo nhầm BEGIN/END nằm trong DO/plpgsql hay chuỗi.
func stripSQLNoise(s string) string {
	var b []byte
	n := len(s)
	for i := 0; i < n; {
		// block comment
		if i+1 < n && s[i] == '/' && s[i+1] == '*' {
			j := i + 2
			for j+1 < n && !(s[j] == '*' && s[j+1] == '/') {
				j++
			}
			b = append(b, ' ')
			i = j + 2
			continue
		}
		// line comment
		if i+1 < n && s[i] == '-' && s[i+1] == '-' {
			j := i + 2
			for j < n && s[j] != '\n' {
				j++
			}
			b = append(b, ' ')
			i = j
			continue
		}
		// dollar-quote: $ [tag] $ ... $ [tag] $
		if s[i] == '$' {
			j := i + 1
			for j < n && isIdentByte(s[j]) {
				j++
			}
			if j < n && s[j] == '$' {
				tag := s[i : j+1] // gồm cả 2 dấu $
				k := j + 1
				found := -1
				for k+len(tag) <= n {
					if s[k:k+len(tag)] == tag {
						found = k
						break
					}
					k++
				}
				if found >= 0 {
					b = append(b, ' ')
					i = found + len(tag)
					continue
				}
			}
		}
		// chuỗi 'literal' (kể cả '' escape)
		if s[i] == '\'' {
			j := i + 1
			for j < n {
				if s[j] == '\'' {
					if j+1 < n && s[j+1] == '\'' {
						j += 2
						continue
					}
					j++
					break
				}
				j++
			}
			b = append(b, ' ')
			i = j
			continue
		}
		b = append(b, s[i])
		i++
	}
	return string(b)
}
