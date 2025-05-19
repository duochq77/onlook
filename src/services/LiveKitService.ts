import { connect, Room } from 'livekit-client'

/**
 * Kết nối đến phòng livestream của LiveKit với token từ API
 * @param roomName Tên phòng
 * @param identity Định danh người dùng
 * @param role 'subscriber' (xem) hoặc 'publisher' (bán)
 */
export async function connectToRoom(roomName: string, identity: string, role: string): Promise<Room> {
  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL!
  const tokenRes = await fetch(`/api/token?room=${roomName}&identity=${identity}&role=${role}`)
  const { token } = await tokenRes.json()
  const room = await connect(livekitUrl, token)
  return room
}
