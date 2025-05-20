FROM node:20-slim

# Install FFmpeg
RUN apt-get update && apt-get install -y ffmpeg && apt-get clean

# Create app directory
WORKDIR /app

# Copy files
COPY package*.json ./
COPY tsconfig.json ./
COPY ffmpeg-worker.ts ./

# Install dependencies
RUN npm install

# Start worker
CMD ["npm", "run", "start"]
