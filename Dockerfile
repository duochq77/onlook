# Dockerfile dùng cho worker không cần mở cổng
FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN npm run build

ENV PORT=8080
EXPOSE 8080

# ✅ Chạy dummy-server (gồm worker + HTTP server giả)
CMD ["node", "dist/src/dummy-server.js"]
