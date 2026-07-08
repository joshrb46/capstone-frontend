import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import { getSocket, identifySocket } from "../lib/socket";
import DrawCanvas from "../components/DrawCanvas";
import ChatBox from "../components/ChatBox";
import styles from "./Game.module.css";

export default function Game() {
  const { code, matchId } = useParams();
  const { user, sessionToken } = useAuth();
  const navigate = useNavigate();

  const [lobby, setLobby] = useState(null);
  const [match, setMatch] = useState(null);
  const [rounds, setRounds] = useState([]);
  const [wordOptions, setWordOptions] = useState(null);
  const [wordText, setWordText] = useState(null); // only ever set for the drawer
  const [timeLeft, setTimeLeft] = useState(null);
  const [systemMessages, setSystemMessages] = useState([]);
  const [error, setError] = useState(null);

  const busyRef = useRef(false); // guards against double-firing round/match transitions

  const currentRound = rounds[rounds.length - 1] ?? null;
  const isDrawer = currentRound && user && currentRound.drawer_id === user.id;
  const isHost = lobby && user && lobby.host_id === user.id;

  const loadAll = useCallback(async () => {
    try {
      const [lobbyData, matchData, roundsData] = await Promise.all([
        api.get(`/lobby/${code}`, sessionToken),
        api.get(`/matches/${matchId}`, sessionToken),
        api.get(`/rounds/match/${matchId}`, sessionToken),
      ]);
      setLobby(lobbyData);
      setMatch(matchData);
      setRounds(roundsData);
    } catch (e) {
      setError(e.message);
    }
  }, [code, matchId, sessionToken]);

  useEffect(() => {
    if (!user) navigate("/", { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (user) loadAll();
  }, [user, loadAll]);

  // Socket wiring: join the match room and react to round/match lifecycle events.
  useEffect(() => {
    if (!sessionToken) return;
    let cancelled = false;
    const socket = getSocket();

    const onRoundCreated = (round) => {
      setRounds((prev) => [...prev, round]);
      setWordOptions(null);
      setWordText(null);
    };
    const onWordChosen = ({ roundId, status }) => {
      setRounds((prev) =>
        prev.map((r) =>
          r.id === roundId
            ? { ...r, status, drawing_started_at: new Date().toISOString() }
            : r,
        ),
      );
    };
    const onRoundEnded = (round) => {
      setRounds((prev) => prev.map((r) => (r.id === round.id ? round : r)));
      api
        .get(`/matches/${matchId}`, sessionToken)
        .then(setMatch)
        .catch(() => {});
    };
    const onCorrectGuess = ({ username, points }) => {
      setSystemMessages((prev) => [
        ...prev,
        `${username} guessed it! +${points} pts`,
      ]);
    };
    const onMatchEnded = () => navigate(`/podium/${code}/${matchId}`);

    socket.on("round:created", onRoundCreated);
    socket.on("round:word_chosen", onWordChosen);
    socket.on("round:ended", onRoundEnded);
    socket.on("round:correct_guess", onCorrectGuess);
    socket.on("match:ended", onMatchEnded);

    identifySocket(sessionToken)
      .then(() => {
        if (!cancelled) socket.emit("match:join", { matchId });
      })
      .catch((e) => setError(e.message));

    return () => {
      cancelled = true;
      socket.emit("match:leave", { matchId });
      socket.off("round:created", onRoundCreated);
      socket.off("round:word_chosen", onWordChosen);
      socket.off("round:ended", onRoundEnded);
      socket.off("round:correct_guess", onCorrectGuess);
      socket.off("match:ended", onMatchEnded);
    };
  }, [sessionToken, matchId, code, navigate]);

  // Host-driven game flow: create the first round, advance rounds, or end the match.
  useEffect(() => {
    if (!isHost || !match || !lobby || busyRef.current) return;

    async function advance() {
      busyRef.current = true;
      try {
        const players = match.players;
        const someoneWon = players.some((p) => p.score >= lobby.win_score);
        const outOfRounds = rounds.length >= lobby.max_rounds;

        if (rounds.length === 0) {
          const drawerId = players[0].user_id;
          await api.post(
            `/rounds/match/${matchId}`,
            { roundNumber: 1, drawerId },
            sessionToken,
          );
        } else if (currentRound?.status === "round_end") {
          if (someoneWon || outOfRounds) {
            await api.post(`/matches/${matchId}/end`, {}, sessionToken);
          } else {
            const nextNumber = rounds.length + 1;
            const drawerId = players[rounds.length % players.length].user_id;
            await api.post(
              `/rounds/match/${matchId}`,
              { roundNumber: nextNumber, drawerId },
              sessionToken,
            );
          }
        }
      } catch (e) {
        setError(e.message);
      } finally {
        busyRef.current = false;
      }
    }

    advance();
  }, [isHost, match, lobby, rounds, currentRound, matchId, sessionToken]);

  // Drawer fetches word choices as soon as their round enters "choosing_word".
  useEffect(() => {
    if (!isDrawer || currentRound?.status !== "choosing_word" || wordOptions)
      return;
    api
      .get(`/rounds/${currentRound.id}`, sessionToken)
      .then((data) => setWordOptions(data.word_options))
      .catch((e) => setError(e.message));
  }, [isDrawer, currentRound, wordOptions, sessionToken]);

  async function chooseWord(word) {
    try {
      await api.post(
        `/rounds/${currentRound.id}/choose-word`,
        { wordId: word.id },
        sessionToken,
      );
      setWordText(word.text);
      setWordOptions(null);
    } catch (e) {
      setError(e.message);
    }
  }

  // Countdown timer while a round is in "drawing" — the drawer's client ends it at zero.
  useEffect(() => {
    if (
      currentRound?.status !== "drawing" ||
      !currentRound.drawing_started_at
    ) {
      setTimeLeft(null);
      return;
    }
    const duration = currentRound.duration_seconds ?? 80;
    const startedAt = new Date(currentRound.drawing_started_at).getTime();

    const tick = () => {
      const remaining = Math.max(
        0,
        Math.round(duration - (Date.now() - startedAt) / 1000),
      );
      setTimeLeft(remaining);
      if (remaining === 0 && isDrawer && !busyRef.current) {
        busyRef.current = true;
        api
          .post(`/rounds/${currentRound.id}/end`, {}, sessionToken)
          .catch((e) => setError(e.message))
          .finally(() => {
            busyRef.current = false;
          });
      }
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [currentRound, isDrawer, sessionToken]);

  if (!match || !lobby) {
    return (
      <div className={styles.gamePage}>
        {error ? <p role="alert">{error}</p> : <p>Loading game…</p>}
      </div>
    );
  }

  const players = match.players;
  const promptText =
    currentRound?.status === "choosing_word"
      ? isDrawer
        ? "Pick a word to draw!"
        : "Waiting for the drawer to pick a word…"
      : currentRound?.status === "drawing"
        ? isDrawer
          ? `Draw: ${wordText ?? "…"}`
          : "Guess what's being drawn!"
        : "Waiting for the next round…";

  return (
    <div className={styles.gamePage}>
      {error && <p role="alert">{error}</p>}
      <div className={styles.mainLayout}>
        {/* LEFT PANEL */}
        <div className={styles.leftPanel}>
          <div className={styles.drawingCanvas}>
            <div className={styles.canvasHeader}>
              <span>drawing canvas</span>
              <span className={styles.roundTimerPill}>
                Room: {code} {timeLeft !== null ? `· ${timeLeft}s` : ""}
              </span>
            </div>

            {currentRound?.status === "choosing_word" &&
            isDrawer &&
            wordOptions ? (
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  padding: 24,
                  justifyContent: "center",
                  alignItems: "center",
                  height: "100%",
                }}
              >
                {wordOptions.map((word) => (
                  <button
                    key={word.id}
                    onClick={() => chooseWord(word)}
                    type="button"
                    className={styles.wordChoiceBtn}
                  >
                    {word.text}
                  </button>
                ))}
              </div>
            ) : (
              <DrawCanvas
                matchId={matchId}
                sessionToken={sessionToken}
                isDrawer={isDrawer}
              />
            )}
          </div>

          <div className={styles.bottomRow}>
            <div className={styles.score}>
              {players.find((p) => p.user_id === user.id)?.score ?? 0} pts
            </div>
            <div className={styles.promptBox}>{promptText}</div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className={styles.rightPanel}>
          <div className={styles.playersSection}>
            {players.map((p) => (
              <div
                key={p.user_id}
                className={`${styles.player} ${currentRound?.drawer_id === p.user_id ? styles.playerActive : ""}`}
                title={`${p.username} — ${p.score} pts`}
              >
                {p.avatar_type === "custom" ? (
                  <img
                    src={p.avatar_value}
                    alt={p.username}
                    style={{
                      width: "100%",
                      height: "100%",
                      borderRadius: "50%",
                    }}
                  />
                ) : (
                  p.avatar_value
                )}
              </div>
            ))}
          </div>

          <ChatBox matchId={matchId} roundId={currentRound?.id} />

          {systemMessages.length > 0 && (
            <div style={{ fontSize: 12, color: "#ffe66d" }}>
              {systemMessages[systemMessages.length - 1]}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
