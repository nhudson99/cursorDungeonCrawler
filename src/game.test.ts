import { describe, expect, it } from "vitest";
import { Game } from "./game";
import { MemoryInput } from "./input";
import {
  ENEMY_STATS,
  MAP_H,
  MAP_W,
  contactSeparation,
  dist,
  enemyHitRange,
  updateVisibility,
  walkable,
  type Enemy,
} from "./core";

const DT = 1 / 60;

function boss(partial: Partial<Enemy> = {}): Enemy {
  return {
    id: 99,
    kind: "brute",
    x: 0,
    y: 0,
    hp: 140,
    maxHp: 140,
    speed: 42,
    damage: 22,
    xp: 80,
    attackCd: 0,
    flash: 0,
    alive: true,
    ...partial,
  };
}

describe("Game", () => {
  it("starts from the title screen on click", () => {
    const input = new MemoryInput();
    const game = new Game(input, { seed: 42 });
    expect(game.state).toBe("title");
    input.click();
    game.update(DT);
    expect(game.state).toBe("playing");
    expect(game.floor).toBe(1);
    expect(game.player.hp).toBe(100);
    expect(walkable(game.dungeon, game.player.x, game.player.y)).toBe(true);
  });

  it("does not attack from the click that starts the run", () => {
    const input = new MemoryInput();
    const game = new Game(input, { seed: 42 });
    input.click();
    game.update(DT);
    expect(game.attackSwing).toBe(0);
    game.update(DT);
    expect(game.attackSwing).toBe(0);
    expect(game.state).toBe("playing");
  });

  it("attacks after the start click is released", () => {
    const input = new MemoryInput();
    const game = new Game(input, { seed: 42 });
    input.click();
    game.update(DT);
    input.releaseMouse();
    game.update(DT);
    input.click();
    game.update(DT);
    expect(game.attackSwing).toBeGreaterThan(0);
  });

  it("repeats attacks while space is held", () => {
    const input = new MemoryInput();
    const game = new Game(input, { seed: 42 });
    game.startNewGame();
    game.update(DT);
    input.hold(" ");
    game.update(DT);
    expect(game.attackSwing).toBeGreaterThan(0);
    game.attackSwing = 0;
    game.player.attackCd = 0;
    game.update(DT);
    expect(game.attackSwing).toBeGreaterThan(0);
  });

  it("pauses and resumes", () => {
    const input = new MemoryInput();
    const game = new Game(input, { seed: 42 });
    input.click();
    game.update(DT);
    input.tap("escape");
    game.update(DT);
    expect(game.state).toBe("paused");
    input.tap("p");
    game.update(DT);
    expect(game.state).toBe("playing");
  });

  it("freezes world time while paused", () => {
    const input = new MemoryInput();
    const game = new Game(input, { seed: 42 });
    game.startNewGame();
    game.update(DT);
    const frozen = game.time;
    input.tap("escape");
    game.update(1);
    expect(game.state).toBe("paused");
    expect(game.time).toBe(frozen);
  });

  it("uses a stable seed for the first floor", () => {
    const a = new Game(new MemoryInput(), { seed: 7 });
    const b = new Game(new MemoryInput(), { seed: 7 });
    a.startNewGame();
    b.startNewGame();
    expect(a.dungeon.rooms).toEqual(b.dungeon.rooms);
    expect(a.player.x).toBe(b.player.x);
  });

  it("keeps a locked seed across restarts", () => {
    const game = new Game(new MemoryInput(), { seed: 7 });
    game.startNewGame();
    const rooms = game.dungeon.rooms;
    game.startNewGame();
    expect(game.seed).toBe(7);
    expect(game.dungeon.rooms).toEqual(rooms);
  });

  it("rolls a new seed on restart when none was locked", () => {
    const game = new Game(new MemoryInput());
    game.startNewGame();
    const first = game.seed;
    game.startNewGame();
    expect(game.seed).not.toBe(first);
  });

  it("clears the death line after Enter, Enter restart", () => {
    const input = new MemoryInput();
    const game = new Game(input, { seed: 1 });
    game.startNewGame();
    game.player.hp = 0;
    game.state = "dead";
    game.pushMsg("You fall in the dark.");
    input.tap("enter");
    game.update(DT);
    expect(game.state).toBe("title");
    input.release("enter");
    input.tap("enter");
    game.update(DT);
    expect(game.state).toBe("playing");
    expect(game.messages.some((m) => m.text.includes("fall in the dark"))).toBe(
      false,
    );
  });

  it("generates a different layout on unlocked restart", () => {
    const game = new Game(new MemoryInput());
    game.startNewGame();
    const first = JSON.stringify(game.dungeon.rooms);
    game.startNewGame();
    expect(JSON.stringify(game.dungeon.rooms)).not.toBe(first);
  });

  it("does not ambush the player in the spawn room", () => {
    for (const seed of [1, 7, 42, 99, 12345]) {
      const game = new Game(new MemoryInput(), { seed });
      game.startNewGame();
      for (const enemy of game.enemies) {
        expect(
          Math.hypot(enemy.x - game.player.x, enemy.y - game.player.y),
        ).toBeGreaterThanOrEqual(8);
      }
    }
  });

  it("warns about the guardian even if the stir line is still up", () => {
    const game = new Game(new MemoryInput(), { seed: 9 });
    game.startNewGame();
    game.floor = 5;
    game.enemies = [boss()];
    game.player.x = game.dungeon.stairs.x + 0.5;
    game.player.y = game.dungeon.stairs.y + 0.5;
    game.messages = [{ text: "A crypt guardian stirs...", life: 3 }];
    game.update(DT);
    expect(game.state).toBe("playing");
    expect(game.messages.some((m) => m.text === "Defeat the guardian first!")).toBe(
      true,
    );
  });

  it("leaves potions on the ground at full health", () => {
    const game = new Game(new MemoryInput(), { seed: 3 });
    game.startNewGame();
    const potion = {
      id: 9999,
      kind: "potion" as const,
      x: game.player.x,
      y: game.player.y,
      value: 25,
      taken: false,
    };
    game.items.push(potion);
    game.update(DT);
    expect(potion.taken).toBe(false);
    game.player.hp = 50;
    game.update(DT);
    expect(potion.taken).toBe(true);
    expect(game.player.hp).toBe(75);
  });
});

function slime(partial: Partial<Enemy> = {}): Enemy {
  const stats = ENEMY_STATS.slime;
  return {
    id: 1,
    kind: "slime",
    x: 0,
    y: 0,
    hp: stats.hp,
    maxHp: stats.hp,
    speed: stats.speed,
    damage: stats.damage,
    xp: stats.xp,
    attackCd: 0,
    flash: 0,
    alive: true,
    ...partial,
  };
}

function packOnPlayer(game: Game, n: number): void {
  game.enemies = Array.from({ length: n }, (_, i) =>
    slime({
      id: 1000 + i,
      x: game.player.x + 0.05 * (i % 3),
      y: game.player.y + 0.05 * Math.floor(i / 3),
    }),
  );
}

describe("floor 1 slime survivability", () => {
  it("does not let overlapping slimes stack hits in one frame", () => {
    const game = new Game(new MemoryInput(), { seed: 42 });
    game.startNewGame();
    packOnPlayer(game, 8);
    const hp = game.player.hp;
    game.update(DT);
    const hits = game.floats.filter(
      (f) => f.text.startsWith("-") && f.color === "#c44536",
    );
    expect(hits).toHaveLength(1);
    expect(hp - game.player.hp).toBe(ENEMY_STATS.slime.damage);
    expect(game.player.invuln).toBeGreaterThan(0);
    expect(game.state).toBe("playing");
  });

  it("knocks the player out of a slime after a hit", () => {
    const game = new Game(new MemoryInput(), { seed: 42 });
    game.startNewGame();
    const origin = { x: game.player.x, y: game.player.y };
    const slimeX = origin.x + 0.2;
    game.enemies = [slime({ id: 7, x: slimeX, y: origin.y })];
    game.update(DT);
    const away = Math.hypot(game.player.x - slimeX, game.player.y - origin.y);
    expect(away).toBeGreaterThan(0.2);
    expect(game.player.x).toBeLessThan(origin.x);
    expect(game.player.invuln).toBeGreaterThan(0);
  });

  it("survives a second of slime-pack contact at level 1", () => {
    const game = new Game(new MemoryInput(), { seed: 42 });
    game.startNewGame();
    packOnPlayer(game, 9);
    for (let i = 0; i < 60; i++) game.update(DT);
    expect(game.state).toBe("playing");
    expect(game.player.hp).toBeGreaterThanOrEqual(
      100 - ENEMY_STATS.slime.damage * 2,
    );
  });

  it("lets a level 1 player win a 1v1 slime exchange", () => {
    const input = new MemoryInput();
    const game = new Game(input, { seed: 42 });
    game.startNewGame();
    game.update(DT);
    const foe = slime({
      id: 7,
      x: game.player.x + 0.45,
      y: game.player.y,
    });
    game.enemies = [foe];
    game.player.facing = { x: 1, y: 0 };
    for (let i = 0; i < 60 * 6 && foe.alive && game.state === "playing"; i++) {
      input.hold(" ");
      game.update(DT);
    }
    expect(foe.alive).toBe(false);
    expect(game.state).toBe("playing");
    expect(game.player.hp).toBeGreaterThan(0);
    expect(game.player.level).toBe(1);
  });

  it("does not dump 100→52→0 from one slime in under two seconds", () => {
    const input = new MemoryInput();
    const game = new Game(input, { seed: 42 });
    game.startNewGame();
    game.enemies = [slime({ id: 1, x: game.player.x + 0.15, y: game.player.y })];
    input.hold("d");
    const samples: number[] = [];
    for (let i = 0; i < 120; i++) {
      game.update(DT);
      if (i === 0 || i === 59 || i === 119) samples.push(game.player.hp);
    }
    expect(game.state).toBe("playing");
    expect(game.killCount).toBe(0);
    expect(game.player.hp).toBeGreaterThan(52);
    expect(game.player.hp).toBeGreaterThanOrEqual(100 - ENEMY_STATS.slime.damage * 3);
    expect(samples.every((hp) => hp > 52)).toBe(true);
  });

  it("does not let NaN dt strip i-frames and delete the player", () => {
    const game = new Game(new MemoryInput(), { seed: 42 });
    game.startNewGame();
    game.enemies = [slime({ id: 1, x: game.player.x, y: game.player.y })];
    game.update(DT);
    const afterFirst = game.player.hp;
    expect(afterFirst).toBe(100 - ENEMY_STATS.slime.damage);
    for (let i = 0; i < 40; i++) game.update(Number.NaN);
    expect(game.player.hp).toBe(afterFirst);
    expect(game.state).toBe("playing");
    expect(Number.isFinite(game.player.invuln)).toBe(true);
  });

  it("after the first 6-damage hit, two seconds of contact does not dump HP from 94 to 4", () => {
    const input = new MemoryInput();
    const game = new Game(input, { seed: 42 });
    game.startNewGame();
    const pin = pinAgainstWestWall(game);
    game.player.x = pin.px;
    game.player.y = pin.py;
    updateVisibility(game.dungeon, game.player.x, game.player.y);
    const foe = slime({ id: 1, x: pin.slimeX, y: pin.slimeY });
    game.enemies = [foe];
    game.update(DT);
    expect(game.player.hp).toBe(94);
    expect(game.floats.some((f) => f.text === "-6" && f.color === "#c44536")).toBe(
      true,
    );
    expect(dist(game.player.x, game.player.y, foe.x, foe.y)).toBeGreaterThan(
      enemyHitRange("slime"),
    );

    input.hold("a");
    for (let i = 0; i < 120; i++) {
      foe.x = game.player.x + 0.08;
      foe.y = game.player.y;
      foe.attackCd = 0;
      game.update(DT);
    }

    expect(game.state).toBe("playing");
    expect(game.killCount).toBe(0);
    expect(game.player.hp).not.toBe(4);
    expect(game.player.hp).toBeGreaterThan(4);
    expect(game.player.hp).toBeGreaterThanOrEqual(94 - ENEMY_STATS.slime.damage * 2);
  });

  it("knocks a wall-pinned player and slime out of melee on the first hit", () => {
    const game = new Game(new MemoryInput(), { seed: 42 });
    game.startNewGame();
    const pin = pinAgainstWestWall(game);
    game.player.x = pin.px;
    game.player.y = pin.py;
    updateVisibility(game.dungeon, game.player.x, game.player.y);
    const foe = slime({ id: 3, x: pin.slimeX, y: pin.slimeY });
    game.enemies = [foe];
    const before = dist(game.player.x, game.player.y, foe.x, foe.y);
    expect(before).toBeLessThan(enemyHitRange("slime"));
    game.update(DT);
    expect(game.player.hp).toBe(94);
    expect(dist(game.player.x, game.player.y, foe.x, foe.y)).toBeGreaterThan(
      enemyHitRange("slime"),
    );
    expect(game.player.invuln).toBeGreaterThan(0);
    expect(game.player.stun).toBeGreaterThan(0);
  });

  it("lets a stunned player walk away from a slime instead of staying glued", () => {
    const input = new MemoryInput();
    const game = new Game(input, { seed: 42 });
    game.startNewGame();
    const foe = slime({ id: 4, x: game.player.x + 0.2, y: game.player.y });
    game.enemies = [foe];
    game.update(DT);
    expect(game.player.hp).toBe(94);
    expect(game.player.stun).toBeGreaterThan(0);
    const start = dist(game.player.x, game.player.y, foe.x, foe.y);
    input.hold("a");
    for (let i = 0; i < 10; i++) game.update(DT);
    expect(dist(game.player.x, game.player.y, foe.x, foe.y)).toBeGreaterThan(start);
    expect(dist(game.player.x, game.player.y, foe.x, foe.y)).toBeGreaterThan(
      enemyHitRange("slime"),
    );
    expect(game.player.hp).toBe(94);
  });

  it("still lands the first 6-damage hit when walking into a slime from outside melee", () => {
    const input = new MemoryInput();
    const game = new Game(input, { seed: 42 });
    game.startNewGame();
    const foe = slime({ id: 8, x: game.player.x + 1.8, y: game.player.y });
    game.enemies = [foe];
    expect(dist(game.player.x, game.player.y, foe.x, foe.y)).toBeGreaterThan(
      contactSeparation("slime"),
    );
    input.hold("d");
    let firstHitAt = -1;
    for (let i = 0; i < 120; i++) {
      game.update(DT);
      if (game.player.hp < 100 && firstHitAt < 0) {
        firstHitAt = i;
        expect(game.player.hp).toBe(94);
        expect(dist(game.player.x, game.player.y, foe.x, foe.y)).toBeGreaterThan(
          enemyHitRange("slime"),
        );
        break;
      }
    }
    expect(firstHitAt).toBeGreaterThanOrEqual(0);
    expect(game.state).toBe("playing");
    expect(game.killCount).toBe(0);
  });

  it("does not dump 100→64 on first contact with a slime blob", () => {
    const input = new MemoryInput();
    const game = new Game(input, { seed: 42 });
    game.startNewGame();
    packOnPlayer(game, 6);
    input.hold("d");
    game.update(DT);
    expect(game.player.hp).toBe(94);
    expect(game.player.hp).not.toBe(64);
    expect(100 - game.player.hp).toBe(ENEMY_STATS.slime.damage);
    const incoming = game.floats.filter(
      (f) => f.text === "-6" && f.color === "#c44536",
    );
    expect(incoming).toHaveLength(1);

    game.player.invuln = 0;
    for (const e of game.enemies) {
      if (e.alive) e.attackCd = 0;
    }
    game.update(DT);
    expect(game.player.hp).toBe(94);
    expect(game.player.hp).not.toBe(64);
    expect(game.state).toBe("playing");
  });

  it("does not dump 100→64 while walking into six overlapping slimes", () => {
    const input = new MemoryInput();
    const game = new Game(input, { seed: 42 });
    game.startNewGame();
    packOnPlayer(game, 6);
    input.hold("d");
    let firstHp: number | null = null;
    for (let i = 0; i < 10; i++) {
      game.update(0.05);
      if (game.player.hp < 100 && firstHp === null) firstHp = game.player.hp;
    }
    expect(firstHp).toBe(94);
    expect(game.player.hp).toBeGreaterThan(64);
    expect(game.player.hp).not.toBe(64);
    expect(game.state).toBe("playing");
    expect(game.killCount).toBe(0);
  });
});

function pinAgainstWestWall(game: Game): {
  px: number;
  py: number;
  slimeX: number;
  slimeY: number;
} {
  const sx = Math.floor(game.player.x);
  const sy = Math.floor(game.player.y);
  const tryAt = (x: number, y: number) => {
    if (x < 1 || y < 1 || x >= MAP_W - 2 || y >= MAP_H - 1) return null;
    if (!walkable(game.dungeon, x + 0.5, y + 0.5)) return null;
    if (walkable(game.dungeon, x - 0.5, y + 0.5)) return null;
    if (!walkable(game.dungeon, x + 1.5, y + 0.5)) return null;
    return {
      px: x + 0.32,
      py: y + 0.5,
      slimeX: x + 0.5,
      slimeY: y + 0.5,
    };
  };
  for (let r = 0; r < 12; r++) {
    for (let y = sy - r; y <= sy + r; y++) {
      for (let x = sx - r; x <= sx + r; x++) {
        const found = tryAt(x, y);
        if (found) return found;
      }
    }
  }
  throw new Error("no west-wall pin found");
}
