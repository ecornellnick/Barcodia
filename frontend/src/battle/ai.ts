import type { BattleMapDefinition, BattleUnit, Coord } from "./types";
import { resolveAttack, canAttackTarget, isBattleDefeat, isBattleVictory } from "./combat";
import { calculateLegalMoveTiles, moveUnit } from "./movement";
import { manhattanDistance } from "./terrain";
import { markUnitDone } from "./turns";

export type EnemyPhaseResult = {
  units: BattleUnit[];
  log: string[];
};

function nearestLivingAlly(enemy: BattleUnit, units: BattleUnit[]): BattleUnit | undefined {
  return units
    .filter((unit) => unit.side === "ally" && !unit.defeated && unit.targetable)
    .sort((a, b) => manhattanDistance(enemy, a) - manhattanDistance(enemy, b))[0];
}

function attackableAlly(map: BattleMapDefinition, enemy: BattleUnit, units: BattleUnit[]): BattleUnit | undefined {
  return units
    .filter((unit) => unit.side === "ally" && !unit.defeated && unit.targetable)
    .filter((unit) => canAttackTarget(map, enemy, unit))
    .sort((a, b) => a.hp - b.hp)[0];
}

function bestMoveToward(map: BattleMapDefinition, enemy: BattleUnit, units: BattleUnit[], target: BattleUnit): Coord | undefined {
  const legalMoves = calculateLegalMoveTiles(map, enemy, units);
  let best: Coord | undefined;
  let bestScore = Number.POSITIVE_INFINITY;

  legalMoves.forEach((cost, key) => {
    const [xText, yText] = key.split(",");
    const x = Number(xText);
    const y = Number(yText);
    const distance = manhattanDistance({ x, y }, target);
    const score = distance * 10 + cost;
    if (score < bestScore) {
      bestScore = score;
      best = { x, y };
    }
  });

  if (!best) return undefined;
  if (best.x === enemy.x && best.y === enemy.y) return undefined;
  return best;
}

export function runEnemyPhase(map: BattleMapDefinition, inputUnits: BattleUnit[]): EnemyPhaseResult {
  let units = inputUnits.map((unit) => ({ ...unit }));
  const log: string[] = ["Enemy phase started."];
  const enemyIds = units.filter((unit) => unit.side === "enemy" && !unit.defeated).map((unit) => unit.id);

  for (const enemyId of enemyIds) {
    let enemy = units.find((unit) => unit.id === enemyId);
    if (!enemy || enemy.defeated) continue;

    let target = attackableAlly(map, enemy, units);
    if (target) {
      const result = resolveAttack(map, units, enemy.id, target.id);
      units = result.units;
      log.push(...result.log);
      if (isBattleVictory(units) || isBattleDefeat(units)) break;
      continue;
    }

    const nearest = nearestLivingAlly(enemy, units);
    if (!nearest) break;

    const moveTarget = bestMoveToward(map, enemy, units, nearest);
    if (moveTarget) {
      units = moveUnit(units, enemy.id, moveTarget);
      log.push(`${enemy.name} moved toward ${nearest.name}.`);
      enemy = units.find((unit) => unit.id === enemyId);
    }

    if (!enemy || enemy.defeated) continue;
    target = attackableAlly(map, enemy, units);
    if (target) {
      const result = resolveAttack(map, units, enemy.id, target.id);
      units = result.units;
      log.push(...result.log);
      if (isBattleVictory(units) || isBattleDefeat(units)) break;
      continue;
    }

    units = markUnitDone(units, enemy.id);
    log.push(`${enemy.name} held position.`);
  }

  if (isBattleVictory(units)) log.push("Victory: all thugs are defeated.");
  if (isBattleDefeat(units)) log.push("Defeat: the hero has fallen.");
  if (!isBattleVictory(units) && !isBattleDefeat(units)) log.push("Enemy phase ended.");

  return { units, log };
}
