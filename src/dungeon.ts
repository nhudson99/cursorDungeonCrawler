import { MAP_H, MAP_W, Tile, type Room, type Vec } from "./types";

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export type Dungeon = {
  tiles: Tile[][];
  rooms: Room[];
  spawn: Vec;
  stairs: Vec;
  explored: boolean[][];
  visible: boolean[][];
};

function carveRoom(tiles: Tile[][], room: Room): void {
  for (let y = room.y; y < room.y + room.h; y++) {
    for (let x = room.x; x < room.x + room.w; x++) {
      tiles[y][x] = Tile.Floor;
    }
  }
}

function carveH(tiles: Tile[][], x1: number, x2: number, y: number): void {
  const a = Math.min(x1, x2);
  const b = Math.max(x1, x2);
  for (let x = a; x <= b; x++) tiles[y][x] = Tile.Floor;
}

function carveV(tiles: Tile[][], y1: number, y2: number, x: number): void {
  const a = Math.min(y1, y2);
  const b = Math.max(y1, y2);
  for (let y = a; y <= b; y++) tiles[y][x] = Tile.Floor;
}

function center(room: Room): Vec {
  return {
    x: Math.floor(room.x + room.w / 2),
    y: Math.floor(room.y + room.h / 2),
  };
}

function roomsOverlap(a: Room, b: Room, pad = 1): boolean {
  return !(
    a.x + a.w + pad <= b.x ||
    b.x + b.w + pad <= a.x ||
    a.y + a.h + pad <= b.y ||
    b.y + b.h + pad <= a.y
  );
}

export function generateDungeon(floor: number): Dungeon {
  const tiles: Tile[][] = Array.from({ length: MAP_H }, () =>
    Array.from({ length: MAP_W }, () => Tile.Wall),
  );
  const rooms: Room[] = [];
  const roomCount = Math.min(8 + floor, 14);

  for (let i = 0; i < 80 && rooms.length < roomCount; i++) {
    const w = randInt(5, 10);
    const h = randInt(4, 8);
    const x = randInt(1, MAP_W - w - 2);
    const y = randInt(1, MAP_H - h - 2);
    const room: Room = { x, y, w, h };
    if (rooms.some((r) => roomsOverlap(r, room))) continue;
    rooms.push(room);
    carveRoom(tiles, room);
  }

  if (rooms.length < 3) {
    // Fallback guaranteed layout
    const fallback: Room[] = [
      { x: 4, y: 4, w: 8, h: 6 },
      { x: 18, y: 6, w: 10, h: 7 },
      { x: 32, y: 10, w: 9, h: 6 },
      { x: 14, y: 18, w: 12, h: 7 },
    ];
    for (const room of fallback) {
      rooms.push(room);
      carveRoom(tiles, room);
    }
  }

  const ordered = [...rooms].sort((a, b) => a.x + a.y - (b.x + b.y));
  for (let i = 1; i < ordered.length; i++) {
    const a = center(ordered[i - 1]);
    const b = center(ordered[i]);
    if (Math.random() < 0.5) {
      carveH(tiles, a.x, b.x, a.y);
      carveV(tiles, a.y, b.y, b.x);
    } else {
      carveV(tiles, a.y, b.y, a.x);
      carveH(tiles, a.x, b.x, b.y);
    }
  }

  // Extra loops for connectivity
  const links = shuffle([...rooms]).slice(0, Math.min(3, rooms.length));
  for (let i = 1; i < links.length; i++) {
    const a = center(links[i - 1]);
    const b = center(links[i]);
    carveH(tiles, a.x, b.x, a.y);
    carveV(tiles, a.y, b.y, b.x);
  }

  const spawnRoom = ordered[0];
  const stairsRoom = ordered[ordered.length - 1];
  const spawn = center(spawnRoom);
  const stairs = center(stairsRoom);
  tiles[stairs.y][stairs.x] = Tile.Stairs;

  // Decorate walls near floors as "doorway" feel occasionally
  for (let y = 1; y < MAP_H - 1; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      if (tiles[y][x] !== Tile.Floor) continue;
      const walls =
        (tiles[y - 1][x] === Tile.Wall ? 1 : 0) +
        (tiles[y + 1][x] === Tile.Wall ? 1 : 0) +
        (tiles[y][x - 1] === Tile.Wall ? 1 : 0) +
        (tiles[y][x + 1] === Tile.Wall ? 1 : 0);
      if (walls === 2 && Math.random() < 0.04) {
        // leave as floor; visual variety handled in renderer via noise
      }
    }
  }

  const explored = Array.from({ length: MAP_H }, () =>
    Array.from({ length: MAP_W }, () => false),
  );
  const visible = Array.from({ length: MAP_H }, () =>
    Array.from({ length: MAP_W }, () => false),
  );

  return { tiles, rooms, spawn, stairs, explored, visible };
}

export function walkable(dungeon: Dungeon, x: number, y: number): boolean {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return false;
  const t = dungeon.tiles[ty][tx];
  return t === Tile.Floor || t === Tile.Door || t === Tile.Stairs;
}

export function tileAt(dungeon: Dungeon, x: number, y: number): Tile {
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return Tile.Wall;
  return dungeon.tiles[ty][tx];
}

/** Circular FOV with simple line-of-sight */
export function updateVisibility(
  dungeon: Dungeon,
  px: number,
  py: number,
  radius = 7,
): void {
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      dungeon.visible[y][x] = false;
    }
  }

  const cx = Math.floor(px);
  const cy = Math.floor(py);

  for (let y = cy - radius; y <= cy + radius; y++) {
    for (let x = cx - radius; x <= cx + radius; x++) {
      if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
      const dx = x - cx + 0.5;
      const dy = y - cy + 0.5;
      if (dx * dx + dy * dy > radius * radius) continue;
      if (hasLos(dungeon, cx, cy, x, y)) {
        dungeon.visible[y][x] = true;
        dungeon.explored[y][x] = true;
      }
    }
  }
}

function hasLos(
  dungeon: Dungeon,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): boolean {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    if (x === x1 && y === y1) return true;
    if (!(x === x0 && y === y0)) {
      const t = dungeon.tiles[y][x];
      if (t === Tile.Wall) return false;
    }
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

export function randomFloorInRooms(
  dungeon: Dungeon,
  excludeNear?: Vec,
  minDist = 4,
): Vec | null {
  const candidates: Vec[] = [];
  for (const room of dungeon.rooms) {
    for (let y = room.y + 1; y < room.y + room.h - 1; y++) {
      for (let x = room.x + 1; x < room.x + room.w - 1; x++) {
        if (dungeon.tiles[y][x] !== Tile.Floor) continue;
        if (excludeNear) {
          const dx = x - excludeNear.x;
          const dy = y - excludeNear.y;
          if (dx * dx + dy * dy < minDist * minDist) continue;
        }
        candidates.push({ x: x + 0.5, y: y + 0.5 });
      }
    }
  }
  if (!candidates.length) return null;
  return candidates[randInt(0, candidates.length - 1)];
}
