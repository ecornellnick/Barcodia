import { useState, useCallback, useEffect, useMemo } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, ImageBackground,
  TouchableOpacity, RefreshControl, ActivityIndicator, Alert, Modal,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/lib/auth";
import {
  api, Item, Totals, RARITY_COLORS, SLOT_ICON, Slot, STAT_META,
  ClassState, CLASS_META, TalentState, TalentNode, itemIcon, GOLD_ICON, DailyGoalsPayload,
} from "@/src/lib/api";
import { COLORS, IMAGES, resolveAvatar } from "@/src/lib/theme";
import AvatarPickerModal from "@/src/components/AvatarPickerModal";
import ItemDetailModal from "@/src/components/ItemDetailModal";

const ZERO_TOTALS: Totals = {
  atk: 0, int_stat: 0, def_stat: 0, res: 0, dex: 0, mob: 0,
  crit: 0, luk: 0, hp_bonus: 0, mana_bonus: 0,
};

type SlotCell = { slot: Slot; col: 0 | 1 | 2; row: number; label: string };
const DOLL_LAYOUT: SlotCell[] = [
  { slot: "trinket",   col: 0, row: 0, label: "Trinket" },
  { slot: "head",      col: 1, row: 0, label: "Head" },
  { slot: "necklace",  col: 2, row: 0, label: "Neck" },
  { slot: "arm_l",     col: 0, row: 1, label: "L Arm" },
  { slot: "chest",     col: 1, row: 1, label: "Chest" },
  { slot: "arm_r",     col: 2, row: 1, label: "R Arm" },
  { slot: "main_hand", col: 0, row: 2, label: "Main" },
  { slot: "ring",      col: 1, row: 2, label: "Ring" },
  { slot: "off_hand",  col: 2, row: 2, label: "Off" },
  { slot: "leg_l",     col: 0, row: 3, label: "L Leg" },
  { slot: "leg_r",     col: 2, row: 3, label: "R Leg" },
];

const CLASS_ORDER = ["infantry", "lancer", "cavalry", "archer", "assassin", "flier", "aquatic", "mage", "healer", "holy", "demon"];

const fmt = (seconds: number) => {
  if (seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const ss = seconds % 60;
  return `${m}:${String(ss).padStart(2, "0")}`;
};

export default function Character() {
  const { user, refresh, logout } = useAuth();
  const [activeUser, setActiveUser] = useState(user);
  const [equipped, setEquipped] = useState<Item[]>([]);
  const [inventory, setInventory] = useState<Item[]>([]);
  const [totals, setTotals] = useState<Totals>(ZERO_TOTALS);
  const [classState, setClassState] = useState<ClassState | null>(null);
  const [talentState, setTalentState] = useState<TalentState | null>(null);
  const [xpNext, setXpNext] = useState(100);
  const [loading, setLoading] = useState(true);
  const [showAvatar, setShowAvatar] = useState(false);
  const [showProficiency, setShowProficiency] = useState(false);
  const [showTalents, setShowTalents] = useState(false);
  const [showHeroMenu, setShowHeroMenu] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showEquipment, setShowEquipment] = useState(false);
  const [showDaily, setShowDaily] = useState(false);
  const [dailyGoals, setDailyGoals] = useState<DailyGoalsPayload | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [staminaNext, setStaminaNext] = useState(user?.stamina_next_seconds ?? 0);
  const [sigilNext, setSigilNext] = useState(user?.sigil_next_seconds ?? 0);

  const load = useCallback(async () => {
    try {
      const [r, inv, goals] = await Promise.all([api.character(), api.inventory(), api.dailyGoals().catch(() => null)]);
      setActiveUser(r.user);
      setEquipped(r.equipped);
      setTotals(r.totals);
      setClassState(r.class_state);
      setTalentState(r.talent_state ?? null);
      setXpNext(r.xp_to_next);
      setInventory(inv);
      setDailyGoals(goals);
      setStaminaNext(r.user.stamina_next_seconds ?? 0);
      setSigilNext(r.user.sigil_next_seconds ?? 0);
      await refresh();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { setActiveUser(user); }, [user?.id]);

  useEffect(() => {
    const t = setInterval(() => {
      setStaminaNext((v) => {
        if (v <= 1 && activeUser && activeUser.stamina < activeUser.stamina_max) {
          load();
          return 0;
        }
        return Math.max(0, v - 1);
      });
      setSigilNext((v) => {
        if (v <= 1 && activeUser && (activeUser.sigil_charge ?? 100) < (activeUser.sigil_charge_max ?? 100)) {
          load();
          return 0;
        }
        return Math.max(0, v - 1);
      });
    }, 1000);
    return () => clearInterval(t);
  }, [activeUser?.stamina, activeUser?.stamina_max, activeUser?.sigil_charge, activeUser?.sigil_charge_max, load]);

  // Hooks must always run in the same order, even while the screen is loading.
  // Keep this before any early return to avoid React's "rendered more hooks" crash.
  const proficiencyRows = useMemo(() => {
    const scores = classState?.scores ?? {};
    const max = Math.max(1, ...CLASS_ORDER.map((k) => Number(scores[k] ?? 0)));
    return CLASS_ORDER.map((key) => {
      const chip = CLASS_META[key] ?? { key, label: key, icon: "◇" };
      const raw = Number(scores[key] ?? 0);
      const pct = Math.min(100, Math.round((raw / Math.max(100, max)) * 100));
      return { key, chip, raw, pct };
    });
  }, [classState]);

  const u = activeUser;
  if (!u || loading) {
    return <View style={styles.loading}><ActivityIndicator color={COLORS.primary} size="large" /></View>;
  }

  const xpPct = Math.min(100, (u.xp / xpNext) * 100);
  const hpPct = (u.hp / u.max_hp) * 100;
  const manaPct = (u.mana / u.max_mana) * 100;
  const sigilCharge = u.sigil_charge ?? 100;
  const sigilMax = u.sigil_charge_max ?? 100;
  const sigilPct = Math.max(0, Math.min(100, (sigilCharge / sigilMax) * 100));
  const safeStaminaNext = Math.max(1, staminaNext > 0 ? staminaNext : (u.stamina_regen_seconds && u.stamina_regen_seconds > 0 ? u.stamina_regen_seconds : 180));
  const safeSigilNext = Math.max(1, sigilNext > 0 ? sigilNext : (u.sigil_regen_seconds && u.sigil_regen_seconds > 0 ? u.sigil_regen_seconds : 90));
  const staminaCountdown = u.stamina >= u.stamina_max ? "FULL" : `+1 in ${fmt(safeStaminaNext)}`;
  const sigilCountdown = sigilCharge >= sigilMax ? "FULL" : `+1 in ${fmt(safeSigilNext)}`;

  const mainHand = equipped.find((e) => e.equip_slot === "main_hand");
  const isTwoH = !!mainHand?.two_handed;
  const findEquipped = (slot: Slot) => equipped.find((e) => (e.equip_slot ?? e.slot) === slot);

  const spendTalent = async (node: TalentNode) => {
    try {
      const next = await api.spendTalent(node.id);
      setTalentState(next);
      await load();
    } catch (e: any) {
      Alert.alert("Talent", e.message);
    }
  };

  const resetTalents = async () => {
    try {
      const next = await api.resetTalents();
      setTalentState(next);
      await load();
    } catch (e: any) {
      Alert.alert("Talent", e.message);
    }
  };

  return (
    <ImageBackground source={{ uri: IMAGES.bgMystical }} style={styles.bg}>
      <LinearGradient colors={["rgba(10,12,16,0.7)", "rgba(10,12,16,0.98)"]} style={StyleSheet.absoluteFill} />
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor="#fff" />} testID="character-screen">
        <View style={styles.header}>
          <Text style={styles.headerTitle}>HERO</Text>
          <TouchableOpacity testID="logout-btn" onPress={logout} style={styles.iconBtn}><Ionicons name="log-out-outline" color={COLORS.textSecondary} size={22} /></TouchableOpacity>
        </View>

        <View style={styles.avatarBlock}>
          <TouchableOpacity testID="avatar-edit-btn" onPress={() => setShowAvatar(true)} activeOpacity={0.85}>
            <View style={styles.avatarRing}>
              <Image source={{ uri: resolveAvatar(u.avatar) }} style={styles.avatar} />
              <View style={styles.levelBadge}><Text style={styles.levelText}>{u.level}</Text></View>
              <View style={styles.editPill}><Ionicons name="pencil" color="#fff" size={12} /></View>
            </View>
          </TouchableOpacity>
          <Text style={styles.username} testID="character-name">{u.username}</Text>
          <Text style={styles.caption}>Level {u.level} · Tier {u.difficulty_tier}</Text>

          <View style={styles.classBand} testID="hero-class-band">
            <Text style={styles.classBandLabel}>CURRENT CLASS</Text>
            <Text style={styles.classBandText}>{classState?.primary?.icon ?? "⚔️"} {classState?.primary?.label ?? "Infantry"}</Text>
            {classState?.secondary && <Text style={styles.classBandSub}>Secondary affinity: {classState.secondary.icon} {classState.secondary.label}</Text>}
            <Text style={styles.classBandHint}>Your class changes from gear, weapons, skills, and battle behavior.</Text>
            <View style={styles.classActions}>
              <TouchableOpacity style={styles.smallPill} onPress={() => setShowHeroMenu(true)} testID="hero-menu-btn"><Text style={styles.smallPillText}>Hero Menu</Text></TouchableOpacity>
            </View>
          </View>

          <View style={styles.barWrap}>
            <View style={styles.barLabel}><Text style={styles.barLabelText}>XP</Text><Text style={styles.barLabelText}>{u.xp} / {xpNext}</Text></View>
            <View style={styles.barTrack}><LinearGradient colors={[COLORS.primary, COLORS.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.barFill, { width: `${xpPct}%` }]} /></View>
          </View>

          <View style={styles.vitalsRow}>
            <Vital label="HP" value={`${u.hp}/${u.max_hp}`} pct={hpPct} color="#E53E3E" />
            <Vital label="Mana" value={`${u.mana}/${u.max_mana}`} pct={manaPct} color="#3182CE" />
          </View>
          <View style={[styles.vitalsRow, { marginTop: 8 }]}> 
            <View style={styles.vital}>
              <View style={styles.barLabel}><Text style={[styles.barLabelText, { color: "#F6E05E" }]}>BATTLE STAMINA</Text><Text style={styles.barLabelText}>{u.stamina}/{u.stamina_max}</Text></View>
              <View style={styles.staminaRow}>{Array.from({ length: u.stamina_max }).map((_, i) => <View key={i} style={[styles.staminaPip, i < u.stamina && styles.staminaPipFull]} />)}</View>
              <Text style={styles.sigilCaption}>{staminaCountdown}</Text>
            </View>
          </View>

          <View style={[styles.barWrap, { marginTop: 12 }]} testID="hero-sigil-charge">
            <View style={styles.barLabel}><Text style={[styles.barLabelText, { color: COLORS.secondary }]}>SIGIL CHARGE</Text><Text style={styles.barLabelText}>{sigilCharge} / {sigilMax}</Text></View>
            <View style={styles.barTrack}><LinearGradient colors={[COLORS.primary, COLORS.secondary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.barFill, { width: `${sigilPct}%` }]} /></View>
            <Text style={styles.sigilCaption}>Scanner energy for transmuting real-world barcodes. {sigilCountdown}</Text>
          </View>
        </View>

        <View style={styles.goldCard}><Text style={styles.goldCoin}>{GOLD_ICON}</Text><Text style={styles.goldText} testID="gold-amount">{u.gold} gold</Text></View>

        <TouchableOpacity style={styles.heroMenuCard} onPress={() => setShowHeroMenu(true)} activeOpacity={0.85}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroMenuTitle}>HERO MENU</Text>
            <Text style={styles.heroMenuSub}>Stats · Equipment · Class Proficiency · Talent Tree</Text>
          </View>
          <Ionicons name="chevron-forward" color={COLORS.secondary} size={22} />
        </TouchableOpacity>

        <View style={styles.tipCard}><Ionicons name="information-circle-outline" color={COLORS.secondary} size={18} /><Text style={styles.tipText}>Class proficiency rises slowly as you use weapons and skills. Talent Tree is in test mode with extra points so we can tune it fast.</Text></View>
      </ScrollView>

      <HeroMenuModal visible={showHeroMenu} onClose={() => setShowHeroMenu(false)} onDaily={() => { setShowHeroMenu(false); setShowDaily(true); }} onStatus={() => { setShowHeroMenu(false); setShowStatus(true); }} onEquipment={() => { setShowHeroMenu(false); setShowEquipment(true); }} onProficiency={() => { setShowHeroMenu(false); setShowProficiency(true); }} onTalents={() => { setShowHeroMenu(false); setShowTalents(true); }} />
      <DailyGoalsModal visible={showDaily} onClose={() => setShowDaily(false)} daily={dailyGoals} />
      <StatusModal visible={showStatus} onClose={() => setShowStatus(false)} totals={totals} />
      <EquipmentModal visible={showEquipment} onClose={() => setShowEquipment(false)} equipped={equipped} isTwoH={isTwoH} onPick={setSelectedItem} />
      <ProficiencyModal visible={showProficiency} onClose={() => setShowProficiency(false)} rows={proficiencyRows} />
      <TalentModal visible={showTalents} onClose={() => setShowTalents(false)} talentState={talentState} onSpend={spendTalent} onReset={resetTalents} />
      <AvatarPickerModal visible={showAvatar} currentAvatar={u.avatar} onClose={() => setShowAvatar(false)} onSaved={() => { setShowAvatar(false); load(); }} />
      <ItemDetailModal visible={!!selectedItem} item={selectedItem} inventory={inventory} charLevel={u.level} onClose={() => setSelectedItem(null)} onChanged={load} />
    </ImageBackground>
  );
}

function Vital({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return <View style={styles.vital}><View style={styles.barLabel}><Text style={[styles.barLabelText, { color }]}>{label}</Text><Text style={styles.barLabelText}>{value}</Text></View><View style={styles.barTrack}><View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} /></View></View>;
}

function StatRow({ label, short, value, color, desc }: { label: string; short: string; value: number; color: string; desc: string }) {
  return <View style={styles.statRow}><View style={styles.statBadge}><Text style={[styles.statValue, { color }]}>{value}</Text><Text style={styles.statLabel}>{short}</Text></View><View style={{ flex: 1 }}><Text style={styles.statName}>{label}</Text><Text style={styles.statDesc}>{desc}</Text></View></View>;
}

function ProficiencyModal({ visible, onClose, rows }: { visible: boolean; onClose: () => void; rows: any[] }) {
  const guide = [
    ["⚔️", "Infantry", "Strong vs Lancer"],
    ["🔱", "Lancer", "Strong vs Cavalry"],
    ["🐎", "Cavalry", "Strong vs Infantry"],
    ["🏹", "Archer", "Strong vs Flier"],
    ["☀️", "Holy", "Strong vs Demon"],
    ["☠️", "Demon", "Strong vs Holy"],
  ];
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>CLASS PROFICIENCY</Text><Text style={styles.modalSub}>Icons shown here also explain enemy class icons in battle. Proficiency rises slowly from weapons, gear, and skills you actually use.</Text><ScrollView style={{ maxHeight: 540 }}><View style={styles.classGuide}>{guide.map((g) => <View key={g[1]} style={styles.classGuideRow}><Text style={styles.classGuideIcon}>{g[0]}</Text><View style={{ flex: 1 }}><Text style={styles.classGuideName}>{g[1]}</Text><Text style={styles.classGuideSub}>{g[2]}</Text></View></View>)}</View>{rows.map((r) => <View key={r.key} style={styles.profRow}><View style={styles.profHead}><Text style={styles.profName}>{r.chip.icon} {r.chip.label}</Text><Text style={styles.profScore}>{r.raw}</Text></View><View style={styles.profTrack}><View style={[styles.profFill, { width: `${Math.max(4, r.pct)}%` }]} /></View></View>)}</ScrollView><TouchableOpacity style={styles.modalButton} onPress={onClose}><Text style={styles.modalButtonText}>CLOSE</Text></TouchableOpacity></View></View></Modal>;
}


function HeroMenuModal({ visible, onClose, onDaily, onStatus, onEquipment, onProficiency, onTalents }: { visible: boolean; onClose: () => void; onDaily: () => void; onStatus: () => void; onEquipment: () => void; onProficiency: () => void; onTalents: () => void }) {
  const row = (icon: string, label: string, sub: string, fn: () => void) => (
    <TouchableOpacity style={styles.menuRow} onPress={fn} activeOpacity={0.85}>
      <Text style={styles.menuIcon}>{icon}</Text><View style={{ flex: 1 }}><Text style={styles.menuLabel}>{label}</Text><Text style={styles.menuSub}>{sub}</Text></View><Ionicons name="chevron-forward" color={COLORS.textMuted} size={18} />
    </TouchableOpacity>
  );
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.sideBackdrop}><View style={styles.sidePanel}><Text style={styles.modalTitle}>HERO MENU</Text><Text style={styles.modalSub}>Open detailed character systems without crowding the main screen.</Text>{row("🎯", "Daily Goals", "Progress, rewards, and Aether Gems.", onDaily)}{row("📊", "Status", "Combat stats and what they do.", onStatus)}{row("🎒", "Equipment", "Equipped gear and slots.", onEquipment)}{row("📈", "Class Proficiency", "Training progress by class style.", onProficiency)}{row("🌳", "Talent Tree", "Spend points, unlock branches, respec.", onTalents)}<TouchableOpacity style={styles.modalButton} onPress={onClose}><Text style={styles.modalButtonText}>CLOSE</Text></TouchableOpacity></View><TouchableOpacity style={{ flex: 1 }} onPress={onClose} /></View></Modal>;
}


function DailyGoalsModal({ visible, onClose, daily }: { visible: boolean; onClose: () => void; daily: DailyGoalsPayload | null }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>DAILY GOALS</Text><Text style={styles.modalSub}>Complete every goal to earn rare premium gems.</Text><View style={styles.dailyGemBox}><Text style={styles.dailyGemText}>💎 {daily?.currency_balance ?? 0} {daily?.premium_currency_name ?? "Aether Gems"}</Text></View><ScrollView style={{ maxHeight: 480 }}>{daily?.goals?.map((g) => <View key={g.key} style={styles.dailyGoalRow}><Text style={[styles.dailyGoalLabel, g.done && styles.dailyGoalDone]}>{g.done ? "✓" : "•"} {g.label}</Text><Text style={styles.dailyGoalCount}>{g.progress}/{g.target}</Text></View>) ?? <Text style={styles.modalSub}>Daily goals are loading.</Text>}</ScrollView><Text style={styles.dailyRewardText}>All goals reward: {daily?.complete_reward ?? 5} {daily?.premium_currency_name ?? "Aether Gems"}</Text><TouchableOpacity style={styles.modalButton} onPress={onClose}><Text style={styles.modalButtonText}>CLOSE</Text></TouchableOpacity></View></View></Modal>;
}

function StatusModal({ visible, onClose, totals }: { visible: boolean; onClose: () => void; totals: Totals }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>STATUS</Text><Text style={styles.modalSub}>Your current stats after equipment and talent bonuses.</Text><ScrollView style={{ maxHeight: 520 }}><View style={styles.statusPanel}><StatRow label="Attack" short="ATK" value={totals.atk} color="#FF6B6B" desc="Physical damage with weapons." /><StatRow label="Intelligence" short="INT" value={totals.int_stat} color="#A78BFA" desc="Skill power. Targets RES." /><StatRow label="Defense" short="DEF" value={totals.def_stat} color="#4ECDC4" desc="Reduces physical damage." /><StatRow label="Resistance" short="RES" value={totals.res} color="#63B3ED" desc="Reduces skill damage." /><StatRow label="Dexterity" short="DEX" value={totals.dex} color="#F6AD55" desc="Accuracy and some skill reliability." /><StatRow label="Mobility" short="MOB" value={totals.mob} color="#9AE6B4" desc="Initiative, flee chance, and small dodge factor." /><StatRow label="Critical" short="CRIT" value={totals.crit} color="#F687B3" desc="Critical hit chance." /><StatRow label="Luck" short="LUK" value={totals.luk} color="#FFD700" desc="Minor rare/edge-case influence." /></View></ScrollView><TouchableOpacity style={styles.modalButton} onPress={onClose}><Text style={styles.modalButtonText}>CLOSE</Text></TouchableOpacity></View></View></Modal>;
}

function EquipmentModal({ visible, onClose, equipped, isTwoH, onPick }: { visible: boolean; onClose: () => void; equipped: Item[]; isTwoH: boolean; onPick: (item: Item) => void }) {
  const findEquippedLocal = (slot: Slot) => equipped.find((e) => (e.equip_slot ?? e.slot) === slot);
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>EQUIPMENT</Text><Text style={styles.modalSub}>Tap equipped gear to inspect it.</Text><ScrollView style={{ maxHeight: 520 }}><View style={styles.doll}>{[0, 1, 2, 3].map((row) => (<View key={row} style={styles.dollRow}>{[0, 1, 2].map((col) => { const cell = DOLL_LAYOUT.find((c) => c.row === row && c.col === col); if (!cell) return <View key={col} style={styles.dollSlotPlaceholder} />; const it = findEquippedLocal(cell.slot); const isOffBlocked = cell.slot === "off_hand" && isTwoH; return (<TouchableOpacity key={col} style={[styles.dollSlot, it && { borderColor: RARITY_COLORS[it.rarity] }, isOffBlocked && { opacity: 0.4, borderStyle: "dashed" }]} onPress={() => it && onPick(it)} activeOpacity={it ? 0.7 : 1} disabled={!it}>{isOffBlocked ? <Ionicons name="lock-closed" size={18} color={COLORS.textMuted} /> : it ? <><Text style={{ fontSize: 24 }}>{itemIcon(it)}</Text><Text style={[styles.dollLvl, { color: RARITY_COLORS[it.rarity] }]}>Lv {it.level}</Text></> : <><Text style={styles.dollEmpty}>{SLOT_ICON[cell.slot]}</Text><Text style={styles.dollLabel}>{cell.label}</Text></>}</TouchableOpacity>); })}</View>))}</View></ScrollView><TouchableOpacity style={styles.modalButton} onPress={onClose}><Text style={styles.modalButtonText}>CLOSE</Text></TouchableOpacity></View></View></Modal>;
}

function TalentModal({ visible, onClose, talentState, onSpend, onReset }: { visible: boolean; onClose: () => void; talentState: TalentState | null; onSpend: (node: TalentNode) => void; onReset: () => void }) {
  const groups = useMemo(() => {
    const out: Record<string, TalentNode[]> = {};
    (talentState?.nodes ?? []).forEach((n) => { out[n.tree] = out[n.tree] || []; out[n.tree].push(n); });
    Object.keys(out).forEach((k) => out[k].sort((a,b)=>(a.position ?? 0)-(b.position ?? 0)));
    return out;
  }, [talentState]);
  const effectSummary = useMemo(() => {
    const e = talentState?.effects ?? {};
    const labels: Record<string,string> = { hp_bonus: "HP", mana_bonus: "Mana", atk: "ATK", int_stat: "INT", def_stat: "DEF", res: "RES", dex: "DEX", mob: "MOB", crit: "CRIT", luk: "LUK" };
    return Object.entries(e).filter(([,v]) => Number(v) !== 0).map(([k,v]) => `+${v} ${labels[k] ?? k}`).join(" · ") || "No bonuses yet";
  }, [talentState]);
  const treeNames = Object.keys(groups).sort((a,b)=>a==="generic"?-1:b==="generic"?1:a.localeCompare(b));
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>TALENT TREE</Text>{talentState ? <><Text style={styles.modalSub}>{talentState.test_mode ? "TEST MODE: " : ""}{talentState.points_available}/{talentState.points_total} points available · Reset {talentState.reset_free ? "FREE" : `${talentState.reset_cost} gold`}</Text><View style={styles.effectSummary}><Text style={styles.effectSummaryText}>Current talent bonuses: {effectSummary}</Text></View><ScrollView style={{ maxHeight: 520 }}>{treeNames.map((tree) => { const meta = CLASS_META[tree] ?? { label: tree === "generic" ? "Core" : tree, icon: tree === "generic" ? "🌳" : "◇" }; return <View key={tree} style={[styles.talentBranch, tree !== "generic" && { borderColor: "rgba(0,229,255,0.28)" }]}><Text style={styles.talentGroupTitle}>{meta.icon} {meta.label.toUpperCase()} BRANCH</Text>{groups[tree].map((n, idx) => <View key={n.id} style={styles.talentNodeWrap}>{idx > 0 && <View style={styles.branchLine} />}<View style={[styles.talentNode, n.locked && styles.talentNodeLocked]}><View style={{ flex: 1 }}><Text style={styles.talentName}>{n.icon} {n.name} <Text style={styles.talentRank}>{n.rank}/{n.max_rank}</Text></Text><Text style={styles.talentDesc}>{n.description}</Text>{n.total_added && Object.values(n.total_added).some(Boolean) && <Text style={styles.talentTotal}>Current from this node: {Object.entries(n.total_added).filter(([,v])=>Number(v)!==0).map(([k,v])=>`+${v} ${k.replace("_bonus", "").replace("int_stat", "INT").replace("def_stat", "DEF")}`).join(" · ")}</Text>}{n.locked && <Text style={styles.talentWarn}>🔒 {n.locked_text}</Text>}{n.warning && !n.locked && <Text style={styles.talentWarn}>⚠ {n.warning_text}</Text>}</View><TouchableOpacity disabled={!n.can_rank} onPress={() => onSpend(n)} style={[styles.rankBtn, !n.can_rank && styles.rankBtnDisabled]}><Text style={styles.rankBtnText}>{n.locked ? "LOCKED" : "+Rank"}</Text></TouchableOpacity></View></View>)}</View>})}</ScrollView><View style={styles.modalActions}><TouchableOpacity style={styles.resetButton} onPress={onReset}><Text style={styles.resetButtonText}>RESET</Text></TouchableOpacity><TouchableOpacity style={styles.modalButtonFlex} onPress={onClose}><Text style={styles.modalButtonText}>CLOSE</Text></TouchableOpacity></View></> : <ActivityIndicator color={COLORS.primary} />}</View></View></Modal>;
}

const styles = StyleSheet.create({

  heroMenuCard: { width: "100%", flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,229,255,0.07)", borderWidth: 1, borderColor: "rgba(0,229,255,0.28)", borderRadius: 16, padding: 14, marginBottom: 16 },
  heroMenuTitle: { color: COLORS.textPrimary, fontSize: 14, fontWeight: "900", letterSpacing: 2 },
  heroMenuSub: { color: COLORS.textSecondary, fontSize: 11, marginTop: 3 },
  sideBackdrop: { flex: 1, flexDirection: "row", backgroundColor: "rgba(0,0,0,0.65)" },
  sidePanel: { width: "82%", maxWidth: 360, backgroundColor: "#171B24", borderRightWidth: 1, borderColor: COLORS.borderStrong, padding: 16, paddingTop: 52 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 13, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: COLORS.border, marginBottom: 10 },
  menuIcon: { fontSize: 22, width: 28, textAlign: "center" },
  menuLabel: { color: COLORS.textPrimary, fontSize: 14, fontWeight: "900" },
  menuSub: { color: COLORS.textMuted, fontSize: 10, marginTop: 2 },
  dailyGemBox: { alignItems: "center", borderWidth: 1, borderColor: "rgba(255,215,0,0.35)", backgroundColor: "rgba(255,215,0,0.07)", borderRadius: 14, padding: 12, marginBottom: 12 },
  dailyGemText: { color: COLORS.accent, fontWeight: "900", letterSpacing: 1 },
  dailyGoalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 10 },
  dailyGoalLabel: { color: COLORS.textSecondary, fontWeight: "800", flex: 1, paddingRight: 10 },
  dailyGoalDone: { color: COLORS.secondary },
  dailyGoalCount: { color: COLORS.textMuted, fontWeight: "900" },
  dailyRewardText: { color: COLORS.textSecondary, textAlign: "center", marginTop: 12, fontWeight: "800" },
  effectSummary: { backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 10, marginBottom: 10 },
  effectSummaryText: { color: COLORS.textSecondary, fontSize: 11, lineHeight: 16 },
  talentBranch: { marginBottom: 14, borderWidth: 1, borderColor: "rgba(255,215,0,0.25)", borderRadius: 16, padding: 10, backgroundColor: "rgba(255,255,255,0.035)" },
  talentNodeWrap: { position: "relative" },
  branchLine: { width: 2, height: 14, backgroundColor: "rgba(255,255,255,0.18)", marginLeft: 18, marginBottom: -2 },
  talentNodeLocked: { opacity: 0.48, borderStyle: "dashed" },
  bg: { flex: 1, backgroundColor: COLORS.bg },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.bg },
  content: { padding: 18, paddingTop: 56, paddingBottom: 60 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 26, fontWeight: "900", letterSpacing: 4 },
  iconBtn: { padding: 8 },
  avatarBlock: { alignItems: "center", marginBottom: 16 },
  avatarRing: { width: 124, height: 124, borderRadius: 999, borderWidth: 3, borderColor: COLORS.accent, padding: 4, shadowColor: COLORS.accent, shadowOpacity: 0.6, shadowRadius: 20, elevation: 8 },
  avatar: { width: "100%", height: "100%", borderRadius: 999 },
  levelBadge: { position: "absolute", bottom: -6, right: -6, backgroundColor: COLORS.primary, width: 40, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: COLORS.bg },
  levelText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  editPill: { position: "absolute", top: -2, left: -2, backgroundColor: COLORS.secondary, width: 26, height: 26, borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: COLORS.bg },
  username: { color: COLORS.textPrimary, fontSize: 22, fontWeight: "900", marginTop: 14 },
  caption: { color: COLORS.textSecondary, fontSize: 11, letterSpacing: 2, marginTop: 4, textTransform: "uppercase" },
  barWrap: { width: "100%", marginTop: 14 },
  barLabel: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  barLabelText: { color: COLORS.textSecondary, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  barTrack: { height: 10, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 999 },
  vitalsRow: { flexDirection: "row", gap: 12, width: "100%", marginTop: 12 },
  vital: { flex: 1 },
  staminaRow: { flexDirection: "row", gap: 4 },
  staminaPip: { flex: 1, height: 10, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: "rgba(246,224,94,0.3)" },
  staminaPipFull: { backgroundColor: "#F6E05E", borderColor: "#F6E05E" },
  sigilCaption: { color: COLORS.textMuted, fontSize: 10, textAlign: "center", marginTop: 5 },
  classBand: { marginTop: 10, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: COLORS.borderStrong, borderRadius: 14, padding: 12, alignItems: "center", width: "100%" },
  classBandLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: "900", letterSpacing: 2 },
  classBandText: { color: COLORS.textPrimary, fontSize: 18, fontWeight: "900", marginTop: 4 },
  classBandSub: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  classBandHint: { color: COLORS.textMuted, fontSize: 10, marginTop: 5, textAlign: "center" },
  classActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  smallPill: { borderWidth: 1, borderColor: COLORS.borderStrong, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "rgba(0,229,255,0.06)" },
  smallPillText: { color: COLORS.secondary, fontSize: 10, fontWeight: "900", letterSpacing: 1 },
  goldCard: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "center", backgroundColor: "rgba(255,215,0,0.08)", borderColor: "rgba(255,215,0,0.4)", borderWidth: 1, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999, marginTop: 18, marginBottom: 20 },
  goldCoin: { fontSize: 18 },
  goldText: { color: COLORS.accent, fontWeight: "800", letterSpacing: 1 },
  sectionTitle: { color: COLORS.textSecondary, fontSize: 11, fontWeight: "800", letterSpacing: 3, marginBottom: 10, marginTop: 4 },
  statusPanel: { backgroundColor: "rgba(255,255,255,0.04)", borderColor: COLORS.border, borderWidth: 1, borderRadius: 14, padding: 10, marginBottom: 20, gap: 8 },
  statRow: { flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)", paddingBottom: 7 },
  statBadge: { width: 58, alignItems: "center", borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", paddingVertical: 6, backgroundColor: "rgba(0,0,0,0.2)" },
  statValue: { fontSize: 18, fontWeight: "900" },
  statLabel: { color: COLORS.textSecondary, fontSize: 9, letterSpacing: 1, marginTop: 1 },
  statName: { color: COLORS.textPrimary, fontSize: 13, fontWeight: "900" },
  statDesc: { color: COLORS.textMuted, fontSize: 10, marginTop: 2 },
  doll: { gap: 8, marginBottom: 22 },
  dollRow: { flexDirection: "row", gap: 8, justifyContent: "center" },
  dollSlot: { flex: 1, aspectRatio: 1, maxWidth: 100, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.04)", alignItems: "center", justifyContent: "center", padding: 4 },
  dollSlotPlaceholder: { flex: 1, maxWidth: 100 },
  dollEmpty: { opacity: 0.25 },
  dollLabel: { color: COLORS.textMuted, fontSize: 8, letterSpacing: 1, marginTop: 2 },
  dollLvl: { fontSize: 9, fontWeight: "900", marginTop: 1 },
  tipCard: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(0,229,255,0.06)", borderColor: "rgba(0,229,255,0.25)", borderWidth: 1, padding: 12, borderRadius: 12 },
  tipText: { color: COLORS.textSecondary, fontSize: 11, flex: 1 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", padding: 18 },
  modalCard: { width: "100%", maxHeight: "88%", backgroundColor: "#171B24", borderRadius: 18, borderWidth: 1, borderColor: COLORS.borderStrong, padding: 16 },
  modalTitle: { color: COLORS.textPrimary, fontSize: 18, fontWeight: "900", letterSpacing: 2, textAlign: "center" },
  modalSub: { color: COLORS.textSecondary, fontSize: 11, textAlign: "center", marginTop: 6, marginBottom: 12 },
  modalButton: { marginTop: 14, backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, alignItems: "center" },
  modalButtonFlex: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, alignItems: "center" },
  modalButtonText: { color: "#fff", fontWeight: "900", letterSpacing: 2 },
  classGuide: { backgroundColor: "rgba(255,255,255,0.045)", borderColor: COLORS.border, borderWidth: 1, borderRadius: 14, padding: 10, marginBottom: 14, gap: 8 },
  classGuideRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  classGuideIcon: { fontSize: 20, width: 28, textAlign: "center" },
  classGuideName: { color: COLORS.textPrimary, fontSize: 12, fontWeight: "900" },
  classGuideSub: { color: COLORS.textMuted, fontSize: 10, marginTop: 1 },
  profRow: { marginBottom: 12 },
  profHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  profName: { color: COLORS.textPrimary, fontWeight: "800" },
  profScore: { color: COLORS.secondary, fontWeight: "900" },
  profTrack: { height: 8, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" },
  profFill: { height: "100%", backgroundColor: COLORS.secondary },
  talentGroup: { marginBottom: 14 },
  talentGroupTitle: { color: COLORS.accent, fontSize: 11, fontWeight: "900", letterSpacing: 2, marginBottom: 8 },
  talentNode: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, padding: 10, marginBottom: 8 },
  talentName: { color: COLORS.textPrimary, fontWeight: "900" },
  talentRank: { color: COLORS.secondary },
  talentDesc: { color: COLORS.textSecondary, fontSize: 10, marginTop: 3 },
  talentWarn: { color: COLORS.accent, fontSize: 10, marginTop: 4 },
  rankBtn: { backgroundColor: COLORS.secondary, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  rankBtnDisabled: { opacity: 0.35 },
  rankBtnText: { color: COLORS.bg, fontWeight: "900", fontSize: 10 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 10 },
  resetButton: { flex: 1, backgroundColor: "rgba(229,62,62,0.22)", borderColor: "rgba(229,62,62,0.55)", borderWidth: 1, borderRadius: 12, padding: 14, alignItems: "center" },
  resetButtonText: { color: "#FC8181", fontWeight: "900", letterSpacing: 2 },
});
