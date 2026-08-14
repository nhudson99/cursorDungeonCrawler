import { describe, expect, it } from "vitest";
import { applyDamage, canMeleeHit, rollDamage } from "./combat";
import { Rng } from "./rng";
import type { Enemy } from "./types";

function slime(partial: Partial<Enemy> = {}): Enemy {
  return {
    id: 1,
    kind: "slime",
    x: 2,
    y: 2,
    hp: 18,
    maxHp: 18,
    speed: 48,
    damage: 6,
    xp: 8,
    attackCd: 0,
    flash: 0,
    alive: true,
    ...partial,
  };
}

describe("combat", () => {
  it("hits a target in front and misses one behind", () => {
    const origin = { x: 0, y: 0 };
    const facing = { x: 1, y: 0 };
    expect(canMeleeHit(origin, facing, { x: 0.8, y: 0 }, "slime")).toBe(true);
    expect(canMeleeHit(origin, facing, { x: -0.8, y: 0 }, "slime")).toBe(false);
  });

  it("rolls damage near the base value", () => {
    const rng = new Rng(3);
    for (let i = 0; i < 20; i++) {
      const dmg = rollDamage(12, rng);
      expect(dmg).toBeGreaterThanOrEqual(10);
      expect(dmg).toBeLessThanOrEqual(14);
    }
  });

  it("kills when hp reaches zero", () => {
    const enemy = slime({ hp: 5 });
    expect(applyDamage(enemy, 5)).toBe(true);
    expect(enemy.alive).toBe(false);
    expect(enemy.hp).toBe(0);
  });
});
