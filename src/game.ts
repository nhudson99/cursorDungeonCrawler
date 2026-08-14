import {
  generateDungeon,
  randomFloorInRooms,
  tileAt,
  updateVisibility,
  walkable,
  type Dungeon,
} from "./dungeon";
import { Input } from "./input";
import {
  ENEMY_STATS,
  MAP_H,
  MAP_W,
  TILE,
  Tile,
  type Enemy,
  type EnemyKind,
  type FloatingText,
  type GameState,
  type Item,
  type ItemKind,
  type Message,
  type Particle,
  type Player,
} from "./types";

let nextId = 1;
const id = () => nextId++;

const FINAL_FLOOR = 5;
const PLAYER_SPEED = 110;
const ATTACK_RANGE = 1.15;
const ATTACK_ARC = Math.PI * 0.7;
const PLAYER_RADIUS = 0.28;

function dist(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.hypot(dx, dy);
}

function xpToLevel(level: number): number {
  return 20 + level * 18;
}

export class Game {
  state: GameState = "title";
  floor = 1;
  dungeon!: Dungeon;
  player!: Player;
  enemies: Enemy[] = [];
  items: Item[] = [];
  particles: Particle[] = [];
  floats: FloatingText[] = [];
  messages: Message[] = [];
  cam = { x: 0, y: 0 };
  time = 0;
  descendTimer = 0;
  attackSwing = 0;
  titlePulse = 0;
  killCount = 0;
  private input: Input;

  constructor(canvas: HTMLCanvasElement) {
    this.input = new Input(canvas);
  }

  startNewGame(): void {
    this.floor = 1;
    this.killCount = 0;
    this.player = {
      x: 0,
      y: 0,
      hp: 100,
      maxHp: 100,
      damage: 12,
      gold: 0,
      keys: 0,
      xp: 0,
      level: 1,
      attackCd: 0,
      invuln: 0,
      facing: { x: 1, y: 0 },
      flash: 0,
    };
    this.loadFloor();
    this.state = "playing";
    this.pushMsg("The crypt opens. Find the stairs.");
  }

  private loadFloor(): void {
    this.dungeon = generateDungeon(this.floor);
    this.player.x = this.dungeon.spawn.x + 0.5;
    this.player.y = this.dungeon.spawn.y + 0.5;
    this.enemies = [];
    this.items = [];
    this.particles = [];
    this.floats = [];
    this.spawnEntities();
    updateVisibility(this.dungeon, this.player.x, this.player.y);
    this.cam.x = this.player.x * TILE - 480;
    this.cam.y = this.player.y * TILE - 320;
    this.pushMsg(`Floor ${this.floor} of ${FINAL_FLOOR}`);
  }

  private spawnEntities(): void {
    const enemyBudget = 6 + this.floor * 3;
    const kinds: EnemyKind[] =
      this.floor >= 4
        ? ["slime", "bat", "skeleton", "brute"]
        : this.floor >= 3
          ? ["slime", "bat", "skeleton"]
          : this.floor >= 2
            ? ["slime", "bat"]
            : ["slime"];

    for (let i = 0; i < enemyBudget; i++) {
      const pos = randomFloorInRooms(this.dungeon, this.dungeon.spawn, 5);
      if (!pos) break;
      const kind = kinds[Math.floor(Math.random() * kinds.length)];
      const stats = ENEMY_STATS[kind];
      const scale = 1 + (this.floor - 1) * 0.12;
      this.enemies.push({
        id: id(),
        kind,
        x: pos.x,
        y: pos.y,
        hp: Math.round(stats.hp * scale),
        maxHp: Math.round(stats.hp * scale),
        speed: stats.speed,
        damage: Math.round(stats.damage * scale),
        xp: Math.round(stats.xp * scale),
        attackCd: 0,
        flash: 0,
        alive: true,
      });
    }

    // Boss on final floor
    if (this.floor === FINAL_FLOOR) {
      const pos = {
        x: this.dungeon.stairs.x + 0.5,
        y: this.dungeon.stairs.y + 0.5,
      };
      // Move stairs spawn enemy nearby, keep stairs
      const bossPos =
        randomFloorInRooms(this.dungeon, this.dungeon.spawn, 8) ?? pos;
      this.enemies.push({
        id: id(),
        kind: "brute",
        x: bossPos.x,
        y: bossPos.y,
        hp: 140,
        maxHp: 140,
        speed: 42,
        damage: 22,
        xp: 80,
        attackCd: 0,
        flash: 0,
        alive: true,
      });
      this.pushMsg("A crypt guardian stirs...");
    }

    const itemCount = 5 + this.floor;
    const kindsPool: ItemKind[] = [
      "potion",
      "potion",
      "gold",
      "gold",
      "gold",
      "heart",
      "sword",
      "key",
    ];
    for (let i = 0; i < itemCount; i++) {
      const pos = randomFloorInRooms(this.dungeon, this.dungeon.spawn, 2);
      if (!pos) break;
      const kind = kindsPool[Math.floor(Math.random() * kindsPool.length)];
      const value =
        kind === "gold"
          ? 5 + Math.floor(Math.random() * 12) + this.floor * 2
          : kind === "potion"
            ? 25
            : kind === "heart"
              ? 15
              : kind === "sword"
                ? 3
                : 1;
      this.items.push({ id: id(), kind, x: pos.x, y: pos.y, value, taken: false });
    }
  }

  pushMsg(text: string): void {
    this.messages.unshift({ text, life: 3.5 });
    if (this.messages.length > 5) this.messages.length = 5;
  }

  private float(x: number, y: number, text: string, color: string): void {
    this.floats.push({ x, y, text, color, life: 0.9, vy: -28 });
  }

  private burst(
    x: number,
    y: number,
    color: string,
    count: number,
    speed = 80,
  ): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.3 + Math.random() * 0.7);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.25 + Math.random() * 0.35,
        maxLife: 0.6,
        color,
        size: 1.5 + Math.random() * 2.5,
      });
    }
  }

  update(dt: number): void {
    this.time += dt;
    this.titlePulse += dt;

    if (this.state === "title") {
      if (
        this.input.justPressed("enter") ||
        this.input.justPressed(" ") ||
        this.input.mouse.clicked
      ) {
        this.startNewGame();
      }
      this.input.endFrame();
      return;
    }

    if (this.state === "dead" || this.state === "won") {
      if (
        this.input.justPressed("enter") ||
        this.input.justPressed("r") ||
        this.input.mouse.clicked
      ) {
        this.state = "title";
      }
      this.input.endFrame();
      return;
    }

    if (this.state === "descending") {
      this.descendTimer -= dt;
      if (this.descendTimer <= 0) {
        this.floor += 1;
        if (this.floor > FINAL_FLOOR) {
          this.state = "won";
        } else {
          this.loadFloor();
          this.state = "playing";
        }
      }
      this.input.endFrame();
      return;
    }

    if (this.input.justPressed("escape") || this.input.justPressed("p")) {
      this.state = this.state === "paused" ? "playing" : "paused";
    }

    if (this.state === "paused") {
      this.input.endFrame();
      return;
    }

    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.updateItems();
    this.updateFx(dt);
    updateVisibility(this.dungeon, this.player.x, this.player.y);

    const targetCamX = this.player.x * TILE - 480;
    const targetCamY = this.player.y * TILE - 320;
    this.cam.x += (targetCamX - this.cam.x) * Math.min(1, dt * 6);
    this.cam.y += (targetCamY - this.cam.y) * Math.min(1, dt * 6);

    // Stairs
    if (tileAt(this.dungeon, this.player.x, this.player.y) === Tile.Stairs) {
      if (this.floor >= FINAL_FLOOR) {
        const bossesAlive = this.enemies.some(
          (e) => e.alive && e.kind === "brute" && e.maxHp >= 100,
        );
        if (!bossesAlive) {
          this.state = "won";
          this.pushMsg("You claim the Ashen Key.");
        } else if (!this.messages.some((m) => m.text.includes("guardian"))) {
          this.pushMsg("Defeat the guardian first!");
        }
      } else {
        this.state = "descending";
        this.descendTimer = 0.85;
        this.pushMsg("Descending...");
        this.burst(this.player.x, this.player.y, "#e07a3a", 24, 100);
      }
    }

    this.input.endFrame();
  }

  private tryMove(nx: number, ny: number): void {
    const r = PLAYER_RADIUS;
    // Separate axis resolution
    if (
      walkable(this.dungeon, nx - r, this.player.y - r) &&
      walkable(this.dungeon, nx + r, this.player.y - r) &&
      walkable(this.dungeon, nx - r, this.player.y + r) &&
      walkable(this.dungeon, nx + r, this.player.y + r)
    ) {
      this.player.x = nx;
    }
    if (
      walkable(this.dungeon, this.player.x - r, ny - r) &&
      walkable(this.dungeon, this.player.x + r, ny - r) &&
      walkable(this.dungeon, this.player.x - r, ny + r) &&
      walkable(this.dungeon, this.player.x + r, ny + r)
    ) {
      this.player.y = ny;
    }
  }

  private updatePlayer(dt: number): void {
    const p = this.player;
    p.attackCd = Math.max(0, p.attackCd - dt);
    p.invuln = Math.max(0, p.invuln - dt);
    p.flash = Math.max(0, p.flash - dt);
    this.attackSwing = Math.max(0, this.attackSwing - dt);

    const axis = this.input.axis();
    if (axis.x !== 0 || axis.y !== 0) {
      p.facing = { x: axis.x, y: axis.y };
      const speed = PLAYER_SPEED / TILE;
      this.tryMove(p.x + axis.x * speed * dt, p.y + axis.y * speed * dt);
    }

    // Face mouse when attacking / holding aim
    const worldMx = (this.input.mouse.x + this.cam.x) / TILE;
    const worldMy = (this.input.mouse.y + this.cam.y) / TILE;
    const aimDx = worldMx - p.x;
    const aimDy = worldMy - p.y;
    if (this.input.mouse.down || this.input.down(" ")) {
      const len = Math.hypot(aimDx, aimDy) || 1;
      p.facing = { x: aimDx / len, y: aimDy / len };
    }

    const wantAttack =
      this.input.justPressed(" ") ||
      this.input.mouse.clicked ||
      (this.input.mouse.down && p.attackCd <= 0);

    if (wantAttack && p.attackCd <= 0) {
      this.doAttack();
    }
  }

  private doAttack(): void {
    const p = this.player;
    p.attackCd = 0.32;
    this.attackSwing = 0.18;
    const angle = Math.atan2(p.facing.y, p.facing.x);
    let hit = false;

    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = dist(p.x, p.y, e.x, e.y);
      if (d > ATTACK_RANGE + ENEMY_STATS[e.kind].radius / TILE) continue;
      const ea = Math.atan2(e.y - p.y, e.x - p.x);
      let da = Math.abs(ea - angle);
      while (da > Math.PI) da = Math.abs(da - Math.PI * 2);
      if (da > ATTACK_ARC / 2) continue;

      const dmg = p.damage + Math.floor(Math.random() * 5) - 2;
      e.hp -= dmg;
      e.flash = 0.15;
      hit = true;
      this.float(e.x, e.y - 0.4, `-${dmg}`, "#e8d5a3");
      this.burst(e.x, e.y, "#c44536", 8, 70);

      if (e.hp <= 0) {
        e.alive = false;
        this.killCount += 1;
        this.grantXp(e.xp);
        this.burst(e.x, e.y, ENEMY_STATS[e.kind].color, 16, 90);
        if (Math.random() < 0.35) {
          this.items.push({
            id: id(),
            kind: Math.random() < 0.5 ? "gold" : "potion",
            x: e.x,
            y: e.y,
            value: Math.random() < 0.5 ? 8 + this.floor * 2 : 20,
            taken: false,
          });
        }
      }
    }

    if (!hit) {
      this.burst(
        p.x + p.facing.x * 0.6,
        p.y + p.facing.y * 0.6,
        "#d8c9a8",
        4,
        40,
      );
    }
  }

  private grantXp(amount: number): void {
    const p = this.player;
    p.xp += amount;
    while (p.xp >= xpToLevel(p.level)) {
      p.xp -= xpToLevel(p.level);
      p.level += 1;
      p.maxHp += 12;
      p.hp = Math.min(p.maxHp, p.hp + 20);
      p.damage += 3;
      this.pushMsg(`Level up! You are level ${p.level}.`);
      this.burst(p.x, p.y, "#e07a3a", 20, 110);
    }
  }

  private updateEnemies(dt: number): void {
    const p = this.player;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      e.attackCd = Math.max(0, e.attackCd - dt);
      e.flash = Math.max(0, e.flash - dt);

      const d = dist(e.x, e.y, p.x, p.y);
      const aggro = 7.5;
      const tx = Math.floor(e.x);
      const ty = Math.floor(e.y);
      const canSee =
        tx >= 0 &&
        ty >= 0 &&
        tx < MAP_W &&
        ty < MAP_H &&
        this.dungeon.visible[ty][tx];

      if (d < aggro && canSee) {
        const angle = Math.atan2(p.y - e.y, p.x - e.x);
        const speed = (e.speed / TILE) * dt;
        // bat wobble
        const wobble =
          e.kind === "bat"
            ? { x: Math.cos(this.time * 8 + e.id) * 0.4 * speed, y: Math.sin(this.time * 6 + e.id) * 0.4 * speed }
            : { x: 0, y: 0 };
        const nx = e.x + Math.cos(angle) * speed + wobble.x;
        const ny = e.y + Math.sin(angle) * speed + wobble.y;
        this.moveEnemy(e, nx, ny);

        const hitRange = 0.55 + ENEMY_STATS[e.kind].radius / TILE * 0.5;
        if (d < hitRange && e.attackCd <= 0 && p.invuln <= 0) {
          e.attackCd = e.kind === "brute" ? 1.1 : 0.75;
          const dmg = e.damage;
          p.hp -= dmg;
          p.invuln = 0.55;
          p.flash = 0.2;
          this.float(p.x, p.y - 0.5, `-${dmg}`, "#c44536");
          this.burst(p.x, p.y, "#c44536", 10, 60);
          if (p.hp <= 0) {
            p.hp = 0;
            this.state = "dead";
            this.pushMsg("You fall in the dark.");
          }
        }
      } else {
        // idle drift
        if (Math.random() < 0.02) {
          const a = Math.random() * Math.PI * 2;
          const nx = e.x + Math.cos(a) * (e.speed / TILE) * dt * 8;
          const ny = e.y + Math.sin(a) * (e.speed / TILE) * dt * 8;
          this.moveEnemy(e, nx, ny);
        }
      }
    }
  }

  private moveEnemy(e: Enemy, nx: number, ny: number): void {
    const r = ENEMY_STATS[e.kind].radius / TILE * 0.6;
    if (
      walkable(this.dungeon, nx - r, e.y) &&
      walkable(this.dungeon, nx + r, e.y)
    ) {
      e.x = nx;
    }
    if (
      walkable(this.dungeon, e.x, ny - r) &&
      walkable(this.dungeon, e.x, ny + r)
    ) {
      e.y = ny;
    }
  }

  private updateItems(): void {
    const p = this.player;
    for (const item of this.items) {
      if (item.taken) continue;
      if (dist(p.x, p.y, item.x, item.y) > 0.55) continue;
      item.taken = true;
      switch (item.kind) {
        case "gold":
          p.gold += item.value;
          this.float(item.x, item.y, `+${item.value}g`, "#e8c547");
          break;
        case "potion":
          p.hp = Math.min(p.maxHp, p.hp + item.value);
          this.float(item.x, item.y, `+${item.value}hp`, "#6a8f6b");
          this.pushMsg("You drink a vial of mosswater.");
          break;
        case "heart":
          p.maxHp += item.value;
          p.hp += item.value;
          this.float(item.x, item.y, `+${item.value} max`, "#c44536");
          this.pushMsg("Your vitality grows.");
          break;
        case "sword":
          p.damage += item.value;
          this.float(item.x, item.y, `+${item.value} atk`, "#d8c9a8");
          this.pushMsg("A sharper blade.");
          break;
        case "key":
          p.keys += 1;
          this.float(item.x, item.y, "+key", "#e07a3a");
          break;
      }
      this.burst(item.x, item.y, "#e8c547", 8, 50);
    }
  }

  private updateFx(dt: number): void {
    for (const pt of this.particles) {
      pt.life -= dt;
      pt.x += (pt.vx / TILE) * dt;
      pt.y += (pt.vy / TILE) * dt;
      pt.vx *= 0.92;
      pt.vy *= 0.92;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    for (const f of this.floats) {
      f.life -= dt;
      f.y += (f.vy / TILE) * dt;
    }
    this.floats = this.floats.filter((f) => f.life > 0);

    for (const m of this.messages) m.life -= dt;
    this.messages = this.messages.filter((m) => m.life > 0);
  }

  getInput(): Input {
    return this.input;
  }
}
