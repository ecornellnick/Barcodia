import type { BattleMapDefinition, BattleUnit } from "./types";
import { tileKey } from "./overlays";

export type ThreatTileSet = {
  threatTiles: Set<string>;
  threateningEnemyIds: Set<string>;
};

function manhattan(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function buildUnitThreatTiles(map: BattleMapDefinition, unit: BattleUnit): Set<string> {
  const tiles = new Set<string>();
  if (unit.defeated || unit.side !== "enemy") return tiles;

  const minRange = unit.rangeMin ?? 1;
  const maxRange = unit.range;

  for (let y = 0; y < map.rows; y += 1) {
    for (let x = 0; x < map.cols; x += 1) {
      const distance = manhattan(unit, { x, y });
      if (distance >= minRange && distance <= maxRange) tiles.add(tileKey(x, y));
    }
  }

  return tiles;
}

export function buildEnemyThreatTiles(map: BattleMapDefinition, units: BattleUnit[]): ThreatTileSet {
  const threatTiles = new Set<string>();
  const threateningEnemyIds = new Set<string>();

  units.forEach((unit) => {
    if (unit.side !== "enemy" || unit.defeated) return;
    threateningEnemyIds.add(unit.id);
    buildUnitThreatTiles(map, unit).forEach((key) => threatTiles.add(key));
  });

  return { threatTiles, threateningEnemyIds };
}
