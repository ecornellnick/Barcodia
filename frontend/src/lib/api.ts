import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;

export type Slot =
  | "head" | "chest" | "leg_l" | "leg_r" | "arm_l" | "arm_r"
  | "main_hand" | "off_hand" | "trinket" | "ring" | "necklace"
  | "consumable" | "upgrade";

export const GEAR_SLOTS: Slot[] = [
  "head", "chest", "leg_l", "leg_r", "arm_l", "arm_r",
  "main_hand", "off_hand", "trinket", "ring", "necklace",
];

export type Element = "none" | "fire" | "lightning" | "ice" | "holy" | "shadow" | "nature";

export type ClassKey = "infantry" | "lancer" | "cavalry" | "archer" | "assassin" | "flier" | "aquatic" | "mage" | "healer" | "holy" | "demon";
export type ClassChip = { key: ClassKey | string; label: string; icon: string };
export type ClassState = { primary: ClassChip; secondary?: ClassChip | null; scores?: Record<string, number>; legend?: { from: ClassChip; to: ClassChip }[] };
export type TalentNode = { id: string; tree: string; name: string; icon: string; max_rank: number; cost: number; rank: number; can_rank: boolean; description: string; requires?: string; locked?: boolean; locked_text?: string; requires_class?: string; class_affinity?: number; warning?: boolean; warning_text?: string; effects?: Record<string, number>; total_added?: Record<string, number>; position?: number };
export type TalentState = { test_mode: boolean; reset_free: boolean; points_total: number; points_spent: number; points_available: number; talents: Record<string, number>; nodes: TalentNode[]; effects: Record<string, number>; reset_cost: number };
export type Skill = { id: string; name: string; class_key: string; icon: string; mp_cost: number; power: number; kind: string; scales_with: string; description: string; effective_vs?: string[]; status?: string; status_chance?: number; class_chip?: ClassChip; affinity_percent?: number; damage_modifier?: number; accuracy_modifier?: number; status_text?: string; warning?: boolean; penalty_text?: string };

export type Item = {
  id: string; owner_id: string; barcode: string; name: string; lore: string; slot: Slot;
  rarity: "common" | "rare" | "epic" | "legendary"; level: number; element: Element;
  material: string; shape: string; weight: string; family: string; two_handed: boolean;
  atk: number; int_stat: number; def_stat: number; res: number; dex: number; mob: number;
  crit: number; luk: number; hp: number; mana: number; stamina_restore?: number;
  upgrade_xp?: number; upgrade_xp_to_next?: number; upgrade_xp_value?: number;
  icon?: string;
  class_tags?: ClassKey[]; effective_vs?: ClassKey[];
  equipped: boolean; equip_slot?: Slot; listed: boolean;
  scan_count?: number; recent_duplicate?: boolean; discovery_bonus?: boolean;
  product_source?: string; message?: string; sigil_charge?: number; sigil_charge_max?: number;
};

export type User = {
  id: string; email: string; username: string; avatar?: string; auth_provider?: string;
  level: number; xp: number; gold: number; hp: number; mana: number; max_hp: number; max_mana: number;
  stamina: number; stamina_max: number; stamina_next_seconds?: number; stamina_regen_seconds?: number; sigil_charge?: number; sigil_charge_max?: number; sigil_next_seconds?: number; sigil_regen_seconds?: number;
  difficulty_tier: number; battles_won: number; battles_lost: number; class_affinity?: Record<string, number>; aether_gems?: number; premium_currency_key?: string; premium_currency_name?: string;
};

export type Listing = { id: string; item: Item; seller_id: string; seller_name: string; price: number; min_price: number; max_price: number };
export type StoreItem = Partial<Item> & { id: string; name: string; item_type?: string; gold_cost: number; description?: string; image?: string; image_url?: string; enabled?: boolean; can_appear_in_store?: boolean };
export type Totals = { atk: number; int_stat: number; def_stat: number; res: number; dex: number; mob: number; crit: number; luk: number; hp_bonus: number; mana_bonus: number };
export type Enemy = { id: string; name: string; archetype: string; class_tags?: ClassKey[]; class_chips?: ClassChip[]; portrait: string; tier: number; elite: boolean; hp: number; max_hp: number; atk: number; int_stat: number; def_stat: number; res: number; dex: number; mob: number; crit: number };
export type BattleLog = { side: "player" | "enemy"; kind: "attack" | "skill" | "item" | "flee" | "miss"; dmg: number; crit?: boolean; effective?: boolean; msg: string };
export type DailyGoal = { key: string; label: string; target: number; progress: number; done: boolean; claimed: boolean; reward_gold: number; reward_xp: number };
export type DailyGoalsPayload = { date: string; goals: DailyGoal[]; all_done: boolean; claimed_all: boolean; complete_reward: number; premium_currency_key: string; premium_currency_name: string; currency_balance: number };
export type AdventureNode = { node: number; kind: "normal" | "elite" | "miniboss" | "boss"; name: string; enemy: string; x: number; y: number; completed: boolean; unlocked: boolean; current: boolean };
export type AdventureMap = { tier: number; name: string; subtitle: string; biome: string; background: string; accent: string; progress: { tier: number; highest_node: number; completed: number[] }; nodes: AdventureNode[] };
export type ScanResult = Item;

async function request<T>(path: string, options: { method?: string; body?: any; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.auth !== false) {
    const token = await storage.secureGet<string>("bq_token", "");
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${BASE}/api${path}`, { method: options.method ?? "GET", headers, body: options.body ? JSON.stringify(options.body) : undefined });
  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { detail: text }; }
  if (!res.ok) throw new Error(data?.detail ?? `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  register: (email: string, password: string, username: string) => request<{ token: string; user: User }>("/auth/register", { method: "POST", body: { email, password, username }, auth: false }),
  login: (email: string, password: string) => request<{ token: string; user: User }>("/auth/login", { method: "POST", body: { email, password }, auth: false }),
  googleSession: (session_id: string) => request<{ token: string; user: User }>("/auth/google/session", { method: "POST", body: { session_id }, auth: false }),
  updateAvatar: (avatar: string) => request<User>("/auth/avatar", { method: "PUT", body: { avatar } }),
  me: () => request<User>("/auth/me"),
  character: () => request<{ user: User; equipped: Item[]; totals: Totals; class_state: ClassState; talent_state?: TalentState; xp_to_next: number }>("/character"),
  talents: () => request<TalentState>("/talents"),
  spendTalent: (talent_id: string) => request<TalentState>("/talents/spend", { method: "POST", body: { talent_id } }),
  resetTalents: () => request<TalentState>("/talents/reset", { method: "POST", body: { confirm: true } }),
  dailyGoals: () => request<DailyGoalsPayload>("/daily-goals"),
  adventureMap: () => request<AdventureMap>("/adventure/map"),
  adventureStart: (node_no: number) => request<{ ok: boolean; enemy: Enemy; mode: string; tier: number; node: number; stamina: number; stamina_max: number }>(`/adventure/start/${node_no}`, { method: "POST" }),
  scan: (barcode: string) => request<ScanResult>("/scan", { method: "POST", body: { barcode } }),
  inventory: () => request<Item[]>("/inventory"),
  equip: (id: string, slot?: Slot) => request<{ ok: boolean; equip_slot: Slot }>(`/items/${id}/equip`, { method: "POST", body: { slot } }),
  unequip: (id: string) => request<{ ok: boolean }>(`/items/${id}/unequip`, { method: "POST" }),
  use: (id: string) => request<{ ok: boolean; hp: number; mana: number; stamina?: number }>(`/items/${id}/use`, { method: "POST" }),
  destroy: (id: string) => request<{ ok: boolean; refund: number }>(`/items/${id}/destroy`, { method: "POST" }),
  upgrade: (target_item_id: string, scroll_item_id: string) => request<{ ok: boolean; item: Item; xp_added?: number; leveled?: boolean }>("/items/upgrade", { method: "POST", body: { target_item_id, scroll_item_id } }),
  priceBand: (id: string) => request<{ min_price: number; max_price: number }>(`/market/price-band/${id}`),
  listItem: (item_id: string, price: number) => request<Listing>("/market/list", { method: "POST", body: { item_id, price } }),
  storeGold: () => request<{ items: StoreItem[]; gold: number; inventory_max: number }>("/store/gold"),
  buyStoreGold: (id: string) => request<{ ok: boolean; item: Item; gold_spent: number; gold: number }>(`/store/gold/buy/${id}`, { method: "POST", body: { quantity: 1 } }),
  listings: () => request<Listing[]>("/market/listings"),
  cancelListing: (id: string) => request<{ ok: boolean }>(`/market/cancel/${id}`, { method: "POST" }),
  buyListing: (id: string) => request<{ ok: boolean }>(`/market/buy/${id}`, { method: "POST" }),
  battlePreview: () => request<{ enemy: Enemy; stamina: number; stamina_max: number; stamina_next_seconds?: number; stamina_regen_seconds?: number; sigil_charge?: number; sigil_charge_max?: number; sigil_next_seconds?: number; sigil_regen_seconds?: number; change_enemy_seconds?: number; change_enemy_ready?: boolean; difficulty_tier: number; class_state: ClassState; main_weapon: Item | null; totals: Totals; skills: Skill[]; turn: string; battle_active: boolean; mode?: string; adventure_node?: number; adventure_tier?: number }>("/battle/preview"),
  battleSkip: () => request<{ enemy: Enemy; turn: string; change_enemy_seconds?: number; change_enemy_ready?: boolean }>("/battle/skip", { method: "POST" }),
  battleFight: (action: "weapon" | "skill" | "item" | "flee" = "weapon", item_id?: string, skill_id?: string, mode?: "quick" | "adventure") =>
    request<{ resolved: boolean; win: boolean; escaped?: boolean; log: BattleLog[]; enemy: Enemy; rewards: { xp: number; gold: number; item: Item | null }; user: User; next_enemy: Enemy; class_state?: ClassState; main_weapon?: Item | null; skills?: Skill[]; turn?: string; mode?: string; adventure_node?: number; adventure_tier?: number }>("/battle/fight", { method: "POST", body: { action, item_id, skill_id, mode } }),
};

export const CLASS_META: Record<string, ClassChip> = {
  infantry: { key: "infantry", label: "Infantry", icon: "⚔️" }, lancer: { key: "lancer", label: "Lancer", icon: "🔱" }, cavalry: { key: "cavalry", label: "Cavalry", icon: "🐎" },
  archer: { key: "archer", label: "Archer", icon: "🏹" }, assassin: { key: "assassin", label: "Assassin", icon: "🗡️" }, flier: { key: "flier", label: "Flier", icon: "🪽" },
  aquatic: { key: "aquatic", label: "Aquatic", icon: "🌊" }, mage: { key: "mage", label: "Mage", icon: "✨" }, healer: { key: "healer", label: "Healer", icon: "💚" },
  holy: { key: "holy", label: "Holy", icon: "☀️" }, demon: { key: "demon", label: "Demon", icon: "☠️" },
};
export const chipFor = (key?: string): ClassChip => (key && CLASS_META[key]) || { key: key || "unknown", label: key || "Unknown", icon: "◇" };

export const RARITY_COLORS: Record<Item["rarity"], string> = { common: "#718096", rare: "#3182CE", epic: "#805AD5", legendary: "#D69E2E" };
export const RARITY_GLOW: Record<Item["rarity"], string> = { common: "rgba(113,128,150,0.35)", rare: "rgba(49,130,206,0.55)", epic: "rgba(128,90,213,0.65)", legendary: "rgba(214,158,46,0.75)" };
export const SLOT_ICON: Record<Slot, string> = { head: "🪖", chest: "🛡️", leg_l: "🥾", leg_r: "🥾", arm_l: "🧤", arm_r: "🧤", main_hand: "⚔️", off_hand: "🛡️", trinket: "🧿", ring: "💍", necklace: "📿", consumable: "🧪", upgrade: "🔷" };
export function itemIcon(item?: Partial<Item> | null): string {
  if (!item) return "◇";
  if (item.icon) return item.icon;
  const tags = item.class_tags || [];
  if (item.slot === "main_hand") {
    if (tags.includes("archer")) return "🏹";
    if (tags.includes("lancer")) return "🔱";
    if (tags.includes("mage") || tags.includes("healer")) return "🪄";
    if (tags.includes("assassin")) return "🗡️";
    return "⚔️";
  }
  return item.slot ? SLOT_ICON[item.slot] : "◇";
}
export const SLOT_LABEL: Record<Slot, string> = { head: "Head", chest: "Chest", leg_l: "L Leg", leg_r: "R Leg", arm_l: "L Arm", arm_r: "R Arm", main_hand: "Main", off_hand: "Off", trinket: "Trinket", ring: "Ring", necklace: "Neck", consumable: "Consumable", upgrade: "Shard" };
export const ELEMENT_COLOR: Record<Element, string> = { none: "#A0AEC0", fire: "#F56565", lightning: "#ECC94B", ice: "#63B3ED", holy: "#FBD38D", shadow: "#9F7AEA", nature: "#68D391" };
export const STAT_META: { key: keyof Item & string; label: string; color: string }[] = [
  { key: "atk", label: "ATK", color: "#FF6B6B" }, { key: "int_stat", label: "INT", color: "#A78BFA" }, { key: "def_stat", label: "DEF", color: "#4ECDC4" }, { key: "res", label: "RES", color: "#63B3ED" },
  { key: "dex", label: "DEX", color: "#F6AD55" }, { key: "mob", label: "MOB", color: "#9AE6B4" }, { key: "crit", label: "CRIT%", color: "#F687B3" }, { key: "luk", label: "LUK", color: "#FFD700" },
  { key: "hp", label: "HP", color: "#38A169" }, { key: "mana", label: "Mana", color: "#3182CE" }, { key: "stamina_restore", label: "STA", color: "#ECC94B" }, { key: "upgrade_xp_value", label: "XP", color: "#B794F4" },
];


export function itemPrimaryPower(item: Partial<Item>): number {
  return Math.max(0, Number(item.atk || 0), Number(item.int_stat || 0));
}

export function itemDefensePower(item: Partial<Item>): number {
  return Math.max(0, Number(item.def_stat || 0) + Math.floor(Number(item.res || 0) * 0.75));
}

export function itemStatTotal(item: Partial<Item>): number {
  return ["atk", "int_stat", "def_stat", "res", "dex", "mob", "crit", "luk", "hp", "mana", "stamina_restore", "upgrade_xp_value"]
    .reduce((sum, key) => sum + Math.max(0, Number((item as any)[key] || 0)), 0);
}
