/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    swcMinify: true,
    // Cấu hình alias để đồng bộ với tsconfig.json
    webpack(config) {
        config.resolve.alias['@'] = require('path').resolve(__dirname, 'src');
        return config;
    }
};

module.exports = nextConfig;
