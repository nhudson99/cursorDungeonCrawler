export class Input {
  private keys = new Set<string>();
  private pressed = new Set<string>();
  mouse = { x: 0, y: 0, down: false, clicked: false };

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", (e) => {
      const k = e.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(k)) {
        e.preventDefault();
      }
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
    });
    window.addEventListener("keyup", (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      const sx = canvas.width / rect.width;
      const sy = canvas.height / rect.height;
      this.mouse.x = (e.clientX - rect.left) * sx;
      this.mouse.y = (e.clientY - rect.top) * sy;
    });
    canvas.addEventListener("mousedown", () => {
      this.mouse.down = true;
      this.mouse.clicked = true;
    });
    window.addEventListener("mouseup", () => {
      this.mouse.down = false;
    });
  }

  down(key: string): boolean {
    return this.keys.has(key.toLowerCase());
  }

  justPressed(key: string): boolean {
    return this.pressed.has(key.toLowerCase());
  }

  axis(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.down("a") || this.down("arrowleft")) x -= 1;
    if (this.down("d") || this.down("arrowright")) x += 1;
    if (this.down("w") || this.down("arrowup")) y -= 1;
    if (this.down("s") || this.down("arrowdown")) y += 1;
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.SQRT2;
      x *= inv;
      y *= inv;
    }
    return { x, y };
  }

  endFrame(): void {
    this.pressed.clear();
    this.mouse.clicked = false;
  }
}
