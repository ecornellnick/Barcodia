import type { BattleMapDefinition, BattleUnit } from "./types";
import { calculateAttackTiles, getTerrain, manhattanDistance, tileKey } from "./terrain";

export type CombatResult = {
  units: BattleUnit[];
  log: string[];
  defeatedUnitIds: string[];
};

export function livingEnemies(units: BattleUnit[]) {
  return units.filter((unit) => unit.side === "enemy" && !unit.defeated);
}

export function livingAllies(units: BattleUnit[]) {
  return units.filter((unit) => unit.side === "ally" && !unit.defeated);
}

export function isBattleVictory(units: BattleUnit[]) {
  return livingEnemies(units).length === 0;
}

export function isBattleDefeat(units: BattleUnit[]) {
  return livingAllies(units).length === 0;
}

export function canAttackTarget(map: BattleMapDefinition, attacker: BattleUnit, defender: BattleUnit) {
  if (!attacker || !defender) return false;
  if (attacker.defeated || defender.defeated) return false;
  if (!attacker.canAct || attacker.hasAttacked) return false;
  if (!defender.targetable) return false;
  if (attacker.side === defender.side) return false;
  if (attacker.side === "neutral" || defender.side === "neutral") return false;

  const attackTiles = calculateAttackTiles(map, attacker);
  return attackTiles.has(tileKey(defender.x, defender.y));
}

export function calculateDamage(map: BattleMapDefinition, attacker: BattleUnit, defender: BattleUnit) {
  const defenderTerrain = getTerrain(map, defender.x, defender.y);
  const terrainDefenseBonus = Math.max(-50, Math.min(60, defenderTerrain.defenseBonusPct));
  const effectiveDefense = Math.max(0, Math.round(defender.defense * (1 + terrainDefenseBonus / 100)));
  const attackTerrain = getTerrain(map, attacker.x, attacker.y);
  const attackBonus = Math.max(-50, Math.min(60, attackTerrain.attackBonusPct));
  const effectiveAttack = Math.round(attacker.attack * (1 + attackBonus / 100));
  const raw = effectiveAttack - effectiveDefense;
  const minimum = attacker.range > 1 ? 4 : 6;
  return Math.max(minimum, raw);
}

function applyDamage(unit: BattleUnit, damage: number): BattleUnit {
  const nextHp = Math.max(0, unit.hp - damage);
  return {
    ...unit,
    hp: nextHp,
    defeated: nextHp <= 0,
    canAct: nextHp <= 0 ? false : unit.canAct,
    actionState: nextHp <= 0 ? "done" : unit.actionState,
  };
}

export function canCounterattack(map: BattleMapDefinition, defender: BattleUnit, attacker: BattleUnit) {
  if (defender.defeated || attacker.defeated) return false;
  if (!defender.targetable || defender.side === "neutral") return false;
  const minRange = defender.rangeMin ?? 1;
  const distance = manhattanDistance(defender, attacker);
  return distance >= minRange && distance <= defender.range;
}

export function resolveAttack(
  map: BattleMapDefinition,
  units: BattleUnit[],
  attackerId: string,
  defenderId: string,
): CombatResult {
  const attacker = units.find((unit) => unit.id === attackerId);
  const defender = units.find((unit) => unit.id === defenderId);

  if (!attacker || !defender) {
    return { units, log: ["Attack failed: unit missing."], defeatedUnitIds: [] };
  }

  if (!canAttackTarget(map, attacker, defender)) {
    return { units, log: [`${attacker.name} cannot attack ${defender.name} from here.`], defeatedUnitIds: [] };
  }

  const damage = calculateDamage(map, attacker, defender);
  const defenderAfterHit = applyDamage(defender, damage);
  const defeatedUnitIds: string[] = defenderAfterHit.defeated ? [defenderAfterHit.id] : [];
  const log: string[] = [`${attacker.name} attacked ${defender.name} for ${damage} damage.`];

  let attackerAfterCombat: BattleUnit = {
    ...attacker,
    hasAttacked: true,
    canAct: false,
    actionState: "done",
  };

  if (defenderAfterHit.defeated) {
    log.push(`${defender.name} was defeated.`);
  } else if (canCounterattack(map, defenderAfterHit, attackerAfterCombat)) {
    const counterDamage = Math.max(3, Math.round(calculateDamage(map, defenderAfterHit, attackerAfterCombat) * 0.65));
    attackerAfterCombat = applyDamage(attackerAfterCombat, counterDamage);
    log.push(`${defender.name} counterattacked for ${counterDamage} damage.`);
    if (attackerAfterCombat.defeated) {
      defeatedUnitIds.push(attackerAfterCombat.id);
      log.push(`${attacker.name} was defeated.`);
    }
  }

  const nextUnits = units.map((unit) => {
    if (unit.id === attackerId) return attackerAfterCombat;
    if (unit.id === defenderId) return defenderAfterHit;
    return unit;
  });

  if (isBattleVictory(nextUnits)) log.push("Victory condition met: all thugs defeated.");
  if (isBattleDefeat(nextUnits)) log.push("Defeat condition met: all allies defeated.");

  return { units: nextUnits, log, defeatedUnitIds };
}
