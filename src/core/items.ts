import type { Item, Player } from "./types";

export type PickupResult = {
  float: string;
  color: string;
  message?: string;
};

export function applyItem(player: Player, item: Item): PickupResult {
  switch (item.kind) {
    case "gold":
      player.gold += item.value;
      return { float: `+${item.value}g`, color: "#e8c547" };
    case "potion":
      player.hp = Math.min(player.maxHp, player.hp + item.value);
      return {
        float: `+${item.value}hp`,
        color: "#6a8f6b",
        message: "You drink a vial of mosswater.",
      };
    case "heart":
      player.maxHp += item.value;
      player.hp += item.value;
      return {
        float: `+${item.value} max`,
        color: "#c44536",
        message: "Your vitality grows.",
      };
    case "sword":
      player.damage += item.value;
      return {
        float: `+${item.value} atk`,
        color: "#d8c9a8",
        message: "A sharper blade.",
      };
    case "key":
      player.keys += 1;
      return { float: "+key", color: "#e07a3a" };
  }
}
