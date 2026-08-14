import { describe, expect, it } from "vitest";
import { generateDungeon, roomsOverlap, tileAt, updateVisibility, walkable } from "./dungeon";
import { Rng } from "./rng";
import { Tile } from "./types";

describe("dungeon", () => {
  it("does not treat padded rooms as overlapping", () => {
    expect(
      roomsOverlap({ x: 0, y: 0, w: 4, h: 4 }, { x: 6, y: 0, w: 4, h: 4 }),
    ).toBe(false);
  });

  it("detects overlap with padding", () => {
    expect(
      roomsOverlap({ x: 0, y: 0, w: 4, h: 4 }, { x: 4, y: 0, w: 4, h: 4 }),
    ).toBe(true);
  });

  it("generates a connected floor with spawn and stairs", () => {
    const dungeon = generateDungeon(1, new Rng(12345));
    expect(dungeon.rooms.length).toBeGreaterThanOrEqual(3);
    expect(tileAt(dungeon, dungeon.spawn.x, dungeon.spawn.y)).toBe(Tile.Floor);
    expect(tileAt(dungeon, dungeon.stairs.x, dungeon.stairs.y)).toBe(Tile.Stairs);
    expect(walkable(dungeon, dungeon.spawn.x, dungeon.spawn.y)).toBe(true);
    expect(walkable(dungeon, dungeon.stairs.x, dungeon.stairs.y)).toBe(true);
  });

  it("is deterministic for a seed", () => {
    const a = generateDungeon(2, new Rng(99));
    const b = generateDungeon(2, new Rng(99));
    expect(a.spawn).toEqual(b.spawn);
    expect(a.stairs).toEqual(b.stairs);
    expect(a.rooms).toEqual(b.rooms);
  });

  it("marks the spawn tile visible after FOV update", () => {
    const dungeon = generateDungeon(1, new Rng(1));
    updateVisibility(dungeon, dungeon.spawn.x + 0.5, dungeon.spawn.y + 0.5);
    expect(dungeon.visible[dungeon.spawn.y]![dungeon.spawn.x]).toBe(true);
    expect(dungeon.explored[dungeon.spawn.y]![dungeon.spawn.x]).toBe(true);
  });

  it("treats walls and out of bounds as blocked", () => {
    const dungeon = generateDungeon(1, new Rng(1));
    expect(walkable(dungeon, 0, 0)).toBe(false);
    expect(walkable(dungeon, -1, 5)).toBe(false);
    expect(tileAt(dungeon, -1, 0)).toBe(Tile.Wall);
  });
});
