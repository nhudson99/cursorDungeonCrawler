import { describe, expect, it } from "vitest";
import { applyItem } from "./items";
import {
  applyXp,
  enemyKindsForFloor,
  stairsOutcome,
  xpToLevel,
} from "./progression";
import { createPlayer, type Enemy } from "./types";

describe("progression", () => {
  it("levels up and spends leftover xp", () => {
    const player = createPlayer();
    const needed = xpToLevel(1);
    const gained = applyXp(player, needed);
    expect(gained).toBe(1);
    expect(player.level).toBe(2);
    expect(player.xp).toBe(0);
    expect(player.damage).toBe(15);
    expect(player.maxHp).toBe(112);
  });

  it("unlocks harder enemies by floor", () => {
    expect(enemyKindsForFloor(1)).toEqual(["slime"]);
    expect(enemyKindsForFloor(3)).toContain("skeleton");
    expect(enemyKindsForFloor(4)).toContain("brute");
  });

  it("blocks the final stairs while the guardian lives", () => {
    const boss: Enemy = {
      id: 1,
      kind: "brute",
      x: 0,
      y: 0,
      hp: 10,
      maxHp: 140,
      speed: 42,
      damage: 22,
      xp: 80,
      attackCd: 0,
      flash: 0,
      alive: true,
    };
    expect(stairsOutcome(5, [boss])).toBe("blocked");
    boss.alive = false;
    expect(stairsOutcome(5, [boss])).toBe("win");
    expect(stairsOutcome(2, [])).toBe("descend");
  });
});

describe("items", () => {
  it("applies gold, potions, and swords", () => {
    const player = createPlayer();
    player.hp = 40;
    applyItem(player, { id: 1, kind: "gold", x: 0, y: 0, value: 12, taken: false });
    applyItem(player, { id: 2, kind: "potion", x: 0, y: 0, value: 25, taken: false });
    applyItem(player, { id: 3, kind: "sword", x: 0, y: 0, value: 3, taken: false });
    expect(player.gold).toBe(12);
    expect(player.hp).toBe(65);
    expect(player.damage).toBe(15);
  });
});
