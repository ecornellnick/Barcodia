import type { BattleUnit } from "./types";

export const BATTLE_UNIT_SPRITES = {
  heroPlain: require("../../assets/images/battle/units/hero_plain_clothes.png"),
  sisterAlly: require("../../assets/images/battle/units/sister_ally.png"),
  tankAlly: require("../../assets/images/battle/units/tank_ally.png"),
  archerAlly: require("../../assets/images/battle/units/archer_ally.png"),
  thugGrunt: require("../../assets/images/battle/units/thug_grunt.png"),
  thugBrawler: require("../../assets/images/battle/units/thug_brawler.png"),
  thugKnife: require("../../assets/images/battle/units/thug_knife.png"),
  pickpocketChild: require("../../assets/images/battle/units/pickpocket_child.png"),
};

export type BattleUnitSpriteKey = keyof typeof BATTLE_UNIT_SPRITES;

export type BattleUnitAssetSpec = {
  key: BattleUnitSpriteKey;
  label: string;
  role: "hero" | "ally" | "enemy" | "neutral";
  productionStatus: "prototype" | "approved" | "final";
  notes: string;
};

export const BATTLE_UNIT_ASSET_MANIFEST: BattleUnitAssetSpec[] = [
  {
    key: "heroPlain",
    label: "Hero — plain clothes",
    role: "hero",
    productionStatus: "prototype",
    notes: "Battle 001 hero sprite. Must eventually be replaced with final approved tactical sprite art.",
  },
  {
    key: "sisterAlly",
    label: "Sister ally",
    role: "ally",
    productionStatus: "prototype",
    notes: "Future controllable/support ally. Included now so party sprite pipeline is planned early.",
  },
  {
    key: "tankAlly",
    label: "Tank ally",
    role: "ally",
    productionStatus: "prototype",
    notes: "Future frontline/tank ally. Included now for party roster roadmap.",
  },
  {
    key: "archerAlly",
    label: "Archer ally",
    role: "ally",
    productionStatus: "prototype",
    notes: "Future ranged ally. Included now for tactical range testing and party roster roadmap.",
  },
  {
    key: "thugGrunt",
    label: "Thug grunt",
    role: "enemy",
    productionStatus: "prototype",
    notes: "Battle 001 enemy placeholder based on the approved clip-art direction.",
  },
  {
    key: "thugBrawler",
    label: "Thug brawler",
    role: "enemy",
    productionStatus: "prototype",
    notes: "Battle 001 melee bruiser placeholder.",
  },
  {
    key: "thugKnife",
    label: "Thug knife fighter",
    role: "enemy",
    productionStatus: "prototype",
    notes: "Battle 001 agile/knife enemy placeholder.",
  },
  {
    key: "pickpocketChild",
    label: "Pickpocket child",
    role: "neutral",
    productionStatus: "prototype",
    notes: "Non-combatant story actor. Does not move, attack, or count toward victory.",
  },
];

export function getBattleUnitSprite(unit: BattleUnit) {
  const spriteKey = (unit as BattleUnit & { spriteKey?: BattleUnitSpriteKey }).spriteKey;
  if (spriteKey && BATTLE_UNIT_SPRITES[spriteKey]) return BATTLE_UNIT_SPRITES[spriteKey];

  const id = unit.id.toLowerCase();
  const name = unit.name.toLowerCase();

  if (id.includes("sister") || name.includes("sister")) return BATTLE_UNIT_SPRITES.sisterAlly;
  if (id.includes("tank") || name.includes("tank")) return BATTLE_UNIT_SPRITES.tankAlly;
  if (id.includes("archer") || name.includes("archer")) return BATTLE_UNIT_SPRITES.archerAlly;
  if (unit.id === "hero_plain_clothes" || unit.side === "ally") return BATTLE_UNIT_SPRITES.heroPlain;
  if (unit.side === "neutral") return BATTLE_UNIT_SPRITES.pickpocketChild;
  if (id.includes("knife") || name.includes("knife")) return BATTLE_UNIT_SPRITES.thugKnife;
  if (id.includes("brawler") || name.includes("brawler")) return BATTLE_UNIT_SPRITES.thugBrawler;
  return BATTLE_UNIT_SPRITES.thugGrunt;
}
