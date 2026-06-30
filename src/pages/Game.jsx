import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import DrawCanvas from "../components/DrawCanvas";
import WordPicker from "../components/WordPicker";
import RoundWinner from "../components/RoundWinner";
import styles from "./Game.module.css";

const BRUSH_COLORS = [
  "#1a1a2e",
  "#ff6b6b",
  "#4ecdc4",
  "#ffe66d",
  "#a29bfe",
  "#ff9f43",
  "#ffffff",
  "#74b9ff",
];
const MAX_SCORE = 4;
const ROUND_DURATION = 80;

// Demo data — remove when WebSocket is wired up
const DEMO_PLAYERS = [
  { userID: "1", username: "You", icon: "🐱", score: 2 },
  { userID: "2", username: "DoodleMaster", icon: "🦁", score: 3 },
  { userID: "3", username: "SketchQueen", icon: "🐙", score: 1 },
  { userID: "4", username: "BrushHero", icon: "🐸", score: 0 },
];

export default function Game() {
  const { code } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const wsRef = useRef(null);
  const timerRef = useRef(null);

  // ── Game state ──────────────────────────────────────────
  const [phase, setPhase] = useState("word_pick"); // word_pick | drawing | round_end | game_over
  const [isDrawer, setIsDrawer] = useState(true);
  const [word, setWord] = useState("");
  const [wordChoices, setWordChoices] = useState([]);
  const [timeLeft, setTimeLeft] = useState(ROUND_DURATION);
  const [round, setRound] = useState(1);
  const [players, setPlayers] = useState(DEMO_PLAYERS);
  const [messages, setMessages] = useState([]);
  const [brushColor, setBrushColor] = useState(BRUSH_COLORS[0]);
  const [brushSize, setBrushSize] = useState(6);
  const [guess, setGuess] = useState("");
  const [roundWinner, setRoundWinner] = useState(null); // { username, icon, word }
  const [undoStack, setUndoStack] = useState([]); // array of ImageData snapshots

  // ── Connect & bootstrap ─────────────────────────────────
  useEffect(() => {
    if (!user || !code) return;

    // TODO: wire up real WebSocket
    // const ws = new WebSocket(`ws://localhost:4000/room/${code}?userID=${user.userID}`);
    // wsRef.current = ws;
    // ws.onmessage = (e) => handleServerMsg(JSON.parse(e.data));
    // return () => ws.close();

    // ── DEMO: simulate server kicking off first round ──
    fetchWordChoices();
  }, [user, code]);

  // ── Fetch 3 random words from API ───────────────────────
  async function fetchWordChoices() {
    setPhase("word_pick");
    try {
      // const res = await fetch(`/api/words/random?count=3`);
      // const data = await res.json();  // { words: ["elephant","bicycle","castle"] }
      // setWordChoices(data.words);

      // DEMO fallback
      const banks = [
        "elephant",
        "bicycle",
        "castle",
        "umbrella",
        "volcano",
        "flamingo",
        "telescope",
        "avalanche",
        "compass",
        "tornado",
      ];
      const shuffled = banks.sort(() => Math.random() - 0.5).slice(0, 3);
      setWordChoices(shuffled);
    } catch {
      setWordChoices(["elephant", "bicycle", "castle"]);
    }
  }

  // ── Handle incoming WebSocket messages ──────────────────
  function handleServerMsg(msg) {
    switch (msg.type) {
      case "round_start":
        setRound(msg.round);
        setIsDrawer(msg.drawerID === user.userID);
        if (msg.drawerID === user.userID) {
          setWordChoices(msg.wordChoices);
          setPhase("word_pick");
        } else {
          setPhase("drawing");
          setWord("");
          startTimer(msg.duration);
        }
        canvasRef.current?.clearBoard();
        break;
      case "round_timer":
        setTimeLeft(msg.remaining);
        break;
      case "chat":
        addMessage({ type: "guess", name: msg.username, text: msg.text });
        break;
      case "correct_guess":
        addMessage({ type: "correct", name: msg.username, text: msg.guess });
        setPlayers(msg.players);
        break;
      case "round_end":
        clearTimer();
        setRoundWinner(msg.winner); // null if timer ran out with no winner
        setWord(msg.word);
        setPhase("round_end");
        setPlayers(msg.players);
        break;
      case "game_over":
        setPlayers(msg.players);
        setPhase("game_over");
        setTimeout(
          () =>
            navigate(`/results/${code}`, { state: { players: msg.players } }),
          500,
        );
        break;
      case "draw":
        canvasRef.current?.drawStroke(msg);
        break;
      case "clear":
        canvasRef.current?.clearBoard();
        break;
    }
  }

  // ── Word chosen by drawer ────────────────────────────────
  function onWordChosen(chosenWord) {
    setWord(chosenWord);
    setPhase("drawing");
    setMessages([
      { type: "system", text: "🎨 Round started! You're drawing." },
    ]);
    startTimer(ROUND_DURATION);
    // wsRef.current?.send(JSON.stringify({ type: "word_chosen", word: chosenWord }));
  }

  // ── Timer ────────────────────────────────────────────────
  function startTimer(duration) {
    clearTimer();
    setTimeLeft(duration);
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearTimer();
          // In demo mode simulate round end when timer hits 0
          handleTimerEnd();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }

  function clearTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function handleTimerEnd() {
    // Server will send round_end in production — this is demo only
    setPhase("round_end");
    setRoundWinner(null);
  }

  useEffect(() => () => clearTimer(), []);

  // ── Drawing ──────────────────────────────────────────────
  function handleDraw(drawData) {
    // wsRef.current?.send(JSON.stringify({ type: "draw", ...drawData }));
  }

  function handleBeforeStroke() {
    // Save canvas snapshot for undo
    const canvas = canvasRef.current?._canvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    setUndoStack((prev) => [
      ...prev.slice(-19),
      ctx.getImageData(0, 0, canvas.width, canvas.height),
    ]);
  }

  function handleUndo() {
    const canvas = canvasRef.current?._canvas;
    if (!canvas || undoStack.length === 0) return;
    const ctx = canvas.getContext("2d");
    const last = undoStack[undoStack.length - 1];
    ctx.putImageData(last, 0, 0);
    setUndoStack((prev) => prev.slice(0, -1));
    // wsRef.current?.send(JSON.stringify({ type: "undo", imageData: "..." }));
  }

  // ── Chat / Guesses ───────────────────────────────────────
  function addMessage(msg) {
    setMessages((prev) => [...prev, msg]);
  }

  function sendGuess() {
    const text = guess.trim();
    if (!text || isDrawer) return;
    addMessage({ type: "guess", name: user?.username ?? "You", text });
    // wsRef.current?.send(JSON.stringify({ type: "guess", text }));
    setGuess("");
  }

  // ── Next round (after round_end screen) ─────────────────
  function nextRound() {
    const newRound = round + 1;
    setRound(newRound);
    setRoundWinner(null);
    setMessages([]);
    canvasRef.current?.clearBoard();

    // Check if any player hit max score
    const winner = players.find((p) => p.score >= MAX_SCORE);
    if (winner) {
      navigate(`/results/${code}`, { state: { players } });
      return;
    }
    // wsRef.current?.send(JSON.stringify({ type: "next_round" }));
    // DEMO: rotate drawer and fetch new words
    fetchWordChoices();
  }

  // ── Render ───────────────────────────────────────────────

  // Word picker overlay (drawer only)
  if (phase === "word_pick" && isDrawer) {
    return (
      <WordPicker words={wordChoices} round={round} onChoose={onWordChosen} />
    );
  }

  // Round winner overlay
  if (phase === "round_end") {
    return (
      <RoundWinner
        winner={roundWinner}
        word={word}
        round={round}
        players={players}
        onNext={nextRound}
        isHost={true} // TODO: check from server
      />
    );
  }

  return (
    <div className={styles.gamePage}>
      <div className={styles.mainLayout}>
        {/* ── LEFT PANEL ── */}
        <div className={styles.leftPanel}>
          <div className={styles.drawingCanvas}>
            <div className={styles.canvasHeader}>
              <span>drawing canvass</span>
              <span className={styles.roundTimerPill}>
                Round {round} · {timeLeft}s
              </span>
            </div>
            <div className={styles.canvasBody}>
              {isDrawer && (
                <div className={styles.canvasTools}>
                  <button className={styles.undoBtn} onClick={handleUndo}>
                    undo
                  </button>
                  <div className={styles.colorPickerBtn}>
                    {BRUSH_COLORS.map((c) => (
                      <button
                        key={c}
                        className={`${styles.colorDot} ${c === brushColor ? styles.colorDotSelected : ""}`}
                        style={{ background: c }}
                        onClick={() => setBrushColor(c)}
                        aria-label={`color ${c}`}
                      />
                    ))}
                  </div>
                  <div className={styles.sizeBtns}>
                    {[4, 10, 20].map((s, i) => (
                      <button
                        key={s}
                        className={`${styles.sizeBtn} ${brushSize === s ? styles.sizeBtnActive : ""}`}
                        onClick={() => setBrushSize(s)}
                      >
                        {["S", "M", "L"][i]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className={styles.canvasDrawArea}>
                <DrawCanvas
                  ref={canvasRef}
                  readOnly={!isDrawer}
                  brushColor={brushColor}
                  brushSize={brushSize}
                  onDraw={handleDraw}
                  onBeforeStroke={handleBeforeStroke}
                />
              </div>
            </div>
          </div>

          <div className={styles.bottomRow}>
            <div className={styles.score}>
              <span>score</span>
              <span className={styles.scoreNum}>
                {players.find((p) => p.userID === user?.userID)?.score ?? 0}
              </span>
            </div>
            <div className={styles.promptBox}>
              {isDrawer ? (
                <>
                  draw this word:
                  <br />
                  <strong>{word}</strong>
                </>
              ) : (
                <>
                  prompt for drawing,
                  <br />
                  left empty if guessing
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className={styles.rightPanel}>
          <div className={styles.playersSection}>
            {[...players]
              .sort((a, b) => b.score - a.score)
              .map((p) => (
                <div
                  key={p.userID}
                  className={`${styles.player} ${p.userID === user?.userID && isDrawer ? styles.playerActive : ""}`}
                  title={p.username}
                >
                  {p.icon}
                  <span className={styles.playerScoreBadge}>{p.score}</span>
                </div>
              ))}
          </div>

          <div className={styles.chatBox}>
            <div className={styles.chatHeader}>Chat box</div>
            <div className={styles.chatBody}>
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={
                    m.type === "system"
                      ? styles.chatMsgSystem
                      : m.type === "correct"
                        ? styles.chatMsgCorrect
                        : ""
                  }
                >
                  {m.name && (
                    <span className={styles.chatMsgName}>{m.name}: </span>
                  )}
                  {m.text}
                </div>
              ))}
            </div>
            <div className={styles.chatInputRow}>
              <input
                className={styles.chatInput}
                type="text"
                placeholder="type a message..."
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendGuess()}
                disabled={isDrawer}
              />
              <button
                className={styles.chatSendBtn}
                onClick={sendGuess}
                disabled={isDrawer}
              >
                send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
