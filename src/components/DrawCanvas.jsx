import { useRef, useImperativeHandle, forwardRef } from "react";
import styles from "./DrawCanvas.module.css";

const DrawCanvas = forwardRef(function DrawCanvas(
  {
    readOnly = false,
    brushColor = "#000000",
    brushSize = 4,
    onDraw,
    onBeforeStroke,
    onClear,
  },
  ref,
) {
  const canvasRef = useRef(null); // was: document.getElementById('spriteCanvas')
  const drawing = useRef(false); // was: let drawing = false

  // Expose methods so Game.jsx can call clearBoard() and drawStroke() on this canvas
  useImperativeHandle(ref, () => ({
    drawStroke({ x1, y1, x2, y2, color, size }) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const drawingContext = canvas.getContext("2d");
      drawingContext.beginPath();
      drawingContext.moveTo(x1, y1);
      drawingContext.lineTo(x2, y2);
      drawingContext.strokeStyle = color;
      drawingContext.lineWidth = size;
      drawingContext.lineCap = "round";
      drawingContext.lineJoin = "round";
      drawingContext.stroke();
    },
    clearBoard() {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const drawingContext = canvas.getContext("2d");
      drawingContext.clearRect(0, 0, canvas.width, canvas.height);
    },
    get _canvas() {
      return canvasRef.current;
    },
  }));

  /** tells where the cursor is (where to draw) */
  /** rect is short for rectangle (basically tell the cursor it cant draw outside these bounds) */
  function getPosition(event) {
    const canvasBounds = canvasRef.current.getBoundingClientRect();
    return {
      x: event.clientX - canvasBounds.left,
      y: event.clientY - canvasBounds.top,
    };
  }

  /** when the mouse is clicked it will draw (inside canvas bounds) */
  /** "mousedown" means when the mouse is clicked */
  function onMouseDown(event) {
    if (readOnly) return;
    drawing.current = true;
    onBeforeStroke?.();
    const drawingContext = canvasRef.current.getContext("2d");
    const position = getPosition(event);
    drawingContext.beginPath();
    drawingContext.moveTo(position.x, position.y);
  }

  /** if we are not drawing it shows us what we have drawn
   * (so it doesnt erase right when u let go of the mouse) */
  /** lineCap controls how the ends of a line look — 'round' gives them rounded tips
   *  instead of flat or square edges.
   *  lineJoin controls how two lines connect at a corner — 'round' makes the corner
   *  smooth instead of sharp or clipped.
   *  Together they make the brush strokes look smoother when you're drawing. */
  function onMouseMove(event) {
    if (!drawing.current || readOnly) return;
    const drawingContext = canvasRef.current.getContext("2d");
    const position = getPosition(event);
    drawingContext.lineTo(position.x, position.y);
    drawingContext.strokeStyle = brushColor; // was: colorPicker.value
    drawingContext.lineWidth = brushSize; // was: hardcoded 4
    drawingContext.lineCap = "round";
    drawingContext.lineJoin = "round";
    drawingContext.stroke();
    onDraw?.({
      x1: position.x,
      y1: position.y,
      x2: position.x,
      y2: position.y,
      color: brushColor,
      size: brushSize,
    });
  }

  /** so if were moving the mouse around the canvas without clicking it wont draw unless clicked */
  function onMouseUp() {
    drawing.current = false;
  }
  function onMouseLeave() {
    drawing.current = false;
  }

  /** erases the canvas (clears the canvas) */
  function clearCanvas() {
    const drawingContext = canvasRef.current.getContext("2d");
    drawingContext.clearRect(
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height,
    );
    onClear?.();
  }

  return (
    <div className={styles.wrapper}>
      <canvas
        ref={canvasRef}
        width={512}
        height={320}
        className={`${styles.canvas} ${readOnly ? styles.readOnly : ""}`}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        style={{ touchAction: "none" }}
        aria-label={readOnly ? "Drawing canvas (view only)" : "Drawing canvas"}
      />
      {!readOnly && (
        <button className={styles.clearBtn} onClick={clearCanvas} type="button">
          clear
        </button>
      )}
    </div>
  );
});

export default DrawCanvas;
