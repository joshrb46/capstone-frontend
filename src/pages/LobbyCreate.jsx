import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import styles from "./LobbyPage.module.css";

export default function LobbyCreate() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [roomCode, setRoomCode] = useState(null);
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState(null);

  // Create room on mount
  useEffect(() => {
    if (!user) {
      navigate("/");
      return;
    }

    async function createRoom() {
      try {
        const res = await fetch("/api/lobby", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userID: user.userID }),
        });
        if (!res.ok) throw new Error("Could not create room");
        const data = await res.json();
        // data = { roomCode, roomID }
        setRoomCode(data.roomCode);
        setPlayers([{ ...user, isHost: true, isYou: true }]);
      } catch (e) {
        setError(e.message);
      }
    }
    createRoom();
  }, [user, navigate]);

  // useEffect(() => { const ws = new WebSocket(`ws://.../room/${roomCode}`); ... }, [roomCode]);

  function startGame() {
    navigate(`/game/${roomCode}`);
  }

  if (error) {
    return (
      <div className={styles.lobbyPage}>
        <p>{error}</p>
        <button className={styles.playBtn} onClick={() => navigate("/")}>
          ← back
        </button>
      </div>
    );
  }

  const slots = [...players];
  while (slots.length < 6) slots.push(null);

  return (
    <div className={styles.lobbyPage}>
      <h1 className={styles.lobbyTitle}>
        {roomCode ? `Room Code: ${roomCode}` : "Lobby Page"}
      </h1>

      <div className={styles.playersGrid}>
        {slots.map((player, i) =>
          player ? (
            <div className={styles.playerSlot} key={player.userID ?? i}>
              <div
                className={`${styles.avatar} ${player.isHost ? styles.avatarHost : ""}`}
              >
                {player.icon ? (
                  <span
                    style={{
                      fontSize: "4rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                    }}
                  >
                    {player.icon}
                  </span>
                ) : (
                  <img
                    className={styles.sprite}
                    src={player.spriteUrl || ""}
                    alt=""
                  />
                )}
              </div>
              <span className={styles.playerName}>
                {player.isHost ? "Host" : player.username || "player"}
              </span>
            </div>
          ) : (
            <div
              className={`${styles.playerSlot} ${styles.playerSlotEmpty}`}
              key={`empty-${i}`}
            />
          ),
        )}
      </div>

      <button
        className={styles.playBtn}
        onClick={startGame}
        disabled={!roomCode}
      >
        Play
      </button>
    </div>
  );
}
