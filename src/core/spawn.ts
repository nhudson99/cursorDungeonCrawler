import { randomFloorInRooms, type Dungeon } from "./dungeon";
import { dist } from "./math";
import {
  enemyKindsForFloor,
  FINAL_FLOOR,
  floorStatScale,
} from "./progression";
import type { IdFactory, Rng } from "./rng";
import { ENEMY_STATS, type Enemy, type Item, type ItemKind, type Vec } from "./types";

const ITEM_POOL: ItemKind[] = [
  "potion",
  "potion",
  "gold",
  "gold",
  "gold",
  "heart",
  "sword",
  "key",
];

function occupied(
  pos: Vec,
  enemies: readonly Enemy[],
  items: readonly Item[],
  minEnemy = 0.9,
  minItem = 0.55,
): boolean {
  for (const enemy of enemies) {
    if (dist(enemy.x, enemy.y, pos.x, pos.y) < minEnemy) return true;
  }
  for (const item of items) {
    if (dist(item.x, item.y, pos.x, pos.y) < minItem) return true;
  }
  return false;
}

function freeFloorTile(
  dungeon: Dungeon,
  rng: Rng,
  enemies: readonly Enemy[],
  items: readonly Item[],
  minDistFromSpawn: number,
): Vec | null {
  for (let attempt = 0; attempt < 16; attempt++) {
    const pos = randomFloorInRooms(dungeon, rng, dungeon.spawn, minDistFromSpawn);
    if (!pos) return null;
    if (!occupied(pos, enemies, items)) return pos;
  }
  return null;
}

export function spawnFloorContents(
  dungeon: Dungeon,
  floor: number,
  rng: Rng,
  nextId: IdFactory,
): { enemies: Enemy[]; items: Item[]; bossSpawned: boolean } {
  const enemies: Enemy[] = [];
  const items: Item[] = [];
  const kinds = enemyKindsForFloor(floor);
  const scale = floorStatScale(floor);
  const enemyBudget = 6 + floor * 3;

  for (let i = 0; i < enemyBudget; i++) {
    const pos = freeFloorTile(dungeon, rng, enemies, items, 8);
    if (!pos) break;
    const kind = rng.pick(kinds);
    const stats = ENEMY_STATS[kind];
    enemies.push({
      id: nextId(),
      kind,
      x: pos.x,
      y: pos.y,
      hp: Math.round(stats.hp * scale),
      maxHp: Math.round(stats.hp * scale),
      speed: stats.speed,
      damage: Math.round(stats.damage * scale),
      xp: Math.round(stats.xp * scale),
      attackCd: 0,
      flash: 0,
      alive: true,
    });
  }

  let bossSpawned = false;
  if (floor === FINAL_FLOOR) {
    const fallback = {
      x: dungeon.stairs.x + 0.5,
      y: dungeon.stairs.y + 0.5,
    };
    const bossPos =
      freeFloorTile(dungeon, rng, enemies, items, 8) ?? fallback;
    enemies.push({
      id: nextId(),
      kind: "brute",
      x: bossPos.x,
      y: bossPos.y,
      hp: 140,
      maxHp: 140,
      speed: 42,
      damage: 22,
      xp: 80,
      attackCd: 0,
      flash: 0,
      alive: true,
    });
    bossSpawned = true;
  }

  const itemCount = 5 + floor;
  for (let i = 0; i < itemCount; i++) {
    const pos = freeFloorTile(dungeon, rng, enemies, items, 2);
    if (!pos) break;
    const kind = rng.pick(ITEM_POOL);
    const value =
      kind === "gold"
        ? 5 + rng.int(0, 11) + floor * 2
        : kind === "potion"
          ? 25
          : kind === "heart"
            ? 15
            : kind === "sword"
              ? 3
              : 1;
    items.push({ id: nextId(), kind, x: pos.x, y: pos.y, value, taken: false });
  }

  return { enemies, items, bossSpawned };
}
