export type TerrainKey =
  | "stone"
  | "road"
  | "grass"
  | "cover"
  | "wall"
  | "alley"
  | "fence";

export type UnitSide = "ally" | "enemy" | "neutral";

export type BattleUnitClass =
  | "hero"
  | "support"
  | "tank"
  | "archer"
  | "thug"
  | "rogue"
  | "noncombatant";

export type BattleSkillTarget = "enemy" | "ally" | "self";
export type BattleSkillKind = "attack" | "heal" | "debuff";

export type BattleSkillDefinition = {
  id: string;
  name: string;
  description: string;
  kind: BattleSkillKind;
  target: BattleSkillTarget;
  rangeMin?: number;
  range: number;
  cooldown: number;
  powerMultiplier?: number;
  flatBonus?: number;
  healAmount?: number;
  shared?: boolean;
  exclusiveTo?: BattleUnitClass[];
};

export type SkillCooldownState = Record<string, number>;

export type BattleUnit = {
  id: string;
  name: string;
  side: UnitSide;
  classKey: BattleUnitClass;
  role: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  move: number;
  rangeMin?: number;
  range: number;
  canAct: boolean;
  targetable: boolean;
  hasMoved?: boolean;
  hasAttacked?: boolean;
  defeated?: boolean;
  actionState?: "ready" | "moved" | "attacked" | "done";
  skillIds?: string[];
  cooldowns?: SkillCooldownState;
  note?: string;
};

export type TerrainTile = {
  key: TerrainKey;
  label: string;
  moveCost: number;
  defenseBonusPct: number;
  attackBonusPct: number;
  passable: boolean;
  description: string;
};

export type BattleMapDefinition = {
  id: string;
  title: string;
  subtitle: string;
  cols: number;
  rows: number;
  backgroundAssetKey: "first_battle_map";
  terrain: TerrainKey[][];
  storyNotes: string[];
};

export type BattleScenario = {
  id: string;
  title: string;
  map: BattleMapDefinition;
  units: BattleUnit[];
  victoryCondition: string;
  defeatCondition: string;
};

export type Coord = { x: number; y: number };

export type BattlePhase = "player" | "enemy" | "victory" | "defeat";

export type BattleLogEntry = {
  id: string;
  message: string;
};
