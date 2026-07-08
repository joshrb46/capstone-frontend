import { useCallback, useEffect, useRef, useState } from "react";
import { getSocket, identifySocket } from "../lib/socket";
import styles from "./DrawCanvas.module.css";

/**
 * isDrawer: only the drawer's local mouse/touch input is captured and
 * broadcast; guessers' canvases are read-only and just render incoming
 * draw:stroke / draw:clear events for this match.
 */
export default function DrawCanvas({ matchId, sessionToken, isDrawer, roundId }) {
  const canvasRef = useRef(null);
  const colorRef = useRef(null);
  const drawing = useRef(false);
  const historyRef = useRef([]);
  const lastPoint = useRef(null);

  const [currentColor, setCurrentColor] = useState("#000000");

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { offsetWidth, offsetHeight } = canvas;

    // Skip resizes to 0x0. This fires transiently when the window is
    // minimized or mid-transition (e.g. toggling fullscreen), and actually
    // resizing the <canvas> element to 0x0 wipes its pixel buffer. If we
    // let that happen, there's nothing left to restore on the *next*
    // resize event either — the drawing is gone for good.
    if (offsetWidth === 0 || offsetHeight === 0) return;
    // No-op if the size hasn't actually changed (avoids pointless wipes).
    if (canvas.width === offsetWidth && canvas.height === offsetHeight) {
      return;
    }

    const ctx = canvas.getContext("2d");
    const imageData =
      canvas.width > 0 && canvas.height > 0
        ? ctx.getImageData(0, 0, canvas.width, canvas.height)
        : null;
    canvas.width = offsetWidth;
    canvas.height = offsetHeight;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 4;
    if (imageData) ctx.putImageData(imageData, 0, 0);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(resizeCanvas);
    observer.observe(canvas);
    resizeCanvas();
    return () => observer.disconnect();
  }, [resizeCanvas]);

  // Clear the canvas at the start of every round. Without this, a new
  // round's drawing gets layered on top of whatever was left over from
  // the previous round (for every player, not just the new drawer).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || canvas.width === 0 || canvas.height === 0) return;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    historyRef.current = [];
  }, [roundId]);

  // Listen for remote strokes from whoever is drawing.
  useEffect(() => {
    if (!sessionToken) return;
    const socket = getSocket();

    // x/y arrive as fractions (0-1) of the sender's canvas size, not raw
    // pixels — the drawer's canvas can be a different size than a
    // guesser's (e.g. the drawer's toolbar takes up extra width that
    // guessers don't have), so raw pixel coordinates from one canvas
    // don't line up on another. Scale by *this* canvas's own size instead.
    function strokeToCanvas({ type, x, y, color }) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      const px = x !== undefined ? x * canvas.width : undefined;
      const py = y !== undefined ? y * canvas.height : undefined;
      if (type === "start") {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.strokeStyle = color;
      } else if (type === "move") {
        ctx.lineTo(px, py);
        ctx.stroke();
      } else if (type === "end") {
        ctx.beginPath();
      }
    }

    function handleClear() {
      const canvas = canvasRef.current;
      canvas?.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    }

    socket.on("draw:stroke", strokeToCanvas);
    socket.on("draw:clear", handleClear);
    return () => {
      socket.off("draw:stroke", strokeToCanvas);
      socket.off("draw:clear", handleClear);
    };
  }, [sessionToken]);

  function saveState() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    historyRef.current.push(
      ctx.getImageData(0, 0, canvas.width, canvas.height),
    );
    if (historyRef.current.length > 50) historyRef.current.shift();
  }

  function getPos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }

  function emitStroke(type, point) {
    if (!sessionToken) return;
    const canvas = canvasRef.current;
    const nx = point && canvas ? point.x / canvas.width : undefined;
    const ny = point && canvas ? point.y / canvas.height : undefined;
    getSocket().emit("draw:stroke", {
      matchId,
      type,
      x: nx,
      y: ny,
      color: currentColor,
    });
  }

  function startDraw(e) {
    if (!isDrawer) return;
    e.preventDefault();
    saveState();
    drawing.current = true;
    const point = getPos(e);
    lastPoint.current = point;
    const ctx = canvasRef.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.strokeStyle = currentColor;
    emitStroke("start", point);
  }

  function draw(e) {
    if (!isDrawer || !drawing.current) return;
    e.preventDefault();
    const point = getPos(e);
    lastPoint.current = point;
    const ctx = canvasRef.current.getContext("2d");
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    emitStroke("move", point);
  }

  function stopDraw() {
    if (!isDrawer || !drawing.current) return;
    drawing.current = false;
    canvasRef.current?.getContext("2d").beginPath();
    emitStroke("end", lastPoint.current);
  }

  function handleUndo() {
    if (!isDrawer || historyRef.current.length === 0) return;
    const ctx = canvasRef.current.getContext("2d");
    ctx.putImageData(historyRef.current.pop(), 0, 0);
  }

  function handleClear() {
    if (!isDrawer) return;
    const canvas = canvasRef.current;
    saveState();
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
    if (sessionToken) getSocket().emit("draw:clear", { matchId });
  }

  function openColorPicker() {
    colorRef.current?.click();
  }

  return (
    <div className={styles.canvasBody}>
      {isDrawer && (
        <div className={styles.canvasTools}>
          <button className={styles.undoBtn} onClick={handleUndo} type="button">
            undo
          </button>
          <button
            className={styles.clearBtn}
            onClick={handleClear}
            type="button"
          >
            clear
          </button>
          <div
            className={styles.colorPickerBtn}
            style={{ background: currentColor }}
            onClick={openColorPicker}
          >
            color
            <br />
            picker
          </div>
          <input
            ref={colorRef}
            type="color"
            value={currentColor}
            onChange={(e) => setCurrentColor(e.target.value)}
            style={{ display: "none" }}
          />
        </div>
      )}

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
  );
}
