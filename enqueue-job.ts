import { Redis } from "@upstash/redis";

const redis = new Redis({
    url: "https://clean-humpback-36746.upstash.io",
    token: "AY-KAAIjcDE4MGM4Y2JjYzNmNGM0YjBhYjIwMGUwOGUwN2U0NTA5MHAxMA"
});

async function run() {
    // 🧹 Xoá queue cũ
    await redis.del("ffmpeg-jobs:clean");

    const job = {
        inputVideo: "uploads/demo-test/video.mp4",
        inputAudio: "uploads/demo-test/audio.mp3",
        outputName: "demo-test-output.mp4"
    };

    // 🧾 In ra job để xác minh
    console.log("Pushing job:", job);

    // ✅ Đẩy vào Redis dưới dạng JSON string
    const result = await redis.lpush("ffmpeg-jobs:clean", JSON.stringify(job));
    console.log("✅ Job pushed to Redis:", result);
}

run();
