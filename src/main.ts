import "./fonts.css";
import { Game } from "./game";
import { Input } from "./input";
import { Renderer } from "./renderer";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const ctx = canvas.getContext("2d");
if (!ctx) throw new Error("Canvas 2D unavailable");

const game = new Game(new Input(canvas));
const renderer = new Renderer(ctx);

let last = performance.now();

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  game.update(dt);
  renderer.draw(game);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
