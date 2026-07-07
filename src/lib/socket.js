import { io } from "socket.io-client";
import { API_BASE } from "./api";

let socket = null;
let identified = null; // sessionToken currently identified on the live socket

/**
 * Returns a connected + identified socket for this session token, creating
 * it on first call. The backend's "identify" event is the only auth step
 * (same x-session-token as REST — see socket.js on the backend), so we
 * only need to do it once per connection, not once per component.
 */
export function getSocket(sessionToken) {
  if (!socket) {
    socket = io(API_BASE, { autoConnect: true });
  }

  if (sessionToken && identified !== sessionToken) {
    socket.emit("identify", { sessionToken });
    identified = sessionToken;
  }

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  identified = null;
}
