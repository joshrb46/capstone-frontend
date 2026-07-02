import { useRef, useState, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import styles from "./Game.module.css";

export default function Game() {
  const { code } = useParams();

  const canvasRef = useRef(null); // was: document.getElementById('drawCanvas')
  const colorRef = useRef(null); // was: document.getElementById('colorInput')
  const drawing = useRef(false); // was: let drawing = false
  const historyRef = useRef([]); // was: let history = []

  const [currentColor, setCurrentColor] = useState("#000000"); // was: let currentColor
  const [messages, setMessages] = useState([]);
  const [guess, setGuess] = useState("");
  const [players, setPlayers] = useState([
    { id: 1, icon: "🐱", active: true },
    { id: 2, icon: "🐶", active: false },
    { id: 3, icon: "🦊", active: false },
    { id: 4, icon: "🐸", active: false },
  ]);

  // Resize canvas to fill its container
  // was: function resizeCanvas()
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const imageData =
      canvas.width > 0
        ? ctx.getImageData(0, 0, canvas.width, canvas.height)
        : null;
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 4;
    if (imageData) ctx.putImageData(imageData, 0, 0);
  }, []);

  // Watch canvas size and resize whenever it changes
  // was: new ResizeObserver(resizeCanvas).observe(canvas)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    resizeCanvas();
    return () => observer.disconnect();
  }, [resizeCanvas]);

  // Save canvas state for undo
  // was: function saveState()
  function saveState() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    historyRef.current.push(
      ctx.getImageData(0, 0, canvas.width, canvas.height),
    );
    if (historyRef.current.length > 50) historyRef.current.shift();
  }

  // Get cursor position relative to canvas
  // was: function getPos(e)
  function getPos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }

  // Start drawing
  // was: canvas.addEventListener('mousedown', startDraw)
  function startDraw(e) {
    e.preventDefault();
    saveState();
    drawing.current = true;
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = currentColor;
  }

  // Draw stroke
  // was: canvas.addEventListener('mousemove', draw)
  function draw(e) {
    if (!drawing.current) return;
    e.preventDefault();
    const { x, y } = getPos(e);
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  // Stop drawing
  // was: canvas.addEventListener('mouseup', stopDraw)
  function stopDraw() {
    drawing.current = false;
    canvasRef.current?.getContext("2d").beginPath();
  }

  // Undo
  // was: undoBtn.addEventListener('click', ...)
  function handleUndo() {
    if (historyRef.current.length === 0) return;
    const ctx = canvasRef.current.getContext("2d");
    ctx.putImageData(historyRef.current.pop(), 0, 0);
  }

  // Clear canvas
  // was: clearBtn.addEventListener('click', ...)
  function handleClear() {
    const canvas = canvasRef.current;
    saveState();
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  }

  // Color picker
  // was: colorPickerBtn.addEventListener('click', () => colorInput.click())
  function openColorPicker() {
    colorRef.current?.click();
  }

  function onColorChange(e) {
    setCurrentColor(e.target.value);
  }

  // Send chat guess
  function sendGuess() {
    const text = guess.trim();
    if (!text) return;
    setMessages((prev) => [...prev, { type: "guess", name: "You", text }]);
    setGuess("");
  }

  return (
    <div className={styles.gamePage}>
      <div className={styles.mainLayout}>
        {/* LEFT PANEL*/}
        <div className={styles.leftPanel}>
          <div className={styles.drawingCanvas}>
            <div className={styles.canvasHeader}>
              <span>drawing canvass</span>
              <span className={styles.roundTimerPill}>Room: {code}</span>
            </div>
            <div className={styles.canvasBody}>
              <div className={styles.canvasTools}>
                {/* Undo was: undoBtn */}
                <button className={styles.undoBtn} onClick={handleUndo}>
                  undo
                </button>

                {/* Clear was: clearBtn */}
                <button className={styles.clearBtn} onClick={handleClear}>
                  clear
                </button>

                {/* Color picker circle was: colorPickerBtn + colorInput */}
                <div
                  className={styles.colorPickerBtn}
                  style={{ background: currentColor }}
                  onClick={openColorPicker}
                >
                  color
                  <br />
                  picker
                </div>
                {/* Hidden color input was: <input type="color" id="colorInput" /> */}
                <input
                  ref={colorRef}
                  type="color"
                  value={currentColor}
                  onChange={onColorChange}
                  style={{ display: "none" }}
                />
              </div>

              {/* Canvas draw area was: <canvas id="drawCanvas"> */}
              <canvas
                ref={canvasRef}
                className={styles.canvasDrawArea}
                onMouseDown={startDraw}
                onMouseMove={draw}
                onMouseUp={stopDraw}
                onMouseLeave={stopDraw}
                onTouchStart={startDraw}
                onTouchMove={draw}
                onTouchEnd={stopDraw}
              />
            </div>
          </div>

          <div className={styles.bottomRow}>
            <div className={styles.score}>score</div>
            <div className={styles.promptBox}>
              prompt for drawing,
              <br />
              left empty if guessing
            </div>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className={styles.rightPanel}>
          <div className={styles.playersSection}>
            {players.map((p) => (
              <div
                key={p.id}
                className={`${styles.player} ${p.active ? styles.playerActive : ""}`}
              >
                {p.icon}
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
              />
              <button className={styles.chatSendBtn} onClick={sendGuess}>
                send
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
