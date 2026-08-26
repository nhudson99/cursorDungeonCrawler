import { ATTACK_ARC, ATTACK_RANGE, ENEMY_STATS, TILE } from "./types";
import { inArc } from "./math";
import type { Rng } from "./rng";
import type { Enemy, Player, Vec } from "./types";

/** Seconds of i-frames after a player hit. */
export const PLAYER_HURT_INVULN = 1;
export const PLAYER_HURT_KNOCKBACK = 0.85;
export const PLAYER_HURT_FLASH = 0.2;
export const PLAYER_HURT_STUN = 0.28;
export const MAX_UPDATE_DT = 0.05;

export function clampDt(dt: number): number {
  if (!Number.isFinite(dt) || dt < 0) return 0;
  return Math.min(dt, MAX_UPDATE_DT);
}

export function tickPlayerStatus(player: Player, dt: number): void {
  const step = clampDt(dt);
  const cd = Number.isFinite(player.attackCd) ? player.attackCd : 0;
  const inv = Number.isFinite(player.invuln) ? player.invuln : 0;
  const stun = Number.isFinite(player.stun) ? player.stun : 0;
  const flash = Number.isFinite(player.flash) ? player.flash : 0;
  player.attackCd = Math.max(0, cd - step);
  player.invuln = Math.max(0, inv - step);
  player.stun = Math.max(0, stun - step);
  player.flash = Math.max(0, flash - step);
}

export function rollDamage(base: number, rng: Rng): number {
  return base + rng.int(-2, 2);
}

export function enemyHitRange(kind: Enemy["kind"]): number {
  return 0.55 + (ENEMY_STATS[kind].radius / TILE) * 0.5;
}

export type HurtPlayerResult =
  | { hit: false }
  | { hit: true; damage: number; died: boolean; knockback: Vec };

/**
 * Apply one enemy hit to the player. Later calls are no-ops until i-frames expire,
 * so overlapping slimes cannot stack a one-tick burst.
 */
export function hurtPlayer(
  player: Player,
  source: Vec,
  damage: number,
  invuln = PLAYER_HURT_INVULN,
): HurtPlayerResult {
  const locked = Number.isFinite(player.invuln) ? player.invuln : 0;
  if (locked > 0 || player.hp <= 0) {
    return { hit: false };
  }
  const amount = Math.max(0, damage);
  player.hp -= amount;
  player.invuln = invuln;
  player.stun = PLAYER_HURT_STUN;
  player.flash = PLAYER_HURT_FLASH;
  const dx = player.x - source.x;
  const dy = player.y - source.y;
  const len = Math.hypot(dx, dy);
  const knockback =
    len < 1e-6
      ? {
          x: -player.facing.x * PLAYER_HURT_KNOCKBACK,
          y: -player.facing.y * PLAYER_HURT_KNOCKBACK,
        }
      : {
          x: (dx / len) * PLAYER_HURT_KNOCKBACK,
          y: (dy / len) * PLAYER_HURT_KNOCKBACK,
        };
  if (player.hp <= 0) {
    player.hp = 0;
    return { hit: true, damage: amount, died: true, knockback };
  }
  return { hit: true, damage: amount, died: false, knockback };
}

/** Extra tiles past melee reach so a "separated" pair is actually out of hit range. */
export const MELEE_BREAK_PADDING = 0.25;

/**
 * Minimum center distance that leaves the player outside this enemy's melee.
 * Must be strictly greater than `enemyHitRange`; the old body-radius formula
 * (~0.45 for slimes) sat inside slime reach (~0.71) and left the player glued.
 */
export function contactSeparation(kind: Enemy["kind"]): number {
  return enemyHitRange(kind) + MELEE_BREAK_PADDING;
}

export function meleeRange(kind: Enemy["kind"]): number {
  return ATTACK_RANGE + ENEMY_STATS[kind].radius / TILE;
}

export function canMeleeHit(
  origin: Vec,
  facing: Vec,
  target: Vec,
  kind: Enemy["kind"],
): boolean {
  return inArc(
    origin.x,
    origin.y,
    facing.x,
    facing.y,
    target.x,
    target.y,
    meleeRange(kind),
    ATTACK_ARC,
  );
}

export function applyDamage(enemy: Enemy, amount: number): boolean {
  enemy.hp -= amount;
  enemy.flash = 0.15;
  if (enemy.hp <= 0) {
    enemy.hp = 0;
    enemy.alive = false;
    return true;
  }
  return false;
}
