import type { BattlePhase, BattleUnit } from "./types";
import { isBattleDefeat, isBattleVictory } from "./combat";
import { decrementUnitCooldowns } from "./cooldowns";

export type BattleOutcome = "active" | "victory" | "defeat";

export function getBattleOutcome(units: BattleUnit[]): BattleOutcome {
  if (isBattleVictory(units)) return "victory";
  if (isBattleDefeat(units)) return "defeat";
  return "active";
}

export function startPlayerPhase(units: BattleUnit[]): BattleUnit[] {
  return units.map((unit) => {
    if (unit.defeated) return { ...unit, canAct: false, actionState: "done" as const };
    if (unit.side === "ally") {
      return {
        ...decrementUnitCooldowns(unit),
        canAct: true,
        hasMoved: false,
        hasAttacked: false,
        actionState: "ready" as const,
      };
    }
    return { ...unit, canAct: false, actionState: unit.actionState };
  });
}

export function startEnemyPhase(units: BattleUnit[]): BattleUnit[] {
  return units.map((unit) => {
    if (unit.defeated) return { ...unit, canAct: false, actionState: "done" as const };
    if (unit.side === "enemy") {
      return {
        ...decrementUnitCooldowns(unit),
        canAct: true,
        hasMoved: false,
        hasAttacked: false,
        actionState: "ready" as const,
      };
    }
    return { ...unit, canAct: false, actionState: unit.actionState };
  });
}

export function markUnitDone(units: BattleUnit[], unitId: string): BattleUnit[] {
  return units.map((unit) =>
    unit.id === unitId
      ? {
          ...unit,
          canAct: false,
          hasMoved: true,
          hasAttacked: unit.hasAttacked ?? false,
          actionState: "done" as const,
        }
      : unit,
  );
}

export function livingUnitsBySide(units: BattleUnit[], side: BattleUnit["side"]): BattleUnit[] {
  return units.filter((unit) => unit.side === side && !unit.defeated);
}

export function allLivingAlliesDone(units: BattleUnit[]): boolean {
  const allies = livingUnitsBySide(units, "ally");
  return allies.length > 0 && allies.every((unit) => !unit.canAct || unit.hasAttacked || unit.actionState === "done");
}

export function phaseLabel(phase: BattlePhase): string {
  if (phase === "player") return "Player Phase";
  if (phase === "enemy") return "Enemy Phase";
  if (phase === "victory") return "Victory";
  if (phase === "defeat") return "Defeat";
  return "Battle";
}
