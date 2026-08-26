import { describe, expect, it } from "vitest";
import { generateDungeon } from "./dungeon";
import { dist } from "./math";
import { createIdFactory, Rng } from "./rng";
import { spawnFloorContents } from "./spawn";

describe("spawn", () => {
  it("keeps enemies from stacking on spawn", () => {
    const rng = new Rng(42);
    const dungeon = generateDungeon(4, rng);
    const spawned = spawnFloorContents(dungeon, 4, rng, createIdFactory());
    expect(spawned.enemies.length).toBeGreaterThan(3);
    for (let i = 0; i < spawned.enemies.length; i++) {
      for (let j = i + 1; j < spawned.enemies.length; j++) {
        const a = spawned.enemies[i]!;
        const b = spawned.enemies[j]!;
        expect(dist(a.x, a.y, b.x, b.y)).toBeGreaterThanOrEqual(0.85);
      }
    }
  });

  it("spawns a guardian on the final floor", () => {
    const rng = new Rng(11);
    const dungeon = generateDungeon(5, rng);
    const spawned = spawnFloorContents(dungeon, 5, rng, createIdFactory());
    expect(spawned.bossSpawned).toBe(true);
    expect(spawned.enemies.some((e) => e.kind === "brute" && e.maxHp >= 100)).toBe(
      true,
    );
  });
});
