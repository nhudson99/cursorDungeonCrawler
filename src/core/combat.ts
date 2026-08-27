import { ATTACK_ARC, ATTACK_RANGE, ENEMY_STATS, PLAYER_RADIUS, TILE } from "./types";
import { dist, inArc } from "./math";
import type { Rng } from "./rng";
import type { Enemy, Player, Vec } from "./types";

/** Seconds of i-frames after a player hit. */
export const PLAYER_HURT_INVULN = 1;
/** Positive-dt frames of i-frames (60fps-seconds). Independent of the float timer. */
export const PLAYER_HURT_INVULN_FRAMES = 60;
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
  const lock = Number.isFinite(player.hurtLock) ? player.hurtLock : 0;
  if (step > 0) player.hurtLock = Math.max(0, lock - 1);
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
export function isPlayerHurtLocked(player: Player): boolean {
  const inv = Number.isFinite(player.invuln) ? player.invuln : 0;
  const lock = Number.isFinite(player.hurtLock) ? player.hurtLock : 0;
  return inv > 0 || lock > 0;
}

export function hurtPlayer(
  player: Player,
  source: Vec,
  damage: number,
  invuln = PLAYER_HURT_INVULN,
): HurtPlayerResult {
  if (isPlayerHurtLocked(player) || player.hp <= 0) {
    return { hit: false };
  }
  const amount = Math.max(0, damage);
  player.hp -= amount;
  player.invuln = Number.isFinite(invuln) && invuln > 0 ? invuln : PLAYER_HURT_INVULN;
  player.hurtLock = PLAYER_HURT_INVULN_FRAMES;
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

/** Extra tiles past melee reach so a post-hit pair is actually out of hit range. */
export const MELEE_BREAK_PADDING = 0.25;

/** Sprite-body gap. Smaller than melee reach, so a closing slime can still land a hit. */
export function bodyOverlapSeparation(kind: Enemy["kind"]): number {
  return PLAYER_RADIUS + (ENEMY_STATS[kind].radius / TILE) * 0.55;
}

/**
 * Minimum center distance that leaves the player outside this enemy's melee.
 * Used after a hit / during i-frames. Must be strictly greater than `enemyHitRange`.
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
  const d = dist(origin.x, origin.y, target.x, target.y);
  if (d <= bodyOverlapSeparation(kind)) return true;
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
