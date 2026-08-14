import { ATTACK_ARC, ATTACK_RANGE, ENEMY_STATS, TILE } from "./types";
import { inArc } from "./math";
import type { Rng } from "./rng";
import type { Enemy, Vec } from "./types";

export function rollDamage(base: number, rng: Rng): number {
  return base + rng.int(-2, 2);
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
