import { useState, useRef, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { getSocket } from "../lib/socket";
import styles from "./Chatbox.module.css";

export default function ChatBox({ matchId, roundId }) {
  const { user, sessionToken } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!sessionToken || !matchId) return;

    const socket = getSocket(sessionToken);
    socket.emit("match:join", { matchId });

    const onMessage = (msg) => setMessages((prev) => [...prev, msg]);
    socket.on("chat:message", onMessage);

    return () => {
      socket.emit("match:leave", { matchId });
      socket.off("chat:message", onMessage);
    };
  }, [sessionToken, matchId]);

  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed || !roundId || !sessionToken) return;

    getSocket(sessionToken).emit("chat:send", { roundId, message: trimmed });
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
          const isOwn = msg.user_id === user?.id;
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
