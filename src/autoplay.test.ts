import { describe, expect, it } from "vitest";
import { Game } from "./game";
import { MemoryInput } from "./input";
import { dist, MAP_H, MAP_W, TILE, walkable, type Dungeon, type Vec } from "./core";

const DT = 1 / 60;

function bfs(dungeon: Dungeon, from: Vec, to: Vec): Vec[] | null {
  const sx = Math.floor(from.x);
  const sy = Math.floor(from.y);
  const gx = Math.floor(to.x);
  const gy = Math.floor(to.y);
  const seen = new Set<string>([`${sx},${sy}`]);
  const q: { x: number; y: number; path: Vec[] }[] = [
    { x: sx, y: sy, path: [{ x: sx, y: sy }] },
  ];
  while (q.length) {
    const cur = q.shift()!;
    if (cur.x === gx && cur.y === gy) return cur.path;
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ] as const) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const key = `${nx},${ny}`;
      if (seen.has(key) || nx < 0 || ny < 0 || nx >= MAP_W || ny >= MAP_H) continue;
      if (!walkable(dungeon, nx + 0.5, ny + 0.5)) continue;
      seen.add(key);
      q.push({ x: nx, y: ny, path: [...cur.path, { x: nx, y: ny }] });
    }
  }
  return null;
}

function releaseMove(input: MemoryInput): void {
  for (const k of ["w", "a", "s", "d"]) input.release(k);
}

function steerToward(input: MemoryInput, px: number, py: number, tx: number, ty: number): void {
  releaseMove(input);
  const dx = tx - px;
  const dy = ty - py;
  if (Math.abs(dx) > 0.05) {
    if (dx > 0) input.hold("d");
    else input.hold("a");
  }
  if (Math.abs(dy) > 0.05) {
    if (dy > 0) input.hold("s");
    else input.hold("w");
  }
}

export function autoplay(seed: number, maxFrames = 60 * 180): {
  frames: number;
  state: string;
  floor: number;
  stuck: boolean;
  hp: number;
  kills: number;
  gold: number;
  keys: number;
} {
  const input = new MemoryInput();
  const game = new Game(input, { seed });
  game.startNewGame();

  let stuckFrames = 0;
  let lastX = game.player.x;
  let lastY = game.player.y;
  let lastFloor = game.floor;

  for (let frame = 0; frame < maxFrames; frame++) {
    if (game.state === "won" || game.state === "dead") {
      return {
        frames: frame,
        state: game.state,
        floor: game.floor,
        stuck: false,
        hp: game.player.hp,
        kills: game.killCount,
        gold: game.player.gold,
        keys: game.player.keys,
      };
    }

    if (game.state === "playing") {
      if (game.floor !== lastFloor) {
        lastFloor = game.floor;
        stuckFrames = 0;
      }

      const p = game.player;
      const boss = game.enemies.find((e) => e.alive && e.kind === "brute" && e.maxHp >= 100);
      const nearby = game.enemies
        .filter((e) => e.alive && dist(p.x, p.y, e.x, e.y) < 1.5)
        .sort((a, b) => dist(p.x, p.y, a.x, a.y) - dist(p.x, p.y, b.x, b.y));

      const lowHp = p.hp / p.maxHp < 0.5;
      const potion = lowHp
        ? game.items
            .filter((i) => !i.taken && i.kind === "potion")
            .sort((a, b) => dist(p.x, p.y, a.x, a.y) - dist(p.x, p.y, b.x, b.y))[0]
        : undefined;

      let goal: Vec;
      if (boss) goal = { x: boss.x, y: boss.y };
      else if (potion) goal = { x: potion.x, y: potion.y };
      else goal = { x: game.dungeon.stairs.x + 0.5, y: game.dungeon.stairs.y + 0.5 };

      const path = bfs(game.dungeon, { x: p.x, y: p.y }, goal);

      releaseMove(input);
      input.release(" ");
      input.releaseMouse();

      if (nearby[0]) {
        input.mouse.x = nearby[0].x * TILE - game.cam.x;
        input.mouse.y = nearby[0].y * TILE - game.cam.y;
        input.click();
        if (dist(p.x, p.y, nearby[0].x, nearby[0].y) < 0.9) {
          // kite slightly while attacking
          steerToward(input, p.x, p.y, p.x - (nearby[0].x - p.x), p.y - (nearby[0].y - p.y));
        } else {
          steerToward(input, p.x, p.y, nearby[0].x, nearby[0].y);
        }
      } else if (path && path.length >= 2) {
        const next = path[1]!;
        steerToward(input, p.x, p.y, next.x + 0.5, next.y + 0.5);
      } else {
        steerToward(input, p.x, p.y, goal.x, goal.y);
      }

      if (Math.hypot(p.x - lastX, p.y - lastY) < 0.002) stuckFrames += 1;
      else {
        stuckFrames = 0;
        lastX = p.x;
        lastY = p.y;
      }
      if (stuckFrames > 240) {
        return {
          frames: frame,
          state: game.state,
          floor: game.floor,
          stuck: true,
          hp: p.hp,
          kills: game.killCount,
          gold: game.player.gold,
          keys: game.player.keys,
        };
      }
    }

    game.update(DT);
  }

  return {
    frames: maxFrames,
    state: game.state,
    floor: game.floor,
    stuck: stuckFrames > 240,
    hp: game.player.hp,
    kills: game.killCount,
    gold: game.player.gold,
    keys: game.player.keys,
  };
}

describe("autoplay", () => {
  it("can clear seed 42 without getting stuck", () => {
    const result = autoplay(42);
    expect(result.stuck).toBe(false);
    expect(result.state).toBe("won");
    expect(result.floor).toBe(5);
  });
});
