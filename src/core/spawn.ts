import { randomFloorInRooms, type Dungeon } from "./dungeon";
import {
  enemyKindsForFloor,
  FINAL_FLOOR,
  floorStatScale,
} from "./progression";
import type { IdFactory, Rng } from "./rng";
import { ENEMY_STATS, type Enemy, type Item, type ItemKind } from "./types";

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
    const pos = randomFloorInRooms(dungeon, rng, dungeon.spawn, 5);
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
    const bossPos = randomFloorInRooms(dungeon, rng, dungeon.spawn, 8) ?? fallback;
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
    const pos = randomFloorInRooms(dungeon, rng, dungeon.spawn, 2);
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
