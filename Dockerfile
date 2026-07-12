# ---- Ứng dụng quản lý ký túc xá (Node + Express + PWA) ----
FROM node:20-alpine

WORKDIR /app

# Cài dependencies từ lockfile để build tái lập được (cùng artifact mọi nơi)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy mã nguồn
COPY server ./server
COPY public ./public

ENV PORT=3000
EXPOSE 3000

# Chạy bằng user không phải root
USER node

CMD ["node", "server/index.js"]
