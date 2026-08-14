import {
  ENEMY_STATS,
  FINAL_FLOOR,
  MAP_H,
  MAP_W,
  TILE,
  Tile,
  VIEW_H,
  VIEW_W,
} from "./core";
import type { Game } from "./game";

const COLORS = {
  void: "#070908",
  wall: "#1c2420",
  wallHi: "#2a3530",
  wallEdge: "#0f1412",
  floor: "#2a322c",
  floorAlt: "#24302a",
  floorLit: "#354038",
  fog: "rgba(6, 8, 7, 0.72)",
  explored: "rgba(12, 16, 14, 0.45)",
  ember: "#e07a3a",
  ink: "#d8c9a8",
  moss: "#6a8f6b",
  blood: "#c44536",
  gold: "#e8c547",
  player: "#f0e6d0",
  accent: "#8fad7a",
};

function hash(x: number, y: number): number {
  let n = x * 374761393 + y * 668265263;
  n = (n ^ (n >> 13)) * 1274126177;
  return ((n ^ (n >> 16)) >>> 0) / 4294967296;
}

export class Renderer {
  constructor(private ctx: CanvasRenderingContext2D) {}

  draw(game: Game): void {
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = COLORS.void;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    if (game.state === "title") {
      this.drawTitle(game);
      return;
    }

    ctx.save();
    ctx.translate(-Math.floor(game.cam.x), -Math.floor(game.cam.y));
    this.drawMap(game);
    this.drawItems(game);
    this.drawStairsGlow(game);
    this.drawEnemies(game);
    this.drawPlayer(game);
    this.drawParticles(game);
    this.drawFloats(game);
    ctx.restore();

    this.drawVignette(game);
    this.drawHud(game);
    this.drawMinimap(game);
    this.drawMessages(game);

    if (game.state === "paused") this.drawOverlay("Paused", "Press Esc to resume");
    if (game.state === "dead") {
      this.drawOverlay("You Died", `Floor ${game.floor}  ·  ${game.killCount} slain  ·  Enter to continue`);
    }
    if (game.state === "won") {
      this.drawOverlay("Crypt Cleared", `Ashen Key claimed  ·  ${game.player.gold} gold  ·  Enter`);
    }
    if (game.state === "descending") {
      this.drawOverlay("Descending...", `Entering floor ${game.floor + 1}`);
    }
  }

  private drawTitle(game: Game): void {
    const ctx = this.ctx;
    const t = game.titlePulse;

    // Atmospheric backdrop tiles
    for (let i = 0; i < 40; i++) {
      const x = (hash(i, 1) * VIEW_W + Math.sin(t * 0.3 + i) * 20) % VIEW_W;
      const y = (hash(i, 2) * VIEW_H + Math.cos(t * 0.2 + i) * 15) % VIEW_H;
      ctx.fillStyle = `rgba(224, 122, 58, ${0.03 + hash(i, 3) * 0.06})`;
      ctx.beginPath();
      ctx.arc(x, y, 20 + hash(i, 4) * 40, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = "rgba(10, 12, 11, 0.55)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.ember;
    ctx.font = "700 18px Cinzel, serif";
    ctx.fillText("A CURSOR DEMO", VIEW_W / 2, 150);

    const pulse = 0.85 + Math.sin(t * 2) * 0.15;
    ctx.fillStyle = COLORS.ink;
    ctx.globalAlpha = pulse;
    ctx.font = "700 54px Cinzel, serif";
    ctx.fillText("Crypt of Ashen Keys", VIEW_W / 2, 230);
    ctx.globalAlpha = 1;

    ctx.fillStyle = COLORS.accent;
    ctx.font = "400 15px IBM Plex Mono, monospace";
    ctx.fillText("Slash through five floors. Descend. Survive.", VIEW_W / 2, 275);

    // Fake dungeon strip
    this.drawTitleDungeonStrip(t);

    ctx.fillStyle = COLORS.ink;
    ctx.font = "600 14px IBM Plex Mono, monospace";
    const blink = Math.sin(t * 3) > 0 ? 1 : 0.35;
    ctx.globalAlpha = blink;
    ctx.fillText("Press Enter / Space / Click to begin", VIEW_W / 2, 520);
    ctx.globalAlpha = 1;

    ctx.fillStyle = "rgba(216, 201, 168, 0.55)";
    ctx.font = "400 12px IBM Plex Mono, monospace";
    ctx.fillText("WASD move  ·  Mouse / Space attack  ·  Esc pause", VIEW_W / 2, 555);
  }

  private drawTitleDungeonStrip(t: number): void {
    const ctx = this.ctx;
    const y0 = 330;
    const size = 18;
    for (let i = 0; i < 28; i++) {
      const x = 180 + i * size;
      const wall = hash(i, 7) > 0.65;
      ctx.fillStyle = wall ? COLORS.wall : COLORS.floor;
      ctx.fillRect(x, y0, size - 1, size - 1);
      if (!wall && hash(i, 8) > 0.8) {
        ctx.fillStyle = COLORS.ember;
        ctx.globalAlpha = 0.5 + Math.sin(t * 4 + i) * 0.3;
        ctx.fillRect(x + 6, y0 + 6, 5, 5);
        ctx.globalAlpha = 1;
      }
      if (!wall && i === 10) {
        ctx.fillStyle = COLORS.player;
        ctx.beginPath();
        ctx.arc(x + size / 2, y0 + size / 2, 5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!wall && i === 18) {
        ctx.fillStyle = "#6a8f6b";
        ctx.beginPath();
        ctx.arc(x + size / 2, y0 + size / 2, 5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private drawMap(game: Game): void {
    const { dungeon, cam } = game;
    const ctx = this.ctx;
    const startX = Math.max(0, Math.floor(cam.x / TILE) - 1);
    const startY = Math.max(0, Math.floor(cam.y / TILE) - 1);
    const endX = Math.min(MAP_W, Math.ceil((cam.x + VIEW_W) / TILE) + 1);
    const endY = Math.min(MAP_H, Math.ceil((cam.y + VIEW_H) / TILE) + 1);

    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const explored = dungeon.explored[y][x];
        const visible = dungeon.visible[y][x];
        if (!explored) continue;

        const tile = dungeon.tiles[y][x];
        const px = x * TILE;
        const py = y * TILE;

        if (tile === Tile.Wall) {
          ctx.fillStyle = COLORS.wall;
          ctx.fillRect(px, py, TILE, TILE);
          // bevel
          ctx.fillStyle = COLORS.wallHi;
          ctx.fillRect(px, py, TILE, 3);
          ctx.fillStyle = COLORS.wallEdge;
          ctx.fillRect(px, py + TILE - 3, TILE, 3);
          if (hash(x, y) > 0.85) {
            ctx.fillStyle = "rgba(106, 143, 107, 0.25)";
            ctx.fillRect(px + 8, py + 10, 6, 4);
          }
        } else {
          const alt = hash(x, y) > 0.5;
          ctx.fillStyle = alt ? COLORS.floor : COLORS.floorAlt;
          ctx.fillRect(px, py, TILE, TILE);
          if (hash(x + 3, y + 1) > 0.92) {
            ctx.fillStyle = "rgba(0,0,0,0.15)";
            ctx.fillRect(px + 4, py + 4, 8, 6);
          }
          if (tile === Tile.Stairs) {
            ctx.fillStyle = COLORS.ember;
            ctx.globalAlpha = 0.35 + Math.sin(game.time * 3) * 0.1;
            ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
            ctx.globalAlpha = 1;
            ctx.strokeStyle = COLORS.ember;
            ctx.lineWidth = 2;
            ctx.strokeRect(px + 8, py + 8, TILE - 16, TILE - 16);
            ctx.beginPath();
            ctx.moveTo(px + 12, py + 20);
            ctx.lineTo(px + 20, py + 12);
            ctx.lineTo(px + 20, py + 20);
            ctx.closePath();
            ctx.fillStyle = COLORS.ember;
            ctx.fill();
          }
        }

        if (!visible) {
          ctx.fillStyle = explored ? COLORS.explored : COLORS.fog;
          ctx.fillRect(px, py, TILE, TILE);
        } else if (tile !== Tile.Wall) {
          // soft torch light near player
          const dx = x + 0.5 - game.player.x;
          const dy = y + 0.5 - game.player.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 25) {
            ctx.fillStyle = `rgba(224, 122, 58, ${0.06 * (1 - d2 / 25)})`;
            ctx.fillRect(px, py, TILE, TILE);
          }
        }
      }
    }
  }

  private drawStairsGlow(game: Game): void {
    const s = game.dungeon.stairs;
    if (!game.dungeon.visible[s.y]?.[s.x]) return;
    const ctx = this.ctx;
    const px = s.x * TILE + TILE / 2;
    const py = s.y * TILE + TILE / 2;
    const g = ctx.createRadialGradient(px, py, 4, px, py, 48);
    g.addColorStop(0, "rgba(224,122,58,0.35)");
    g.addColorStop(1, "rgba(224,122,58,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, 48, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawItems(game: Game): void {
    const ctx = this.ctx;
    for (const item of game.items) {
      if (item.taken) continue;
      const tx = Math.floor(item.x);
      const ty = Math.floor(item.y);
      if (!game.dungeon.visible[ty]?.[tx]) continue;

      const px = item.x * TILE;
      const py = item.y * TILE + Math.sin(game.time * 4 + item.id) * 2;
      const bob = Math.sin(game.time * 3 + item.id) * 1.5;

      switch (item.kind) {
        case "gold":
          ctx.fillStyle = COLORS.gold;
          ctx.beginPath();
          ctx.arc(px, py + bob, 5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#fff3b0";
          ctx.fillRect(px - 2, py + bob - 3, 2, 2);
          break;
        case "potion":
          ctx.fillStyle = COLORS.moss;
          ctx.fillRect(px - 4, py - 6 + bob, 8, 10);
          ctx.fillStyle = "#9bc49c";
          ctx.fillRect(px - 2, py - 8 + bob, 4, 3);
          break;
        case "heart":
          ctx.fillStyle = COLORS.blood;
          ctx.beginPath();
          ctx.arc(px - 3, py - 2 + bob, 4, 0, Math.PI * 2);
          ctx.arc(px + 3, py - 2 + bob, 4, 0, Math.PI * 2);
          ctx.moveTo(px - 7, py - 1 + bob);
          ctx.lineTo(px, py + 7 + bob);
          ctx.lineTo(px + 7, py - 1 + bob);
          ctx.fill();
          break;
        case "sword":
          ctx.strokeStyle = COLORS.ink;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(px - 6, py + 6 + bob);
          ctx.lineTo(px + 6, py - 6 + bob);
          ctx.stroke();
          ctx.fillStyle = COLORS.ember;
          ctx.fillRect(px - 5, py + 3 + bob, 6, 3);
          break;
        case "key":
          ctx.fillStyle = COLORS.ember;
          ctx.beginPath();
          ctx.arc(px - 2, py - 2 + bob, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillRect(px, py - 1 + bob, 8, 2);
          break;
      }
    }
  }

  private drawEnemies(game: Game): void {
    const ctx = this.ctx;
    for (const e of game.enemies) {
      if (!e.alive) continue;
      const tx = Math.floor(e.x);
      const ty = Math.floor(e.y);
      if (!game.dungeon.visible[ty]?.[tx]) continue;

      const px = e.x * TILE;
      const py = e.y * TILE;
      const stats = ENEMY_STATS[e.kind];
      const flash = e.flash > 0;

      ctx.save();
      if (flash) ctx.globalAlpha = 0.7;

      if (e.kind === "slime") {
        ctx.fillStyle = flash ? "#fff" : stats.color;
        ctx.beginPath();
        ctx.ellipse(px, py + 2, stats.radius, stats.radius * 0.75, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#0a0c0b";
        ctx.fillRect(px - 4, py - 2, 2, 3);
        ctx.fillRect(px + 2, py - 2, 2, 3);
      } else if (e.kind === "bat") {
        const flap = Math.sin(game.time * 12 + e.id) * 4;
        ctx.fillStyle = flash ? "#fff" : stats.color;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px - 12, py - 6 + flap, px - 14, py + 2);
        ctx.quadraticCurveTo(px - 6, py, px, py);
        ctx.quadraticCurveTo(px + 6, py, px + 14, py + 2);
        ctx.quadraticCurveTo(px + 12, py - 6 - flap, px, py);
        ctx.fill();
        ctx.fillStyle = "#0a0c0b";
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === "skeleton") {
        ctx.fillStyle = flash ? "#fff" : stats.color;
        ctx.beginPath();
        ctx.arc(px, py - 4, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(px - 5, py + 2, 10, 12);
        ctx.fillStyle = "#0a0c0b";
        ctx.fillRect(px - 4, py - 5, 2, 2);
        ctx.fillRect(px + 2, py - 5, 2, 2);
      } else {
        // brute
        ctx.fillStyle = flash ? "#fff" : stats.color;
        ctx.fillRect(px - 12, py - 10, 24, 24);
        ctx.fillStyle = "#2a1010";
        ctx.fillRect(px - 6, py - 4, 4, 4);
        ctx.fillRect(px + 2, py - 4, 4, 4);
        ctx.fillStyle = "#e07a3a";
        ctx.fillRect(px - 5, py + 6, 10, 3);
      }

      // HP bar
      if (e.hp < e.maxHp) {
        const bw = 20;
        ctx.fillStyle = "#0a0c0b";
        ctx.fillRect(px - bw / 2, py - stats.radius - 10, bw, 4);
        ctx.fillStyle = COLORS.blood;
        ctx.fillRect(px - bw / 2, py - stats.radius - 10, bw * (e.hp / e.maxHp), 4);
      }
      ctx.restore();
    }
  }

  private drawPlayer(game: Game): void {
    const p = game.player;
    const ctx = this.ctx;
    const px = p.x * TILE;
    const py = p.y * TILE;

    // shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(px, py + 10, 9, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // attack arc
    if (game.attackSwing > 0) {
      const a = Math.atan2(p.facing.y, p.facing.x);
      const spread = 0.7;
      ctx.fillStyle = `rgba(224, 122, 58, ${game.attackSwing * 2})`;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.arc(px, py, 36, a - spread, a + spread);
      ctx.closePath();
      ctx.fill();
    }

    const flash = p.flash > 0;
    ctx.fillStyle = flash ? "#fff" : COLORS.player;
    ctx.beginPath();
    ctx.arc(px, py, 10, 0, Math.PI * 2);
    ctx.fill();

    // cloak accent
    ctx.fillStyle = COLORS.ember;
    ctx.beginPath();
    ctx.arc(px, py + 2, 10, 0.2, Math.PI - 0.2);
    ctx.fill();

    // facing eye
    ctx.fillStyle = "#0a0c0b";
    ctx.beginPath();
    ctx.arc(px + p.facing.x * 4, py + p.facing.y * 4 - 1, 2.2, 0, Math.PI * 2);
    ctx.fill();

    if (p.invuln > 0 && Math.floor(game.time * 20) % 2 === 0) {
      ctx.strokeStyle = "rgba(240,230,208,0.5)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, 13, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  private drawParticles(game: Game): void {
    const ctx = this.ctx;
    for (const pt of game.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x * TILE, pt.y * TILE, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
  }

  private drawFloats(game: Game): void {
    const ctx = this.ctx;
    ctx.textAlign = "center";
    ctx.font = "600 12px IBM Plex Mono, monospace";
    for (const f of game.floats) {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x * TILE, f.y * TILE);
    }
    ctx.globalAlpha = 1;
  }

  private drawVignette(game: Game): void {
    const ctx = this.ctx;
    const g = ctx.createRadialGradient(
      VIEW_W / 2,
      VIEW_H / 2,
      VIEW_H * 0.25,
      VIEW_W / 2,
      VIEW_H / 2,
      VIEW_H * 0.75,
    );
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // hurt flash
    if (game.player.flash > 0 && game.state === "playing") {
      ctx.fillStyle = `rgba(196, 69, 54, ${game.player.flash})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  private drawHud(game: Game): void {
    const ctx = this.ctx;
    const p = game.player;

    // Left panel
    ctx.fillStyle = "rgba(10, 12, 11, 0.72)";
    ctx.fillRect(12, 12, 260, 86);
    ctx.strokeStyle = "rgba(216, 201, 168, 0.2)";
    ctx.strokeRect(12.5, 12.5, 259, 85);

    ctx.fillStyle = COLORS.ink;
    ctx.font = "600 12px IBM Plex Mono, monospace";
    ctx.textAlign = "left";
    ctx.fillText(`HP`, 24, 34);
    this.bar(24, 40, 180, 10, p.hp / p.maxHp, COLORS.blood, `${p.hp}/${p.maxHp}`);

    ctx.fillStyle = COLORS.ink;
    ctx.fillText(`XP`, 24, 68);
    const need = 20 + p.level * 18;
    this.bar(24, 74, 180, 8, p.xp / need, COLORS.ember, `Lv ${p.level}`);

    // Right stats
    ctx.fillStyle = "rgba(10, 12, 11, 0.72)";
    ctx.fillRect(VIEW_W - 200, 12, 188, 86);
    ctx.strokeStyle = "rgba(216, 201, 168, 0.2)";
    ctx.strokeRect(VIEW_W - 199.5, 12.5, 187, 85);

    ctx.textAlign = "left";
    ctx.fillStyle = COLORS.gold;
    ctx.font = "600 13px IBM Plex Mono, monospace";
    ctx.fillText(`◈ ${p.gold} gold`, VIEW_W - 184, 36);
    ctx.fillStyle = COLORS.ink;
    ctx.fillText(`⚔ ${p.damage} atk`, VIEW_W - 184, 58);
    ctx.fillStyle = COLORS.ember;
    ctx.fillText(`Floor ${game.floor}/${FINAL_FLOOR}`, VIEW_W - 184, 80);
  }

  private bar(
    x: number,
    y: number,
    w: number,
    h: number,
    ratio: number,
    color: string,
    label: string,
  ): void {
    const ctx = this.ctx;
    ctx.fillStyle = "#0a0c0b";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.max(0, w * Math.min(1, ratio)), h);
    ctx.fillStyle = COLORS.ink;
    ctx.font = "600 10px IBM Plex Mono, monospace";
    ctx.textAlign = "left";
    ctx.fillText(label, x + w + 8, y + h - 1);
  }

  private drawMinimap(game: Game): void {
    const ctx = this.ctx;
    const scale = 3;
    const mw = MAP_W * scale;
    const mh = MAP_H * scale;
    const ox = VIEW_W - mw - 16;
    const oy = VIEW_H - mh - 16;

    ctx.fillStyle = "rgba(10, 12, 11, 0.8)";
    ctx.fillRect(ox - 4, oy - 4, mw + 8, mh + 8);

    for (let y = 0; y < MAP_H; y++) {
      for (let x = 0; x < MAP_W; x++) {
        if (!game.dungeon.explored[y][x]) continue;
        const t = game.dungeon.tiles[y][x];
        if (t === Tile.Wall) ctx.fillStyle = "#2a3530";
        else if (t === Tile.Stairs) ctx.fillStyle = COLORS.ember;
        else ctx.fillStyle = game.dungeon.visible[y][x] ? "#4a5a50" : "#303830";
        ctx.fillRect(ox + x * scale, oy + y * scale, scale, scale);
      }
    }

    ctx.fillStyle = COLORS.player;
    ctx.fillRect(
      ox + Math.floor(game.player.x) * scale,
      oy + Math.floor(game.player.y) * scale,
      scale,
      scale,
    );

    for (const e of game.enemies) {
      if (!e.alive) continue;
      const tx = Math.floor(e.x);
      const ty = Math.floor(e.y);
      if (!game.dungeon.visible[ty]?.[tx]) continue;
      ctx.fillStyle = COLORS.blood;
      ctx.fillRect(ox + tx * scale, oy + ty * scale, scale, scale);
    }
  }

  private drawMessages(game: Game): void {
    const ctx = this.ctx;
    ctx.textAlign = "left";
    ctx.font = "400 12px IBM Plex Mono, monospace";
    let y = VIEW_H - 28;
    for (const m of game.messages) {
      ctx.globalAlpha = Math.min(1, m.life);
      ctx.fillStyle = "rgba(10,12,11,0.65)";
      const w = ctx.measureText(m.text).width + 16;
      ctx.fillRect(16, y - 12, w, 18);
      ctx.fillStyle = COLORS.ink;
      ctx.fillText(m.text, 24, y);
      y -= 22;
    }
    ctx.globalAlpha = 1;
  }

  private drawOverlay(title: string, sub: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = "rgba(7, 9, 8, 0.72)";
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.textAlign = "center";
    ctx.fillStyle = COLORS.ink;
    ctx.font = "700 42px Cinzel, serif";
    ctx.fillText(title, VIEW_W / 2, VIEW_H / 2 - 10);
    ctx.fillStyle = COLORS.accent;
    ctx.font = "400 14px IBM Plex Mono, monospace";
    ctx.fillText(sub, VIEW_W / 2, VIEW_H / 2 + 28);
  }
}
