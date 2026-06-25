import { useRef, useState } from "react";
import styles from "./LandingOriginal.module.css";

export default function LandingOriginal() {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [color, setColor] = useState("#000000");

  function getPos(e) {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function onMouseDown(e) {
    drawing.current = true;
    const ctx = canvasRef.current.getContext("2d");
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  }

  function onMouseMove(e) {
    if (!drawing.current) return;
    const ctx = canvasRef.current.getContext("2d");
    const pos = getPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  function onMouseUp() {
    drawing.current = false;
  }
  function onMouseLeave() {
    drawing.current = false;
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
  }

  return (
    <div className={styles.landingPage}>
      <div className={styles.landingColors}>
        <h1 className={styles.landingTitle}>CAPSTONE PROJECT NAME</h1>

        <div className={styles.descriptionBox}>
          <h3>description of game and directives on landing page</h3>
        </div>

        <div className={styles.userSetup}>
          <input
            className={styles.usernameBox}
            type="text"
            id="username"
            placeholder="Username"
          />

          <h4>choose an icon or sprite</h4>
          <div className={styles.premadeIcons}>
            <button className={styles.icon} />
            <button className={styles.icon} />
            <button className={styles.icon} />
            <button className={styles.icon} />
          </div>

          <div className={styles.customSprite}>
            <h4>Create Your Own Sprite</h4>
            <canvas
              ref={canvasRef}
              className={styles.spriteCanvas}
              width={300}
              height={300}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseLeave}
            />
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
            <button onClick={clearCanvas}>Clear</button>
          </div>
        </div>
      </div>
    </div>
  );
}
