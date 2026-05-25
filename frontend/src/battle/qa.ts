import type { BattleScenario, BattleUnit } from "./types";

export type BattleQaIssue = {
  level: "error" | "warning" | "info";
  message: string;
};

export function runBattleQa(scenario: BattleScenario, units: BattleUnit[]): BattleQaIssue[] {
  const issues: BattleQaIssue[] = [];
  const ids = new Set<string>();

  units.forEach((unit) => {
    if (ids.has(unit.id)) issues.push({ level: "error", message: `Duplicate unit id: ${unit.id}` });
    ids.add(unit.id);
    if (unit.x < 0 || unit.y < 0 || unit.x >= scenario.map.cols || unit.y >= scenario.map.rows) {
      issues.push({ level: "error", message: `${unit.name} starts outside the battle map.` });
    }
    if (unit.hp > unit.maxHp) {
      issues.push({ level: "warning", message: `${unit.name} has HP above max HP.` });
    }
  });

  const allies = units.filter((unit) => unit.side === "ally");
  const enemies = units.filter((unit) => unit.side === "enemy");
  const neutrals = units.filter((unit) => unit.side === "neutral");

  if (!allies.length) issues.push({ level: "error", message: "Battle has no allied units." });
  if (!enemies.length) issues.push({ level: "error", message: "Battle has no enemy units." });
  if (!neutrals.some((unit) => unit.id.includes("child"))) {
    issues.push({ level: "info", message: "Battle 001 should include the hidden child as a neutral non-combatant." });
  }

  if (!issues.length) issues.push({ level: "info", message: "Battle QA passed. No obvious setup issues found." });
  return issues;
}

export function formatBattleQaIssues(issues: BattleQaIssue[]): string[] {
  return issues.map((issue) => `${issue.level.toUpperCase()}: ${issue.message}`);
}
