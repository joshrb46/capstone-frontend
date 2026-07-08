import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import styles from "./Landing.module.css";

const AVATARS = ["🐱", "🐶", "🦊", "🐸", "🐼", "🦁", "🐙", "🦋"];

export default function Landing() {
  const { register } = useAuth();
  const navigate = useNavigate();

  // form state
  const [username, setUsername] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // avatar state: emoji or custom sprite
  const [selectedEmoji, setSelectedEmoji] = useState(AVATARS[0]);
  const [iconMode, setIconMode] = useState("emoji"); //"emoji" | "draw"

  // sprite canvas
  const canvasRef = useRef(null); // was: document.getElementById('spriteCanvas')
  const drawing = useRef(false); // was: let drawing = false
  const [color, setColor] = useState("#000000"); // was: colorPicker.value

  /** tells where the cursor is (where to draw) */
  /** rect is short for rectangle (basically tell the cursor it cant draw outside these bounds) */
  function getPosition(event) {
    const canvasBounds = canvasRef.current.getBoundingClientRect();
    return {
      x: event.clientX - canvasBounds.left,
      y: event.clientY - canvasBounds.top,
    };
  }

  /** when the mouse is clicked it will draw (inside canvas) */
  /** "mousedown" means when the mouse is clicked */
  function onMouseDown(event) {
    drawing.current = true;
    const drawingContext = canvasRef.current.getContext("2d");
    const position = getPosition(event);
    drawingContext.beginPath();
    drawingContext.moveTo(position.x, position.y);
  }

  /** if we are not drawing it shows us what we have drawn
   * (so it doesnt erase right when u let go of the mouse) */

  /** lineCap controls how the ends of a line look 'round' gives them rounded tips
   *  instead of flat or square edges.
   *  lineJoin controls how two lines connect at a corner 'round' makes the corner
   *  smooth instead of sharp or clipped.
   *  Together they make the brush strokes look smoother when you're drawing. */
  function onMouseMove(event) {
    if (!drawing.current) return;
    const drawingContext = canvasRef.current.getContext("2d");
    const position = getPosition(event);
    drawingContext.lineTo(position.x, position.y);
    drawingContext.strokeStyle = color; // was: colorPicker.value
    drawingContext.lineWidth = 4;
    drawingContext.lineCap = "round";
    drawingContext.lineJoin = "round";
    drawingContext.stroke();
  }

  /** so if were moving the mouse around the canvas without
   * clicking it wont draw unless clicked */
  function onMouseUp() {
    drawing.current = false;
  }
  function onMouseLeave() {
    drawing.current = false;
  }

  /** erases the canvas (clears the canvas) */
  function clearCanvas() {
    const canvas = canvasRef.current;
    const drawingContext = canvas.getContext("2d");
    drawingContext.clearRect(0, 0, canvas.width, canvas.height);
  }

  // lobby actions
  async function handleSubmit(action) {
    setError(null);
    if (!username.trim()) {
      setError("Enter a username first!");
      return;
    }
    if (action === "join" && joinCode.trim().length < 4) {
      setError("Enter a valid room code.");
      return;
    }
    setLoading(true);
    try {
      const avatarType = iconMode === "draw" ? "custom" : "preset";
      const avatarValue =
        iconMode === "draw" ? canvasRef.current.toDataURL() : selectedEmoji;

      const newUser = await register({
        username: username.trim(),
        avatarType,
        avatarValue,
      });

      if (action === "create") {
        const lobby = await api.post("/lobby", {}, newUser.session_token);
        navigate(`/lobby/${lobby.code}`);
      } else {
        const code = joinCode.trim().toUpperCase();
        await api.post(`/lobby/${code}/players`, {}, newUser.session_token);
        navigate(`/lobby/${code}`);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.landingPage}>
      <div className={styles.landingColors}>
        <h1 className={styles.landingTitle}>Picture It!</h1>

        <div className={styles.descriptionBox}>
          <h3>Sketch it, guess it, Picture it!</h3>
        </div>

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <div className={styles.userSetup}>
          {/* Username */}
          <input
            className={styles.usernameBox}
            type="text"
            id="username"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit("create")}
            autoComplete="off"
          />

          {/* Choose icon or draw sprite */}
          <h4 className={styles.iconChoiceText}>choose an icon or sprite</h4>

          {/* Tab toggle */}
          <div className={styles.tabRow}>
            <button
              className={`${styles.tab} ${iconMode === "emoji" ? styles.tabActive : ""}`}
              onClick={() => setIconMode("emoji")}
              type="button"
            >
              pick an icon
            </button>
            <button
              className={`${styles.tab} ${iconMode === "draw" ? styles.tabActive : ""}`}
              onClick={() => setIconMode("draw")}
              type="button"
            >
              draw your own
            </button>
          </div>

          {/* Premade emoji icons */}
          {iconMode === "emoji" && (
            <div className={styles.premadeIcons}>
              {AVATARS.map((a) => (
                <button
                  key={a}
                  className={`${styles.icon} ${selectedEmoji === a ? styles.iconSelected : ""}`}
                  onClick={() => setSelectedEmoji(a)}
                  type="button"
                >
                  {a}
                </button>
              ))}
            </div>
          )}

          {/* Custom sprite canvas */}
          {iconMode === "draw" && (
            <div className={styles.customSprite}>
              <h4 className={styles.customSpriteText}>
                Create Your Own Sprite
              </h4>
              <canvas
                ref={canvasRef}
                id="spriteCanvas"
                className={styles.spriteCanvas}
                width={100}
                height={100}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseLeave}
              />
              <div className={styles.spriteControls}>
                <input
                  type="color"
                  id="colorPicker"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                />
                <button
                  className={styles.clearBtn}
                  id="clearCanvas"
                  onClick={clearCanvas}
                  type="button"
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Lobby actions*/}
        <div className={styles.lobbyActions}>
          <div className={styles.lobbyActionSide}>
            <button
              className={styles.createBtn}
              onClick={() => handleSubmit("create")}
              disabled={loading}
              type="button"
            >
              {loading ? "Setting up…" : "Create a lobby"}
            </button>
          </div>

          <div className={styles.orDivider}>
            <span>or</span>
          </div>

          <div className={styles.lobbyActionSide}>
            <div className={styles.joinRow}>
              <input
                className={styles.roomCodeInput}
                type="text"
                placeholder="Enter room code"
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit("join")}
                style={{ letterSpacing: "4px", textTransform: "uppercase" }}
                aria-label="Room code"
              />
              <button
                className={styles.joinBtn}
                onClick={() => handleSubmit("join")}
                disabled={loading}
                type="button"
              >
                Join
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
