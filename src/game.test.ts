import { describe, expect, it } from "vitest";
import { Game } from "./game";
import { MemoryInput } from "./input";
import { walkable, type Enemy } from "./core";

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

  it("clears stale messages when a new floor loads", () => {
    const game = new Game(new MemoryInput(), { seed: 1 });
    game.startNewGame();
    game.pushMsg("You fall in the dark.");
    game.startNewGame();
    expect(game.messages.some((m) => m.text.includes("fall in the dark"))).toBe(
      false,
    );
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
