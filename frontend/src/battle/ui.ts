import type { BattlePhase, BattleUnit, TerrainTile } from "./types";

export function unitActionLabel(unit: BattleUnit): string {
  if (unit.defeated) return "Defeated";
  if (unit.actionState === "done" || unit.hasAttacked || !unit.canAct) return "Finished";
  if (unit.hasMoved) return "Moved";
  return "Ready";
}

export function hpPct(unit: BattleUnit): number {
  return Math.max(0, Math.min(100, (unit.hp / unit.maxHp) * 100));
}

export function terrainBonusText(tile: TerrainTile): string {
  const def = tile.defenseBonusPct > 0 ? `+${tile.defenseBonusPct}% DEF` : `${tile.defenseBonusPct}% DEF`;
  const atk = tile.attackBonusPct > 0 ? `+${tile.attackBonusPct}% ATK` : `${tile.attackBonusPct}% ATK`;
  return `${def} • ${atk}`;
}

export function phaseTone(phase: BattlePhase): "player" | "enemy" | "victory" | "defeat" {
  if (phase === "enemy") return "enemy";
  if (phase === "victory") return "victory";
  if (phase === "defeat") return "defeat";
  return "player";
}
