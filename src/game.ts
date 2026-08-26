import {
  applyDamage,
  applyItem,
  applyXp,
  canMeleeHit,
  clampDt,
  contactSeparation,
  createIdFactory,
  createPlayer,
  dist,
  enemyHitRange,
  ENEMY_STATS,
  FINAL_FLOOR,
  generateDungeon,
  hurtPlayer,
  MAP_H,
  MAP_W,
  PLAYER_RADIUS,
  PLAYER_SPEED,
  Rng,
  rollDamage,
  spawnFloorContents,
  stairsOutcome,
  TILE,
  tickPlayerStatus,
  tileAt,
  Tile,
  updateVisibility,
  walkable,
  type Dungeon,
  type Enemy,
  type FloatingText,
  type GameState,
  type IdFactory,
  type Item,
  type Message,
  type Particle,
  type Player,
} from "./core";
import type { GameInput } from "./input";

export type GameOptions = {
  seed?: number;
};

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
  seed: number;
  private readonly lockedSeed?: number;
  private runIndex = 0;
  private suppressHoldAttack = false;
  private rng: Rng;
  private nextId: IdFactory;
  private input: GameInput;

  constructor(input: GameInput, options: GameOptions = {}) {
    this.input = input;
    this.lockedSeed = options.seed;
    this.seed = (options.seed ?? Date.now()) >>> 0 || 0x9e3779b9;
    this.rng = new Rng(this.seed);
    this.nextId = createIdFactory();
  }

  startNewGame(): void {
    this.messages = [];
    if (this.lockedSeed === undefined) {
      this.runIndex += 1;
      this.seed =
        ((Date.now() >>> 0) ^
          Math.imul(this.runIndex, 0x9e3779b9) ^
          Math.imul(this.seed || 1, 0x85ebca6b)) >>>
        0;
      if (this.seed === 0) this.seed = 0x9e3779b9;
    } else {
      this.seed = this.lockedSeed;
    }
    this.floor = 1;
    this.killCount = 0;
    this.nextId = createIdFactory();
    this.player = createPlayer();
    this.attackSwing = 0;
    this.descendTimer = 0;
    this.suppressHoldAttack = true;
    this.loadFloor();
    this.state = "playing";
    this.pushMsg("The crypt opens. Find the stairs.");
  }

  private loadFloor(): void {
    this.messages = [];
    this.rng = new Rng(this.seed + this.floor * 10007);
    this.dungeon = generateDungeon(this.floor, this.rng);
    this.player.x = this.dungeon.spawn.x + 0.5;
    this.player.y = this.dungeon.spawn.y + 0.5;
    const spawned = spawnFloorContents(
      this.dungeon,
      this.floor,
      this.rng,
      this.nextId,
    );
    this.enemies = spawned.enemies;
    this.items = spawned.items;
    this.particles = [];
    this.floats = [];
    if (spawned.bossSpawned) this.pushMsg("A crypt guardian stirs...");
    updateVisibility(this.dungeon, this.player.x, this.player.y);
    this.cam.x = this.player.x * TILE - 480;
    this.cam.y = this.player.y * TILE - 320;
    this.pushMsg(`Floor ${this.floor} of ${FINAL_FLOOR}`);
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
      const a = this.rng.next() * Math.PI * 2;
      const s = speed * (0.3 + this.rng.next() * 0.7);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.25 + this.rng.next() * 0.35,
        maxLife: 0.6,
        color,
        size: 1.5 + this.rng.next() * 2.5,
      });
    }
  }

  update(rawDt: number): void {
    const dt = clampDt(rawDt);
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
        this.messages = [];
        this.state = "title";
      }
      this.input.endFrame();
      return;
    }

    if (this.state === "descending") {
      this.time += dt;
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

    this.time += dt;
    this.updatePlayer(dt);
    this.updateEnemies(dt);
    this.separateFromEnemies();
    this.updateItems();
    this.updateFx(dt);
    updateVisibility(this.dungeon, this.player.x, this.player.y);

    const targetCamX = this.player.x * TILE - 480;
    const targetCamY = this.player.y * TILE - 320;
    this.cam.x += (targetCamX - this.cam.x) * Math.min(1, dt * 6);
    this.cam.y += (targetCamY - this.cam.y) * Math.min(1, dt * 6);

    if (tileAt(this.dungeon, this.player.x, this.player.y) === Tile.Stairs) {
      const outcome = stairsOutcome(this.floor, this.enemies);
      if (outcome === "win") {
        this.state = "won";
        this.pushMsg("You claim the Ashen Key.");
      } else if (outcome === "blocked") {
        if (!this.messages.some((m) => m.text === "Defeat the guardian first!")) {
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
    tickPlayerStatus(p, dt);
    this.attackSwing = Math.max(0, this.attackSwing - dt);

    const axis = this.input.axis();
    if (axis.x !== 0 || axis.y !== 0) {
      const canStep = p.stun <= 0 || this.axisIncreasesEnemyGap(axis);
      if (canStep) {
        p.facing = { x: axis.x, y: axis.y };
        const speed = PLAYER_SPEED / TILE;
        this.tryMove(p.x + axis.x * speed * dt, p.y + axis.y * speed * dt);
      }
    }

    const worldMx = (this.input.mouse.x + this.cam.x) / TILE;
    const worldMy = (this.input.mouse.y + this.cam.y) / TILE;
    const aimDx = worldMx - p.x;
    const aimDy = worldMy - p.y;
    if (this.input.mouse.down) {
      const len = Math.hypot(aimDx, aimDy) || 1;
      p.facing = { x: aimDx / len, y: aimDy / len };
    }

    const holdingAttack = this.input.mouse.down || this.input.down(" ");
    if (this.suppressHoldAttack && !holdingAttack) {
      this.suppressHoldAttack = false;
    }
    const wantAttack =
      !this.suppressHoldAttack &&
      (this.input.justPressed(" ") ||
        this.input.mouse.clicked ||
        (holdingAttack && p.attackCd <= 0));

    if (wantAttack && p.attackCd <= 0) {
      this.doAttack();
    }
  }

  private doAttack(): void {
    const p = this.player;
    p.attackCd = 0.32;
    this.attackSwing = 0.18;
    let hit = false;

    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (!canMeleeHit(p, p.facing, e, e.kind)) continue;

      const dmg = rollDamage(p.damage, this.rng);
      const killed = applyDamage(e, dmg);
      hit = true;
      this.float(e.x, e.y - 0.4, `-${dmg}`, "#e8d5a3");
      this.burst(e.x, e.y, "#c44536", 8, 70);

      if (killed) {
        this.killCount += 1;
        const levels = applyXp(p, e.xp);
        this.burst(e.x, e.y, ENEMY_STATS[e.kind].color, 16, 90);
        if (levels > 0) {
          this.pushMsg(`Level up! You are level ${p.level}.`);
          this.burst(p.x, p.y, "#e07a3a", 20, 110);
        }
        if (this.rng.chance(0.35)) {
          this.items.push({
            id: this.nextId(),
            kind: this.rng.chance(0.5) ? "gold" : "potion",
            x: e.x,
            y: e.y,
            value: this.rng.chance(0.5) ? 8 + this.floor * 2 : 20,
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
        this.dungeon.visible[ty]![tx];

      if (d < aggro && canSee) {
        const angle = Math.atan2(p.y - e.y, p.x - e.x);
        const speed = (e.speed / TILE) * dt;
        const wobble =
          e.kind === "bat"
            ? {
                x: Math.cos(this.time * 8 + e.id) * 0.4 * speed,
                y: Math.sin(this.time * 6 + e.id) * 0.4 * speed,
              }
            : { x: 0, y: 0 };
        const nx = e.x + Math.cos(angle) * speed + wobble.x;
        const ny = e.y + Math.sin(angle) * speed + wobble.y;
        this.stepEnemy(e, nx, ny);

        const reach = dist(e.x, e.y, p.x, p.y);
        const hitRange = enemyHitRange(e.kind);
        if (reach < hitRange && e.attackCd <= 0) {
          const result = hurtPlayer(p, e, e.damage);
          if (!result.hit) continue;
          e.attackCd = e.kind === "brute" ? 1.1 : 0.75;
          this.float(p.x, p.y - 0.5, `-${result.damage}`, "#c44536");
          this.burst(p.x, p.y, "#c44536", 10, 60);
          this.applyHitSeparation(e, result.knockback);
          if (result.died) {
            this.state = "dead";
            this.pushMsg("You fall in the dark.");
          }
        }
      } else if (this.rng.chance(0.02)) {
        const a = this.rng.next() * Math.PI * 2;
        const nx = e.x + Math.cos(a) * (e.speed / TILE) * dt * 8;
        const ny = e.y + Math.sin(a) * (e.speed / TILE) * dt * 8;
        this.moveEnemy(e, nx, ny);
      }
    }
  }

  /** Stun may freeze walking into a foe, but retreat still has to work. */
  private axisIncreasesEnemyGap(axis: { x: number; y: number }): boolean {
    const p = this.player;
    let nearest: Enemy | null = null;
    let best = Infinity;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const d = dist(p.x, p.y, e.x, e.y);
      if (d < best) {
        best = d;
        nearest = e;
      }
    }
    if (!nearest) return true;
    return (
      dist(p.x + axis.x, p.y + axis.y, nearest.x, nearest.y) >
      dist(p.x, p.y, nearest.x, nearest.y)
    );
  }

  /** Step knockback so a wall eats leftover distance instead of the whole shove. */
  private slidePlayer(dx: number, dy: number): void {
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      this.tryMove(this.player.x + dx / steps, this.player.y + dy / steps);
    }
  }

  private slideEnemy(e: Enemy, dx: number, dy: number): void {
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      this.moveEnemy(e, e.x + dx / steps, e.y + dy / steps);
    }
  }

  /**
   * Don't let i-framed chase close back into melee. Overlap is the glue that
   * made knockback look like it never fired.
   */
  private stepEnemy(e: Enemy, nx: number, ny: number): void {
    const p = this.player;
    const ox = e.x;
    const oy = e.y;
    const before = dist(ox, oy, p.x, p.y);
    this.moveEnemy(e, nx, ny);
    if (p.invuln <= 0) return;
    const after = dist(e.x, e.y, p.x, p.y);
    if (after < enemyHitRange(e.kind) && after < before) {
      e.x = ox;
      e.y = oy;
    }
  }

  private applyHitSeparation(e: Enemy, knockback: { x: number; y: number }): void {
    this.slidePlayer(knockback.x, knockback.y);
    this.slideEnemy(e, -knockback.x * 0.6, -knockback.y * 0.6);
    this.breakMeleeOverlap(e);
  }

  private breakMeleeOverlap(e: Enemy): void {
    const p = this.player;
    const minDist = contactSeparation(e.kind);
    const d = dist(p.x, p.y, e.x, e.y);
    if (d >= minDist) return;
    const nx = d < 1e-6 ? -p.facing.x || -1 : (p.x - e.x) / d;
    const ny = d < 1e-6 ? -p.facing.y : (p.y - e.y) / d;
    const push = minDist - Math.max(d, 1e-6);
    this.slidePlayer(nx * push * 0.5, ny * push * 0.5);
    this.slideEnemy(e, -nx * push * 0.5, -ny * push * 0.5);
    const left = minDist - dist(p.x, p.y, e.x, e.y);
    if (left <= 0) return;
    const d2 = dist(p.x, p.y, e.x, e.y);
    const nx2 = d2 < 1e-6 ? nx : (p.x - e.x) / d2;
    const ny2 = d2 < 1e-6 ? ny : (p.y - e.y) / d2;
    this.slideEnemy(e, -nx2 * left, -ny2 * left);
  }

  private separateFromEnemies(): void {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      this.breakMeleeOverlap(e);
    }
  }

  private crowded(e: Enemy, x: number, y: number): boolean {
    for (const other of this.enemies) {
      if (other === e || !other.alive) continue;
      const next = dist(other.x, other.y, x, y);
      if (next >= 0.52) continue;
      const cur = dist(other.x, other.y, e.x, e.y);
      if (next < cur - 0.001) return true;
    }
    return false;
  }

  private moveEnemy(e: Enemy, nx: number, ny: number): void {
    const r = (ENEMY_STATS[e.kind].radius / TILE) * 0.6;
    if (
      walkable(this.dungeon, nx - r, e.y) &&
      walkable(this.dungeon, nx + r, e.y) &&
      !this.crowded(e, nx, e.y)
    ) {
      e.x = nx;
    }
    if (
      walkable(this.dungeon, e.x, ny - r) &&
      walkable(this.dungeon, e.x, ny + r) &&
      !this.crowded(e, e.x, ny)
    ) {
      e.y = ny;
    }
  }

  private updateItems(): void {
    const p = this.player;
    for (const item of this.items) {
      if (item.taken) continue;
      if (item.kind === "potion" && p.hp >= p.maxHp) continue;
      if (dist(p.x, p.y, item.x, item.y) > 0.55) continue;
      item.taken = true;
      const result = applyItem(p, item);
      this.float(item.x, item.y, result.float, result.color);
      if (result.message) this.pushMsg(result.message);
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

  getInput(): GameInput {
    return this.input;
  }
}
