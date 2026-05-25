import type { BattleMapDefinition, BattleSkillDefinition, BattleUnit } from "./types";
import { calculateDamage } from "./combat";
import { manhattanDistance } from "./terrain";
import { getSkillCooldown, isSkillCoolingDown, putSkillOnCooldown } from "./cooldowns";

export const BATTLE_SKILLS: Record<string, BattleSkillDefinition> = {
  focused_strike: {
    id: "focused_strike",
    name: "Focused Strike",
    description: "A precise melee strike. Higher damage, then enters cooldown.",
    kind: "attack",
    target: "enemy",
    range: 1,
    cooldown: 2,
    powerMultiplier: 1.35,
    exclusiveTo: ["hero"],
  },
  guard_break: {
    id: "guard_break",
    name: "Guard Break",
    description: "A heavy attack that hits harder against guarded foes.",
    kind: "attack",
    target: "enemy",
    range: 1,
    cooldown: 3,
    powerMultiplier: 1.18,
    flatBonus: 4,
    exclusiveTo: ["hero", "tank"],
  },
  recover: {
    id: "recover",
    name: "Recover",
    description: "Restore a small amount of HP to an adjacent ally or self.",
    kind: "heal",
    target: "ally",
    range: 1,
    cooldown: 3,
    healAmount: 18,
    shared: true,
  },
  thug_strike: {
    id: "thug_strike",
    name: "Street Strike",
    description: "A basic attack used by thugs.",
    kind: "attack",
    target: "enemy",
    range: 1,
    cooldown: 0,
    powerMultiplier: 1,
    exclusiveTo: ["thug", "rogue"],
  },
};

export type SkillUseResult = {
  units: BattleUnit[];
  log: string[];
  ok: boolean;
};

export function getSkillsForUnit(unit: BattleUnit): BattleSkillDefinition[] {
  const explicit = (unit.skillIds ?? [])
    .map((skillId) => BATTLE_SKILLS[skillId])
    .filter(Boolean);
  if (explicit.length) return explicit;

  return Object.values(BATTLE_SKILLS).filter((skill) => {
    if (skill.shared && unit.side === "ally") return true;
    return skill.exclusiveTo?.includes(unit.classKey) ?? false;
  });
}

export function skillRangeText(skill: BattleSkillDefinition): string {
  const min = skill.rangeMin ?? 1;
  return min === skill.range ? `${skill.range}` : `${min}-${skill.range}`;
}

export function canUseSkill(caster: BattleUnit, skill: BattleSkillDefinition): boolean {
  return !caster.defeated && caster.canAct && !caster.hasAttacked && !isSkillCoolingDown(caster, skill.id);
}

export function canTargetWithSkill(
  map: BattleMapDefinition,
  caster: BattleUnit,
  target: BattleUnit,
  skill: BattleSkillDefinition,
): boolean {
  if (!canUseSkill(caster, skill)) return false;
  if (!target || target.defeated || !target.targetable) return false;
  if (caster.side === "neutral" || target.side === "neutral") return false;
  if (skill.target === "enemy" && caster.side === target.side) return false;
  if (skill.target === "ally" && caster.side !== target.side) return false;
  if (skill.target === "self" && caster.id !== target.id) return false;
  const distance = manhattanDistance(caster, target);
  const minRange = skill.rangeMin ?? 0;
  return distance >= minRange && distance <= skill.range;
}

function markCasterAfterSkill(caster: BattleUnit, skill: BattleSkillDefinition): BattleUnit {
  return putSkillOnCooldown(
    {
      ...caster,
      hasAttacked: true,
      canAct: false,
      actionState: "done",
    },
    skill,
  );
}

export function resolveSkillUse(
  map: BattleMapDefinition,
  inputUnits: BattleUnit[],
  casterId: string,
  targetId: string,
  skillId: string,
): SkillUseResult {
  const skill = BATTLE_SKILLS[skillId];
  const caster = inputUnits.find((unit) => unit.id === casterId);
  const target = inputUnits.find((unit) => unit.id === targetId);

  if (!skill || !caster || !target) {
    return { units: inputUnits, log: ["Skill failed: missing skill or target."], ok: false };
  }

  if (!canTargetWithSkill(map, caster, target, skill)) {
    const cooldown = getSkillCooldown(caster, skill.id);
    const reason = cooldown > 0 ? `${skill.name} is cooling down for ${cooldown} turn(s).` : `${caster.name} cannot use ${skill.name} on ${target.name}.`;
    return { units: inputUnits, log: [reason], ok: false };
  }

  const log: string[] = [];
  let targetAfter = target;

  if (skill.kind === "heal") {
    const amount = skill.healAmount ?? 12;
    const nextHp = Math.min(target.maxHp, target.hp + amount);
    targetAfter = { ...target, hp: nextHp };
    log.push(`${caster.name} used ${skill.name}. ${target.name} recovered ${nextHp - target.hp} HP.`);
  } else {
    const baseDamage = calculateDamage(map, caster, target);
    const damage = Math.max(1, Math.round(baseDamage * (skill.powerMultiplier ?? 1)) + (skill.flatBonus ?? 0));
    const nextHp = Math.max(0, target.hp - damage);
    targetAfter = {
      ...target,
      hp: nextHp,
      defeated: nextHp <= 0,
      canAct: nextHp <= 0 ? false : target.canAct,
      actionState: nextHp <= 0 ? "done" : target.actionState,
    };
    log.push(`${caster.name} used ${skill.name} on ${target.name} for ${damage} damage.`);
    if (targetAfter.defeated) log.push(`${target.name} was defeated.`);
  }

  const casterAfter = markCasterAfterSkill(caster, skill);
  const units = inputUnits.map((unit) => {
    if (unit.id === casterId) return casterAfter;
    if (unit.id === targetId) return targetAfter;
    return unit;
  });

  if (skill.cooldown > 0) log.push(`${skill.name} cooldown: ${skill.cooldown} turn(s).`);

  return { units, log, ok: true };
}
