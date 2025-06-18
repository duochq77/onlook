#!/bin/bash

echo "🛠 Bắt đầu biên dịch TypeScript..."
npx tsc -p tsconfig.worker.json || { echo "❌ Lỗi biên dịch"; exit 1; }

echo "🐳 Đang build Docker image..."
docker build -t gcr.io/onlook-main/process-video-worker:latest -f Dockerfile.worker . || { echo "❌ Lỗi Docker build"; exit 1; }

echo "☁️ Đẩy Docker image lên Google Cloud Container Registry..."
docker push gcr.io/onlook-main/process-video-worker:latest || { echo "❌ Lỗi Docker push"; exit 1; }

echo "🚀 Triển khai lên Google Cloud Run..."
gcloud run deploy process-video-worker \
  --image gcr.io/onlook-main/process-video-worker:latest \
  --region asia-southeast1 \
  --project=onlook-main \
  --allow-unauthenticated || { echo "❌ Lỗi deploy Cloud Run"; exit 1; }

echo "✅ Hoàn tất triển khai!"
