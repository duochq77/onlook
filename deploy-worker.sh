#!/bin/bash

# === Thông tin dịch vụ ===
SERVICE_NAME=process-video-worker
PROJECT_ID=onlook-main
REGION=asia-southeast1
IMAGE=gcr.io/$PROJECT_ID/$SERVICE_NAME:latest

# === Biến môi trường ===
SUPABASE_URL=https://hlfhsozgnjxzwzqgjpbk.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhsZmhzb3pnbmp4end6cWdqcGJrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NTUwNDQ0NiwiZXhwIjoyMDYxMDgwNDQ2fQ.27RZjafzlHOiEPb6V8KhPjlWi-ViGiFw0HPLlFy1Fw8
SUPABASE_STORAGE_BUCKET=stream-files
UPSTASH_REDIS_REST_URL=https://clean-humpback-36746.upstash.io
UPSTASH_REDIS_REST_TOKEN=AY-KAAIncDE2Y2Q3ZjU5MDc3ZTU0YmU3OGM5NDBhN2VmMTNhYjIyNHAxMzY3NDY

# === Bước 1: Build TypeScript ===
echo "📦 Build TypeScript..."
npx tsc -p tsconfig.worker.json

# === Bước 2: Build Docker image ===
echo "🐳 Build Docker image..."
docker build -t $IMAGE -f Dockerfile.worker .

# === Bước 3: Push Docker image lên Google Container Registry ===
echo "🚀 Push image lên GCR..."
docker push $IMAGE

# === Bước 4: Triển khai lên Cloud Run ===
echo "🌐 Triển khai lên Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE \
  --project $PROJECT_ID \
  --region $REGION \
  --platform managed \
  --memory 1Gi \
  --cpu 1 \
  --timeout 300s \
  --allow-unauthenticated \
  --set-env-vars SUPABASE_URL=$SUPABASE_URL \
  --set-env-vars SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_ROLE_KEY \
  --set-env-vars SUPABASE_STORAGE_BUCKET=$SUPABASE_STORAGE_BUCKET \
  --set-env-vars UPSTASH_REDIS_REST_URL=$UPSTASH_REDIS_REST_URL \
  --set-env-vars UPSTASH_REDIS_REST_TOKEN=$UPSTASH_REDIS_REST_TOKEN

echo "✅ Đã deploy worker nền: $SERVICE_NAME"
