FROM node:18

# 🧰 Cài FFmpeg để dùng trong clean/merge
RUN apt-get update && apt-get install -y ffmpeg

# 📂 Tạo thư mục làm việc
WORKDIR /app

# 📦 Copy package & cài thư viện
COPY package*.json ./
RUN npm install --only=production

# 📄 Copy toàn bộ mã nguồn + file môi trường
COPY . .
COPY .env.local .env

# 🔧 Biến môi trường
ENV NODE_ENV=production

# 🛠 Build TypeScript (nếu chưa có sẵn dist/)
RUN npx tsc -p tsconfig.worker.json

# 🧠 Worker sẽ chạy từ biến môi trường WORKER_FILE
# ❗ Dùng shell form để biến $WORKER_FILE được expand
ENV WORKER_FILE=dist/worker/clean-video-worker.js
CMD sh -c "node -r dotenv/config $WORKER_FILE"
