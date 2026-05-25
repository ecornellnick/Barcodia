import type { BattleMapDefinition, BattleSkillDefinition, BattleUnit } from "./types";
import { calculateLegalMoveTiles } from "./movement";
import { manhattanDistance } from "./terrain";

export type TacticalOverlaySet = {
  movementTiles: Set<string>;
  attackTiles: Set<string>;
  attackableEnemyIds: Set<string>;
};

export function tileKey(x: number, y: number): string {
  return `${x},${y}`;
}

export function buildAttackTiles(
  map: BattleMapDefinition,
  unit: BattleUnit | undefined,
  skill?: BattleSkillDefinition,
): Set<string> {
  const tiles = new Set<string>();
  if (!unit || unit.defeated) return tiles;
  const minRange = skill?.rangeMin ?? unit.rangeMin ?? 1;
  const maxRange = skill?.range ?? unit.range;
  for (let y = 0; y < map.rows; y += 1) {
    for (let x = 0; x < map.cols; x += 1) {
      const distance = Math.abs(unit.x - x) + Math.abs(unit.y - y);
      if (distance >= minRange && distance <= maxRange) tiles.add(tileKey(x, y));
    }
  }
  return tiles;
}

export function buildAttackableEnemyIds(
  unit: BattleUnit | undefined,
  units: BattleUnit[],
  skill?: BattleSkillDefinition,
): Set<string> {
  const ids = new Set<string>();
  if (!unit || unit.defeated) return ids;
  const minRange = skill?.rangeMin ?? unit.rangeMin ?? 1;
  const maxRange = skill?.range ?? unit.range;
  const targetSide = skill?.target === "ally" ? unit.side : unit.side === "ally" ? "enemy" : "ally";
  units.forEach((target) => {
    if (target.defeated || target.side !== targetSide) return;
    const distance = manhattanDistance(unit, target);
    if (distance >= minRange && distance <= maxRange) ids.add(target.id);
  });
  return ids;
}

export function buildTacticalOverlays(
  map: BattleMapDefinition,
  units: BattleUnit[],
  selected: BattleUnit | undefined,
  mode: "move" | "attack",
  skill?: BattleSkillDefinition,
): TacticalOverlaySet {
  return {
    movementTiles: mode === "move" && selected ? calculateLegalMoveTiles(map, units, selected) : new Set<string>(),
    attackTiles: mode === "attack" && selected ? buildAttackTiles(map, selected, skill) : new Set<string>(),
    attackableEnemyIds: mode === "attack" && selected ? buildAttackableEnemyIds(selected, units, skill) : new Set<string>(),
  };
}
