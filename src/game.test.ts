import { describe, expect, it } from "vitest";
import { Game } from "./game";
import { MemoryInput } from "./input";
import { walkable } from "./core";

describe("Game", () => {
  it("starts from the title screen on click", () => {
    const input = new MemoryInput();
    const game = new Game(input, { seed: 42 });
    expect(game.state).toBe("title");
    input.click();
    game.update(1 / 60);
    expect(game.state).toBe("playing");
    expect(game.floor).toBe(1);
    expect(game.player.hp).toBe(100);
    expect(walkable(game.dungeon, game.player.x, game.player.y)).toBe(true);
  });

  it("pauses and resumes", () => {
    const input = new MemoryInput();
    const game = new Game(input, { seed: 42 });
    input.click();
    game.update(1 / 60);
    input.tap("escape");
    game.update(1 / 60);
    expect(game.state).toBe("paused");
    input.tap("p");
    game.update(1 / 60);
    expect(game.state).toBe("playing");
  });

  it("uses a stable seed for the first floor", () => {
    const a = new Game(new MemoryInput(), { seed: 7 });
    const b = new Game(new MemoryInput(), { seed: 7 });
    a.startNewGame();
    b.startNewGame();
    expect(a.dungeon.rooms).toEqual(b.dungeon.rooms);
    expect(a.player.x).toBe(b.player.x);
  });
});
