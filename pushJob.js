const { Redis } = require('@upstash/redis');

const redis = new Redis({
    url: "https://clean-humpback-36746.upstash.io",
    token: "AY-KAAIncDExY2E1YWI2MDFmYzU0NzllOGRhMDhlMTYxNjhiYzA4NXAxMzY3NDY",
});

async function pushJob() {
    const job = JSON.stringify({ id: 1, task: "test-job" });
    await redis.lpush("onlook:process-video-queue", job);
    console.log("Job đã được đẩy vào queue");
}

pushJob();
