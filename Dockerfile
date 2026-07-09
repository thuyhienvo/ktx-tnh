# ---- Ứng dụng quản lý ký túc xá (Node + Express + PWA) ----
FROM node:20-alpine

WORKDIR /app

# Cài dependencies trước để tận dụng cache
COPY package.json ./
RUN npm install --omit=dev

# Copy mã nguồn
COPY server ./server
COPY public ./public

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server/index.js"]
