// utils/getGoogleToken.ts
import { GoogleAuth } from 'google-auth-library'

export async function getGoogleAccessToken(): Promise<string> {
    const raw = process.env.GOOGLE_SERVICE_ACCOUNT
    if (!raw) throw new Error('❌ Thiếu GOOGLE_SERVICE_ACCOUNT trong .env')

    const auth = new GoogleAuth({
        credentials: JSON.parse(raw),
        scopes: 'https://www.googleapis.com/auth/cloud-platform',
    })

    const client = await auth.getClient()
    const token = await client.getAccessToken()

    if (!token || !token.token) throw new Error('❌ Không lấy được token từ Google')
    return token.token
}
