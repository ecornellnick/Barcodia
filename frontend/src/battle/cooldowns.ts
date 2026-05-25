import type { BattleSkillDefinition, BattleUnit } from "./types";

export function getSkillCooldown(unit: BattleUnit, skillId: string): number {
  return Math.max(0, unit.cooldowns?.[skillId] ?? 0);
}

export function isSkillCoolingDown(unit: BattleUnit, skillId: string): boolean {
  return getSkillCooldown(unit, skillId) > 0;
}

export function putSkillOnCooldown(unit: BattleUnit, skill: BattleSkillDefinition): BattleUnit {
  if (skill.cooldown <= 0) return unit;
  return {
    ...unit,
    cooldowns: {
      ...(unit.cooldowns ?? {}),
      [skill.id]: skill.cooldown,
    },
  };
}

export function decrementUnitCooldowns(unit: BattleUnit): BattleUnit {
  const current = unit.cooldowns ?? {};
  const next: Record<string, number> = {};
  Object.entries(current).forEach(([skillId, value]) => {
    const remaining = Math.max(0, Number(value) - 1);
    if (remaining > 0) next[skillId] = remaining;
  });
  return { ...unit, cooldowns: next };
}
