"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIVEKIT_URL = exports.LIVEKIT_API_SECRET = exports.LIVEKIT_API_KEY = exports.R2_ACCOUNT_ID = exports.R2_BUCKET_NAME = exports.R2_SECRET_ACCESS_KEY = exports.R2_ACCESS_KEY_ID = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const secretPath = '/mnt/secrets-store'; // dùng trong Cloud Run CSI hoặc Kubernetes CSI
function getEnv(key) {
    const fromFile = path_1.default.join(secretPath, key);
    if (fs_1.default.existsSync(fromFile))
        return fs_1.default.readFileSync(fromFile, 'utf8').trim();
    return process.env[key] || '';
}
exports.R2_ACCESS_KEY_ID = getEnv('R2_ACCESS_KEY_ID');
exports.R2_SECRET_ACCESS_KEY = getEnv('R2_SECRET_ACCESS_KEY');
exports.R2_BUCKET_NAME = getEnv('R2_BUCKET_NAME');
exports.R2_ACCOUNT_ID = getEnv('R2_ACCOUNT_ID');
exports.LIVEKIT_API_KEY = getEnv('LIVEKIT_API_KEY');
exports.LIVEKIT_API_SECRET = getEnv('LIVEKIT_API_SECRET');
exports.LIVEKIT_URL = getEnv('LIVEKIT_URL');
