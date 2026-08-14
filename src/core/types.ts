export const TILE = 32;
export const MAP_W = 48;
export const MAP_H = 32;
export const VIEW_W = 960;
export const VIEW_H = 640;

export const PLAYER_SPEED = 110;
export const ATTACK_RANGE = 1.15;
export const ATTACK_ARC = Math.PI * 0.7;
export const PLAYER_RADIUS = 0.28;

export enum Tile {
  Wall = 0,
  Floor = 1,
  Door = 2,
  Stairs = 3,
}

export type Vec = { x: number; y: number };

export type Room = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type EnemyKind = "slime" | "bat" | "skeleton" | "brute";

export type Enemy = {
  id: number;
  kind: EnemyKind;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  xp: number;
  attackCd: number;
  flash: number;
  alive: boolean;
};

export type ItemKind = "potion" | "gold" | "key" | "sword" | "heart";

export type Item = {
  id: number;
  kind: ItemKind;
  x: number;
  y: number;
  value: number;
  taken: boolean;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
};

export type FloatingText = {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  vy: number;
};

export type Message = {
  text: string;
  life: number;
};

export type Player = {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  damage: number;
  gold: number;
  keys: number;
  xp: number;
  level: number;
  attackCd: number;
  invuln: number;
  facing: Vec;
  flash: number;
};

export type GameState =
  | "title"
  | "playing"
  | "paused"
  | "dead"
  | "won"
  | "descending";

export const ENEMY_STATS: Record<
  EnemyKind,
  { hp: number; speed: number; damage: number; xp: number; radius: number; color: string }
> = {
  slime: { hp: 18, speed: 48, damage: 6, xp: 8, radius: 10, color: "#6a8f6b" },
  bat: { hp: 10, speed: 90, damage: 5, xp: 10, radius: 8, color: "#8b6bb0" },
  skeleton: { hp: 28, speed: 55, damage: 10, xp: 16, radius: 11, color: "#c8c2b0" },
  brute: { hp: 55, speed: 38, damage: 16, xp: 35, radius: 14, color: "#c44536" },
};

export function createPlayer(): Player {
  return {
    x: 0,
    y: 0,
    hp: 100,
    maxHp: 100,
    damage: 12,
    gold: 0,
    keys: 0,
    xp: 0,
    level: 1,
    attackCd: 0,
    invuln: 0,
    facing: { x: 1, y: 0 },
    flash: 0,
  };
}
