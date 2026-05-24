import type { BattleMapDefinition, BattleUnit, Coord, TerrainKey, TerrainTile } from "./types";

export const TERRAIN: Record<TerrainKey, TerrainTile> = {
  stone: {
    key: "stone",
    label: "Stone Walkway",
    moveCost: 1,
    defenseBonusPct: 0,
    attackBonusPct: 0,
    passable: true,
    description: "Normal village stone path. No bonus.",
  },
  road: {
    key: "road",
    label: "Open Road",
    moveCost: 1,
    defenseBonusPct: -5,
    attackBonusPct: 0,
    passable: true,
    description: "Fast but exposed. Slightly worse defense.",
  },
  grass: {
    key: "grass",
    label: "Yard Grass",
    moveCost: 1,
    defenseBonusPct: 5,
    attackBonusPct: 0,
    passable: true,
    description: "Light cover from uneven ground and garden edges.",
  },
  cover: {
    key: "cover",
    label: "Crates / Cover",
    moveCost: 2,
    defenseBonusPct: 20,
    attackBonusPct: 0,
    passable: true,
    description: "Langrisser-style defensive cover. Slower to cross, safer to hold.",
  },
  alley: {
    key: "alley",
    label: "Narrow Alley",
    moveCost: 1,
    defenseBonusPct: 10,
    attackBonusPct: 0,
    passable: true,
    description: "Chokepoint tile. Good for blocking thugs with a tank/frontliner.",
  },
  fence: {
    key: "fence",
    label: "Fence / Low Wall",
    moveCost: 3,
    defenseBonusPct: 15,
    attackBonusPct: 0,
    passable: true,
    description: "Slow obstacle tile with decent defense. Later may block cavalry-style units.",
  },
  wall: {
    key: "wall",
    label: "House / Wall",
    moveCost: 99,
    defenseBonusPct: 0,
    attackBonusPct: 0,
    passable: false,
    description: "Blocked terrain. Units cannot enter this tile.",
  },
};

export function tileKey(x: number, y: number) {
  return `${x},${y}`;
}

export function manhattanDistance(a: Coord, b: Coord) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function getTerrainKey(map: BattleMapDefinition, x: number, y: number): TerrainKey {
  return map.terrain[y]?.[x] || "stone";
}

export function getTerrain(map: BattleMapDefinition, x: number, y: number): TerrainTile {
  return TERRAIN[getTerrainKey(map, x, y)];
}

export function isInsideMap(map: BattleMapDefinition, x: number, y: number) {
  return x >= 0 && y >= 0 && x < map.cols && y < map.rows;
}

export function isPassable(map: BattleMapDefinition, x: number, y: number) {
  return isInsideMap(map, x, y) && getTerrain(map, x, y).passable;
}

export function movementCost(map: BattleMapDefinition, x: number, y: number) {
  const terrain = getTerrain(map, x, y);
  return terrain.passable ? terrain.moveCost : Number.POSITIVE_INFINITY;
}

export function calculateMoveTiles(map: BattleMapDefinition, unit: BattleUnit) {
  const bestCost = new Map<string, number>();
  const queue: Array<{ x: number; y: number; cost: number }> = [{ x: unit.x, y: unit.y, cost: 0 }];
  bestCost.set(tileKey(unit.x, unit.y), 0);

  while (queue.length) {
    const current = queue.shift()!;
    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ];

    neighbors.forEach((next) => {
      if (!isPassable(map, next.x, next.y)) return;
      const nextCost = current.cost + movementCost(map, next.x, next.y);
      if (nextCost > unit.move) return;
      const key = tileKey(next.x, next.y);
      const previous = bestCost.get(key);
      if (previous !== undefined && previous <= nextCost) return;
      bestCost.set(key, nextCost);
      queue.push({ ...next, cost: nextCost });
    });
  }

  return bestCost;
}

export function calculateAttackTiles(map: BattleMapDefinition, unit: BattleUnit, origin: Coord = unit) {
  const tiles = new Set<string>();
  const minRange = unit.rangeMin ?? 1;
  for (let y = 0; y < map.rows; y += 1) {
    for (let x = 0; x < map.cols; x += 1) {
      const distance = manhattanDistance(origin, { x, y });
      if (distance >= minRange && distance <= unit.range) tiles.add(tileKey(x, y));
    }
  }
  return tiles;
}
