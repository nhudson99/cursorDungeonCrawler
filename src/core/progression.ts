import type { Enemy, EnemyKind, Player } from "./types";

export const FINAL_FLOOR = 5;

export function xpToLevel(level: number): number {
  return 20 + level * 18;
}

/** Apply XP. Returns how many levels were gained. */
export function applyXp(player: Player, amount: number): number {
  player.xp += amount;
  let levels = 0;
  while (player.xp >= xpToLevel(player.level)) {
    player.xp -= xpToLevel(player.level);
    player.level += 1;
    player.maxHp += 12;
    player.hp = Math.min(player.maxHp, player.hp + 20);
    player.damage += 3;
    levels += 1;
  }
  return levels;
}

export function enemyKindsForFloor(floor: number): EnemyKind[] {
  if (floor >= 4) return ["slime", "bat", "skeleton", "brute"];
  if (floor >= 3) return ["slime", "bat", "skeleton"];
  if (floor >= 2) return ["slime", "bat"];
  return ["slime"];
}

export function floorStatScale(floor: number): number {
  return 1 + (floor - 1) * 0.12;
}

export function stairsOutcome(
  floor: number,
  enemies: readonly Enemy[],
): "win" | "blocked" | "descend" {
  if (floor >= FINAL_FLOOR) {
    const bossesAlive = enemies.some(
      (e) => e.alive && e.kind === "brute" && e.maxHp >= 100,
    );
    return bossesAlive ? "blocked" : "win";
  }
  return "descend";
}
