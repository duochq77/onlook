/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    env: {
        NEXT_PUBLIC_LIVEKIT_URL: process.env.NEXT_PUBLIC_LIVEKIT_URL,
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        SUPABASE_STORAGE_BUCKET: process.env.SUPABASE_STORAGE_BUCKET,
        LIVEKIT_API_KEY: process.env.LIVEKIT_API_KEY,
        LIVEKIT_API_SECRET: process.env.LIVEKIT_API_SECRET,
    },
    images: {
        domains: ['lh3.googleusercontent.com', 'cdn.livekit.io'],
    },
    experimental: {
        serverActions: true // Nếu bạn sử dụng Server Actions
    },
    swcMinify: false, // Bỏ swcMinify nếu không cần
};

export default nextConfig;
