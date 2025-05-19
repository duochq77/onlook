FROM node:18

# Cài ffmpeg
RUN apt-get update && apt-get install -y ffmpeg

# Tạo thư mục app
WORKDIR /app

# Copy package và cài thư viện (kèm dotenv)
COPY package*.json ./
RUN npm install --only=production

# Copy mã nguồn
COPY . .

# Copy .env.local vào image
COPY .env.local .env

# Biến môi trường
ENV NODE_ENV=production

# Build file TS sang JS nếu cần
RUN npx tsc -p tsconfig.worker.json

# Chạy worker có nạp dotenv
CMD ["node", "-r", "dotenv/config", "dist/worker/ffmpeg-worker.js"]
