import fs from 'fs'
import path from 'path'

const secretPath = '/mnt/secrets-store' // dùng trong Cloud Run CSI hoặc Kubernetes CSI

function getEnv(key: string): string {
    const fromFile = path.join(secretPath, key)
    if (fs.existsSync(fromFile)) return fs.readFileSync(fromFile, 'utf8').trim()
    return process.env[key] || ''
}

export const R2_ACCESS_KEY_ID = getEnv('R2_ACCESS_KEY_ID')
export const R2_SECRET_ACCESS_KEY = getEnv('R2_SECRET_ACCESS_KEY')
export const R2_BUCKET_NAME = getEnv('R2_BUCKET_NAME')
export const R2_ACCOUNT_ID = getEnv('R2_ACCOUNT_ID')

export const LIVEKIT_API_KEY = getEnv('LIVEKIT_API_KEY')
export const LIVEKIT_API_SECRET = getEnv('LIVEKIT_API_SECRET')
export const LIVEKIT_URL = getEnv('LIVEKIT_URL')
