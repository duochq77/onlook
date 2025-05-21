const livekit = require('livekit-client');

// Khởi tạo kết nối và trả về room
export async function connectToRoom(serverUrl: string, token: string) {
  const room = new livekit.Room();
  await room.connect(serverUrl, token);
  return room;
}
