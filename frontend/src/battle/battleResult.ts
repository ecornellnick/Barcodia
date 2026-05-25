import type { BattleUnit } from "./types";

export type TacticalBattleResultStatus = "active" | "victory" | "defeat";

export type TacticalBattleResult = {
  status: TacticalBattleResultStatus;
  title: string;
  message: string;
  defeatedEnemies: number;
  survivingAllies: number;
  resultFlags: string[];
};

export function buildBattleResult(units: BattleUnit[]): TacticalBattleResult {
  const livingEnemies = units.filter((unit) => unit.side === "enemy" && !unit.defeated).length;
  const defeatedEnemies = units.filter((unit) => unit.side === "enemy" && unit.defeated).length;
  const livingAllies = units.filter((unit) => unit.side === "ally" && !unit.defeated).length;
  const heroDefeated = units.some((unit) => unit.id === "hero_plain_clothes" && unit.defeated);

  if (livingEnemies <= 0) {
    return {
      status: "victory",
      title: "Victory",
      message: "The thugs are defeated. This result can later return to a Story Builder victory scene.",
      defeatedEnemies,
      survivingAllies: livingAllies,
      resultFlags: ["battle_001_city_street_ambush_victory"],
    };
  }

  if (heroDefeated || livingAllies <= 0) {
    return {
      status: "defeat",
      title: "Defeat",
      message: "The hero is defeated. This result can later return to a Story Builder defeat scene.",
      defeatedEnemies,
      survivingAllies: livingAllies,
      resultFlags: ["battle_001_city_street_ambush_defeat"],
    };
  }

  return {
    status: "active",
    title: "Battle Active",
    message: "Battle is still in progress.",
    defeatedEnemies,
    survivingAllies: livingAllies,
    resultFlags: [],
  };
}

export function battleResultSummary(result: TacticalBattleResult): string {
  if (result.status === "active") return "Battle is active.";
  return `${result.title}: ${result.message}`;
}
