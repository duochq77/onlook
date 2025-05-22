FROM node:18

# 🧰 Cài FFmpeg
RUN apt-get update && apt-get install -y ffmpeg

# 📂 Tạo thư mục chứa app
WORKDIR /app

# 📦 Copy package & cài lib
COPY package*.json ./
RUN npm install --only=production

# 📄 Copy mã nguồn
COPY . .

# 📄 Copy cấu hình môi trường
COPY .env.local .env

# 🔧 Biến môi trường
ENV NODE_ENV=production

# 🛠 Biên dịch TS nếu chưa có build sẵn
RUN npx tsc -p tsconfig.worker.json

# 🧠 Worker cần chạy được chọn qua biến: WORKER_FILE=dist/worker/clean-video-worker.js
ENV WORKER_FILE=dist/worker/clean-video-worker.js

# 🚀 Chạy worker tự động
CMD ["node", "-r", "dotenv/config", "$WORKER_FILE"]
