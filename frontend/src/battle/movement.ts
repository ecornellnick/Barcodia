import type { BattleMapDefinition, BattleUnit, Coord } from "./types";
import { calculateMoveTiles, isPassable, tileKey } from "./terrain";

export function getUnitAt(units: BattleUnit[], x: number, y: number) {
  return units.find((unit) => !unit.defeated && unit.x === x && unit.y === y);
}

export function isTileOccupied(units: BattleUnit[], x: number, y: number, ignoreUnitId?: string) {
  return units.some((unit) => !unit.defeated && unit.id !== ignoreUnitId && unit.x === x && unit.y === y);
}

export function calculateLegalMoveTiles(map: BattleMapDefinition, unit: BattleUnit, units: BattleUnit[]) {
  const raw = calculateMoveTiles(map, unit);
  const legal = new Map<string, number>();

  raw.forEach((cost, key) => {
    const [xText, yText] = key.split(",");
    const x = Number(xText);
    const y = Number(yText);
    if (!isPassable(map, x, y)) return;
    if (isTileOccupied(units, x, y, unit.id)) return;
    legal.set(key, cost);
  });

  return legal;
}

export function canMoveUnitTo(map: BattleMapDefinition, unit: BattleUnit, units: BattleUnit[], target: Coord) {
  if (!unit.canAct || unit.hasMoved || unit.side !== "ally") return false;
  const legal = calculateLegalMoveTiles(map, unit, units);
  return legal.has(tileKey(target.x, target.y));
}

export function moveUnit(units: BattleUnit[], unitId: string, target: Coord) {
  return units.map((unit) => {
    if (unit.id !== unitId) return unit;
    return {
      ...unit,
      x: target.x,
      y: target.y,
      hasMoved: true,
      actionState: "moved" as const,
    };
  });
}

export function resetAllyMovement(units: BattleUnit[]) {
  return units.map((unit) =>
    unit.side === "ally"
      ? { ...unit, canAct: true, hasMoved: false, hasAttacked: false, actionState: "ready" as const }
      : unit,
  );
}
