# ---- Ứng dụng quản lý ký túc xá (Go + Gin + PWA) ----
# Multi-stage: build binary tĩnh rồi bỏ vào image tối giản.
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# Binary tĩnh (CGO tắt) — tzdata đã nhúng qua import _ "time/tzdata".
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/ktx ./cmd/server

FROM alpine:3.20
# ca-certificates: cần cho HTTPS tới Supabase Storage (S3) + IdP Microsoft.
RUN apk add --no-cache ca-certificates
WORKDIR /app
COPY --from=build /out/ktx /app/ktx
# Frontend tĩnh + schema/migrations (db.Init đọc lúc boot).
COPY public ./public
COPY server/schema.sql ./server/schema.sql
COPY server/migrations ./server/migrations

ENV PORT=3000
EXPOSE 3000
USER nobody
CMD ["/app/ktx"]
