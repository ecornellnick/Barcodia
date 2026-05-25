import type { BattleMapDefinition, BattleSkillDefinition, BattleUnit } from "./types";
import { calculateDamage, canCounterattack } from "./combat";
import { getTerrain, manhattanDistance } from "./terrain";

export type CombatPreview = {
  attackerName: string;
  targetName: string;
  actionName: string;
  expectedDamage: number;
  expectedCounterDamage: number;
  targetHpAfter: number;
  attackerHpAfterCounter: number;
  targetTerrainLabel: string;
  targetTerrainDefenseBonusPct: number;
  inRange: boolean;
  targetWillFall: boolean;
  attackerCanBeCountered: boolean;
};

export function buildCombatPreview(
  map: BattleMapDefinition,
  attacker: BattleUnit | undefined,
  target: BattleUnit | undefined,
  skill?: BattleSkillDefinition,
): CombatPreview | null {
  if (!attacker || !target || attacker.defeated || target.defeated || target.side === "neutral") return null;
  if (attacker.side === target.side && skill?.target !== "ally") return null;

  const distance = manhattanDistance(attacker, target);
  const minRange = skill?.rangeMin ?? attacker.rangeMin ?? 1;
  const maxRange = skill?.range ?? attacker.range;
  const inRange = distance >= minRange && distance <= maxRange;
  const targetTerrain = getTerrain(map, target.x, target.y);

  const baseDamage = calculateDamage(map, attacker, target);
  const expectedDamage = Math.max(
    0,
    Math.round(baseDamage * (skill?.powerMultiplier ?? 1)) + (skill?.flatBonus ?? 0),
  );
  const targetHpAfter = Math.max(0, target.hp - expectedDamage);
  const targetWillFall = targetHpAfter <= 0;

  const attackerCanBeCountered = !targetWillFall && canCounterattack(map, target, attacker);
  const expectedCounterDamage = attackerCanBeCountered
    ? Math.max(3, Math.round(calculateDamage(map, target, attacker) * 0.65))
    : 0;

  return {
    attackerName: attacker.name,
    targetName: target.name,
    actionName: skill?.name ?? "Normal Attack",
    expectedDamage,
    expectedCounterDamage,
    targetHpAfter,
    attackerHpAfterCounter: Math.max(0, attacker.hp - expectedCounterDamage),
    targetTerrainLabel: targetTerrain.label,
    targetTerrainDefenseBonusPct: targetTerrain.defenseBonusPct,
    inRange,
    targetWillFall,
    attackerCanBeCountered,
  };
}
