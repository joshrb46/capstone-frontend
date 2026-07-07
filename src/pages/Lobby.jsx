import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import { getSocket } from "../lib/socket";
import styles from "./Lobby.module.css";

export default function Lobby() {
  const { code } = useParams();
  const { user, sessionToken } = useAuth();
  const navigate = useNavigate();

  const [lobby, setLobby] = useState(null);
  const [players, setPlayers] = useState([]);
  const [error, setError] = useState(null);
  const [starting, setStarting] = useState(false);

  const isHost = lobby && user && lobby.host_id === user.id;

  const loadLobby = useCallback(async () => {
    try {
      const data = await api.get(`/lobby/${code}`, sessionToken);
      const { players: playerList, ...lobbyRow } = data;
      setLobby(lobbyRow);
      setPlayers(playerList);
    } catch (e) {
      setError(e.message);
    }
  }, [code, sessionToken]);

  // Redirect to the landing page if we don't actually have a user yet
  // (e.g. someone opened a /lobby/:code link directly without registering).
  useEffect(() => {
    if (!user) navigate("/", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (user) loadLobby();
  }, [user, loadLobby]);

  useEffect(() => {
    if (!sessionToken) return;
    const socket = getSocket(sessionToken);

    socket.emit("lobby:join", { code });

    const onPlayers = (playerList) => setPlayers(playerList);
    const onMatchStarted = ({ matchId }) =>
      navigate(`/game/${code}/${matchId}`);
    const onError = (message) => setError(message);

    socket.on("lobby:players", onPlayers);
    socket.on("lobby:match_started", onMatchStarted);
    socket.on("error:lobby_join", onError);

    return () => {
      socket.off("lobby:players", onPlayers);
      socket.off("lobby:match_started", onMatchStarted);
      socket.off("error:lobby_join", onError);
    };
  }, [code, sessionToken, navigate]);

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      const match = await api.post(`/lobby/${code}/start`, {}, sessionToken);
      navigate(`/game/${code}/${match.id}`);
    } catch (e) {
      setError(e.message);
      setStarting(false);
    }
  }

  async function handleLeave() {
    try {
      await api.delete(`/lobby/${code}/players/me`, sessionToken);
    } catch {
      // ignore — we're leaving either way
    }
    navigate("/");
  }

  function renderAvatar(player) {
    if (player.avatar_type === "custom") {
      return (
        <img
          className={styles.sprite}
          src={player.avatar_value}
          alt={player.username}
        />
      );
    }
    return <span className={styles.sprite}>{player.avatar_value}</span>;
  }

  if (!lobby) {
    return (
      <div className={styles.lobbyPage}>
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          <p style={{ color: "#fff" }}>Loading lobby…</p>
        )}
      </div>
    );
  }

  const slots = [
    ...players,
    ...Array(Math.max(0, 6 - players.length)).fill(null),
  ];

  return (
    <div className={styles.lobbyPage}>
      <div className={styles.lobbyTitle}>Room code: {lobby.code}</div>

      {error && (
        <p role="alert" style={{ color: "#fff", marginBottom: 16 }}>
          {error}
        </p>
      )}

      <div className={styles.playersGrid}>
        {slots.map((player, i) =>
          player ? (
            <div className={styles.playerSlot} key={player.user_id}>
              <div className={styles.avatarWrap}>
                <div
                  className={`${styles.avatar} ${player.is_host ? styles.host : ""}`}
                >
                  {renderAvatar(player)}
                </div>
                {player.user_id === user.id && (
                  <button
                    className={styles.kickBtn}
                    onClick={handleLeave}
                    aria-label="Leave lobby"
                    type="button"
                  >
                    ✕
                  </button>
                )}
              </div>
              <div className={styles.playerName}>
                {player.username}
                {player.is_host ? " (host)" : ""}
              </div>
            </div>
          ) : (
            <div
              className={`${styles.playerSlot} ${styles.empty}`}
              key={`empty-${i}`}
            />
          ),
        )}
      </div>

      {isHost && (
        <button
          className={styles.playBtn}
          onClick={handleStart}
          disabled={starting || players.length < 2}
          title={players.length < 2 ? "Need at least 2 players to start" : ""}
          type="button"
        >
          {starting ? "Starting…" : "Start game"}
        </button>
      )}
    </div>
  );
}
