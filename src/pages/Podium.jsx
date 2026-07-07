import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import { getSocket, identifySocket } from "../lib/socket";
import styles from "./Podium.module.css";

const RANK_BLOCK_CLASS = {
  1: "podiumBlockFirst",
  2: "podiumBlockSecond",
  3: "podiumBlockThird",
};

export default function Podium() {
  const { code, matchId } = useParams();
  const { user, sessionToken } = useAuth();
  const navigate = useNavigate();

  const [match, setMatch] = useState(null);
  const [lobby, setLobby] = useState(null);
  const [error, setError] = useState(null);
  const [restarting, setRestarting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [matchData, lobbyData] = await Promise.all([
        api.get(`/matches/${matchId}`, sessionToken),
        api.get(`/lobby/${code}`, sessionToken),
      ]);
      setMatch(matchData);
      setLobby(lobbyData);
    } catch (e) {
      setError(e.message);
    }
  }, [matchId, code, sessionToken]);

  useEffect(() => {
    if (!user) navigate("/", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (user) loadData();
  }, [user, loadData]);

  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;
    const socket = getSocket();

    const onMatchStarted = ({ matchId: newMatchId }) =>
      navigate(`/game/${code}/${newMatchId}`);
    socket.on("lobby:match_started", onMatchStarted);

    identifySocket(sessionToken)
      .then(() => {
        if (cancelled) return;
        socket.emit("match:join", { matchId });
        socket.emit("lobby:join", { code });
      })
      .catch((e) => setError(e.message));

    return () => {
      cancelled = true;
      socket.emit("match:leave", { matchId });
      socket.off("lobby:match_started", onMatchStarted);
    };
  }, [matchId, code, sessionToken, navigate]);

  async function handlePlayAgain() {
    setRestarting(true);
    setError(null);
    try {
      const newMatch = await api.post(`/lobby/${code}/start`, {}, sessionToken);
      navigate(`/game/${code}/${newMatch.id}`);
    } catch (e) {
      setError(e.message);
      setRestarting(false);
    }
  }

  if (!match || !lobby) {
    return (
      <div className={styles.resultsCard}>
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          <p style={{ color: "#fff" }}>Loading results…</p>
        )}
      </div>
    );
  }

  const ranked = [...match.players].sort(
    (a, b) => (a.final_rank ?? 99) - (b.final_rank ?? 99),
  );
  const podium = ranked.slice(0, 3);
  const winner = ranked.find((p) => p.user_id === match.winner_id) ?? ranked[0];
  const isHost = user && lobby && lobby.host_id === user.id;

  function renderAvatar(player) {
    if (player.avatar_type === "custom") {
      return (
        <img
          src={player.avatar_value}
          alt={player.username}
          style={{ width: "100%", height: "100%", borderRadius: "50%" }}
        />
      );
    }
    return player.avatar_value;
  }

  return (
    <div className={styles.resultsCard}>
      <div className={styles.winnerBanner}>
        <span className={styles.winnerTrophy}>🏆</span>
        {winner ? `${winner.username} wins!` : "Match finished"}
      </div>

      {error && (
        <p role="alert" style={{ color: "#fff" }}>
          {error}
        </p>
      )}

      <div className={styles.podiumStage}>
        {podium.map((player) => (
          <div
            className={`${styles.podiumPlayer} ${player.final_rank === 1 ? styles.firstPlace : ""}`}
            key={player.user_id}
          >
            {player.final_rank === 1 && (
              <div className={styles.firstPlaceCrown}>👑</div>
            )}
            <div className={styles.playerInfo}>
              <div className={styles.playerAvatar}>{renderAvatar(player)}</div>
              <div className={styles.playerName}>
                {player.username} — {player.score} pts
              </div>
            </div>
            <div
              className={`${styles.podiumBlock} ${styles[RANK_BLOCK_CLASS[player.final_rank]] ?? ""}`}
            >
              <div className={styles.podiumRank}>{player.final_rank}</div>
            </div>
          </div>
        ))}
      </div>

      {isHost ? (
        <button
          className={styles.playAgainButton}
          onClick={handlePlayAgain}
          disabled={restarting}
          type="button"
        >
          {restarting ? "Starting…" : "Play again"}
        </button>
      ) : (
        <p style={{ color: "#fff" }}>
          Waiting for the host to start a new game…
        </p>
      )}
    </div>
  );
}
