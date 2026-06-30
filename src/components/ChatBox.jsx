import { useState, useRef, useEffect } from "react";
import { io } from "socket.io-client";
import { jwtDecode } from "jwt-decode";
import { useAuth } from "../auth/AuthContext";
import styles from "./Chatbox.module.css";

const API = import.meta.env.VITE_API;

export default function ChatBox({ matchId, roundId }) {
  const { token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const currentUserId = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!token || !matchId) return;

    const decoded = jwtDecode(token);
    const userId = decoded.id ?? decoded.userId ?? decoded.sub;
    currentUserId.current = userId;

    const socket = io(API);
    socketRef.current = socket;

    socket.emit("identify", { userId });
    socket.emit("match:join", { matchId });

    socket.on("chat:message", (msg) => {
      setMessages((prev) => [...prev, msg]);
    });

    return () => {
      socket.emit("match:leave", { matchId });
      socket.disconnect();
    };
  }, [token, matchId]);

  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed || !roundId) return;

    socketRef.current?.emit("chat:send", { roundId, message: trimmed });
    setInput("");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span>Chat</span>
      </div>

      <div
        className={styles.messageList}
        role="log"
        aria-live="polite"
        aria-label="Game chat"
      >
        {messages.map((msg) => {
          const isOwn = msg.user_id === currentUserId.current;
          return (
            <div
              key={msg.id}
              className={isOwn ? styles.ownRow : styles.otherRow}
            >
              {!isOwn && (
                <span className={styles.userName}>{msg.username}</span>
              )}
              <div className={isOwn ? styles.ownBubble : styles.otherBubble}>
                {msg.message}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputRow}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your guess…"
          aria-label="Chat input"
          maxLength={80}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim()}
          aria-label="Send message"
        >
          Send
        </button>
      </div>
    </div>
  );
}
