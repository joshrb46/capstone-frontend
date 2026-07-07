import { io } from "socket.io-client";
import { API_BASE } from "./api";

let socket = null;
let identifiedToken = null; // sessionToken the live socket has *finished* identifying as
let identifyPromise = null; // in-flight identify() call, so concurrent callers share it

/**
 * Returns the shared socket connection, creating it on first call.
 * NOTE: this does NOT wait for "identify" to finish — use identifySocket()
 * before emitting anything the backend gates behind socket.data.userId
 * (lobby:join, chat:send, draw:stroke, match:join, etc.).
 */
export function getSocket() {
  if (!socket) {
    socket = io(API_BASE, { autoConnect: true });
  }
  return socket;
}

/**
 * Ensures the socket has completed the "identify" handshake for this
 * session token, and resolves with the socket once it has.
 *
 * The backend's "identify" handler is async (it awaits a DB lookup), so
 * emitting a dependent event like "lobby:join" right after "identify"
 * without waiting for it to actually finish is a race: the server can
 * process "lobby:join" before socket.data.userId is set, and reject it
 * with "Call 'identify' first." Always await this before those emits.
 */
export function identifySocket(sessionToken) {
  const sock = getSocket();

  if (identifiedToken === sessionToken && identifyPromise) {
    return identifyPromise;
  }

  identifiedToken = null;
  identifyPromise = new Promise((resolve, reject) => {
    sock.emit("identify", { sessionToken }, (ack) => {
      if (ack?.ok) {
        identifiedToken = sessionToken;
        resolve(sock);
      } else {
        identifyPromise = null;
        reject(new Error("Failed to identify socket session."));
      }
    });
  });

  return identifyPromise;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
  identifiedToken = null;
  identifyPromise = null;
}
