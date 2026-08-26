import { describe, expect, it } from "vitest";
import {
  applyDamage,
  bodyOverlapSeparation,
  canMeleeHit,
  clampDt,
  contactSeparation,
  enemyHitRange,
  hurtPlayer,
  PLAYER_HURT_INVULN,
  PLAYER_HURT_INVULN_FRAMES,
  PLAYER_HURT_KNOCKBACK,
  rollDamage,
  tickPlayerStatus,
} from "./combat";
import { Rng } from "./rng";
import { createPlayer, type Enemy } from "./types";

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

  it("gives slimes a melee reach under one tile", () => {
    expect(enemyHitRange("slime")).toBeGreaterThan(0.5);
    expect(enemyHitRange("slime")).toBeLessThan(1);
  });

  it("separates bodies past slime melee reach, not inside it", () => {
    expect(contactSeparation("slime")).toBeGreaterThan(enemyHitRange("slime"));
    expect(contactSeparation("bat")).toBeGreaterThan(enemyHitRange("bat"));
    expect(contactSeparation("skeleton")).toBeGreaterThan(enemyHitRange("skeleton"));
    expect(contactSeparation("brute")).toBeGreaterThan(enemyHitRange("brute"));
  });

  it("keeps idle body gap inside slime melee so a closing slime can still hit", () => {
    expect(bodyOverlapSeparation("slime")).toBeLessThan(enemyHitRange("slime"));
  });

  it("ignores a second hit while i-frames are active", () => {
    const player = createPlayer();
    player.x = 5;
    player.y = 5;
    const first = hurtPlayer(player, { x: 5.2, y: 5 }, 6);
    const second = hurtPlayer(player, { x: 4.8, y: 5 }, 13);
    expect(first).toEqual(
      expect.objectContaining({ hit: true, damage: 6, died: false }),
    );
    expect(second).toEqual({ hit: false });
    expect(player.hp).toBe(94);
    expect(player.invuln).toBe(PLAYER_HURT_INVULN);
    expect(player.hurtLock).toBe(PLAYER_HURT_INVULN_FRAMES);
  });

  it("still blocks a second hit if the float invuln timer is cleared", () => {
    const player = createPlayer();
    player.x = 5;
    player.y = 5;
    expect(hurtPlayer(player, { x: 5.2, y: 5 }, 6).hit).toBe(true);
    player.invuln = 0;
    const second = hurtPlayer(player, { x: 4.8, y: 5 }, 6);
    expect(second).toEqual({ hit: false });
    expect(player.hp).toBe(94);
  });

  it("knocks the player away from the attacker", () => {
    const player = createPlayer();
    player.x = 5;
    player.y = 5;
    const result = hurtPlayer(player, { x: 6, y: 5 }, 6);
    expect(result.hit).toBe(true);
    if (!result.hit) return;
    expect(result.knockback.x).toBeCloseTo(-PLAYER_HURT_KNOCKBACK);
    expect(result.knockback.y).toBeCloseTo(0);
  });

  it("does not let a slime-pack volley delete a fresh player", () => {
    const player = createPlayer();
    player.x = 0;
    player.y = 0;
    let hits = 0;
    for (let i = 0; i < 9; i++) {
      if (hurtPlayer(player, { x: 0.1, y: 0 }, 13).hit) hits += 1;
    }
    expect(hits).toBe(1);
    expect(player.hp).toBe(87);
    expect(player.hp).toBeGreaterThan(0);
  });

  it("reports death once hp reaches zero", () => {
    const player = createPlayer();
    player.hp = 4;
    const result = hurtPlayer(player, { x: 1, y: 0 }, 6);
    expect(result.hit).toBe(true);
    if (!result.hit) return;
    expect(result.died).toBe(true);
    expect(player.hp).toBe(0);
  });

  it("clamps bad dt so i-frames cannot become NaN", () => {
    expect(clampDt(Number.NaN)).toBe(0);
    expect(clampDt(-1)).toBe(0);
    expect(clampDt(2)).toBe(0.05);
    const player = createPlayer();
    player.invuln = 1;
    tickPlayerStatus(player, Number.NaN);
    expect(player.invuln).toBe(1);
    expect(Number.isFinite(player.invuln)).toBe(true);
  });

  it("treats a NaN invuln flag as not locked, then sets a finite lock", () => {
    const player = createPlayer();
    player.invuln = Number.NaN;
    const first = hurtPlayer(player, { x: 1, y: 0 }, 6);
    const second = hurtPlayer(player, { x: 1, y: 0 }, 48);
    expect(first.hit).toBe(true);
    expect(second.hit).toBe(false);
    expect(player.hp).toBe(94);
    expect(player.invuln).toBe(PLAYER_HURT_INVULN);
  });
});
