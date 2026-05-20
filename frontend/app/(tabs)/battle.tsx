import { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Image, ImageBackground,
  ScrollView, ActivityIndicator, Alert, Modal,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { api, Enemy, BattleLog, Item, RARITY_COLORS, ClassState, Totals, ClassChip, Skill, itemIcon } from "@/src/lib/api";
import { COLORS, IMAGES } from "@/src/lib/theme";
import { useAuth } from "@/src/lib/auth";

type Action = "weapon" | "skill" | "item" | "flee";

function fmt(seconds: number) {
  if (seconds <= 0) return "FULL";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function Battle() {
  const { user, refresh } = useAuth();
  const [loading, setLoading] = useState(true);
  const [enemy, setEnemy] = useState<Enemy | null>(null);
  const [stamina, setStamina] = useState(0);
  const [stamMax, setStamMax] = useState(5);
  const [tier, setTier] = useState(1);
  const [busy, setBusy] = useState(false);
  const [visibleLog, setVisibleLog] = useState<BattleLog[]>([]);
  const [outcome, setOutcome] = useState<{ win: boolean; escaped?: boolean; rewards: { xp: number; gold: number; item: Item | null } } | null>(null);
  const [classState, setClassState] = useState<ClassState | null>(null);
  const [mainWeapon, setMainWeapon] = useState<Item | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [legendOpen, setLegendOpen] = useState(false);
  const [skillMenuOpen, setSkillMenuOpen] = useState(false);
  const [skillInfo, setSkillInfo] = useState<Skill | null>(null);
  const [itemMenuOpen, setItemMenuOpen] = useState(false);
  const [consumables, setConsumables] = useState<Item[]>([]);
  const [staminaNext, setStaminaNext] = useState(0);
  const [sigilCharge, setSigilCharge] = useState(0);
  const [sigilMax, setSigilMax] = useState(100);
  const [sigilNext, setSigilNext] = useState(0);
  const [changeEnemySeconds, setChangeEnemySeconds] = useState(0);

  const loadPreview = useCallback(async () => {
    try {
      const r = await api.battlePreview();
      setEnemy(r.enemy);
      setStamina(r.stamina);
      setStamMax(r.stamina_max);
      setTier(r.difficulty_tier);
      setClassState(r.class_state);
      setMainWeapon(r.main_weapon);
      setTotals(r.totals);
      setSkills(r.skills ?? []);
      setStaminaNext(r.stamina_next_seconds ?? 0);
      setSigilCharge(r.sigil_charge ?? 0);
      setSigilMax(r.sigil_charge_max ?? 100);
      setSigilNext(r.sigil_next_seconds ?? 0);
      setChangeEnemySeconds(r.change_enemy_seconds ?? 0);
      setOutcome(null);
    } catch (e: any) {
      Alert.alert("Battle unavailable", e.message ?? "Try again after stamina recovers.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadPreview(); }, [loadPreview]));

  useEffect(() => {
    const t = setInterval(() => {
      setStaminaNext((v) => Math.max(0, v - 1));
      setSigilNext((v) => Math.max(0, v - 1));
      setChangeEnemySeconds((v) => Math.max(0, v - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const syncFromResponse = async (r: any) => {
    const nextLines = r.log ?? [];
    setVisibleLog((cur) => [...nextLines, ...cur].slice(0, 8));
    setEnemy(r.next_enemy ?? r.enemy);
    if (r.class_state) setClassState(r.class_state);
    if (r.main_weapon !== undefined) setMainWeapon(r.main_weapon ?? null);
    if (r.skills) setSkills(r.skills);
    if (r.user) {
      setStamina(r.user.stamina);
      setStamMax(r.user.stamina_max);
      setTier(r.user.difficulty_tier);
    }
    if (r.resolved) {
      setOutcome({ win: r.win, escaped: r.escaped, rewards: r.rewards });
      setVisibleLog(nextLines);
    }
    await refresh();
  };

  const runAction = async (action: Action, skill?: Skill, item?: Item) => {
    if (busy || outcome) return;
    setBusy(true);
    setSkillMenuOpen(false);
    setItemMenuOpen(false);
    try {
      const r = await api.battleFight(action, item?.id, skill?.id);
      await syncFromResponse(r);
    } catch (e: any) {
      Alert.alert("Battle failed", e.message ?? "Try again");
    } finally {
      setBusy(false);
    }
  };

  const openItemMenu = async () => {
    if (busy || outcome) return;
    try {
      const inv = await api.inventory();
      const usable = inv.filter((it) => it.slot === "consumable" && !it.listed);
      setConsumables(usable);
      if (usable.length === 0) {
        Alert.alert("No items", "You do not have a usable consumable. This does not cost a turn.");
        return;
      }
      setItemMenuOpen(true);
    } catch (e: any) {
      Alert.alert("Item menu failed", e.message ?? "Could not load items.");
    }
  };

  const changeEnemy = async () => {
    if (busy) return;
    if (outcome) { await loadPreview(); setVisibleLog([]); return; }
    try {
      const r = await api.battleSkip();
      setEnemy(r.enemy); setVisibleLog([]); setOutcome(null); setChangeEnemySeconds(r.change_enemy_seconds ?? 300);
    } catch (e: any) { Alert.alert("Failed", e.message); }
  };

  if (!user || loading) return <View style={styles.loading}><ActivityIndicator color={COLORS.primary} size="large" /></View>;

  const enemyHpPct = enemy ? Math.max(0, (enemy.hp / enemy.max_hp) * 100) : 0;
  const heroChip = classState?.primary;
  const secondaryChip = classState?.secondary;
  const weaponLabel = mainWeapon?.name ?? "Bare Hands";
  const maxHp = user.max_hp + (totals?.hp_bonus ?? 0);
  const maxMana = user.max_mana + (totals?.mana_bonus ?? 0);
  const canAct = !busy && !outcome;

  return (
    <ImageBackground source={{ uri: IMAGES.bgMystical }} style={styles.bg}>
      <LinearGradient colors={["rgba(10,12,16,0.82)", "rgba(10,12,16,0.98)"]} style={StyleSheet.absoluteFill} />
      <View style={styles.screen} testID="battle-screen">
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.title}>ARENA</Text>
            <Text style={styles.subtitle}>Tier {tier} · turn-based JRPG combat</Text>
          </View>
          <TouchableOpacity style={styles.legendMini} onPress={() => setLegendOpen(true)}><Ionicons name="information-circle-outline" color={COLORS.accent} size={18} /><Text style={styles.legendMiniText}>Rules</Text></TouchableOpacity>
        </View>

        <View style={styles.resourceRow}>
          <ResourceCard label="Battle Stamina" value={`${stamina}/${stamMax}`} timer={stamina >= stamMax ? "FULL" : `+1 in ${fmt(staminaNext)}`} color="#F6E05E" />
          <ResourceCard label="Sigil Charge" value={`${sigilCharge}/${sigilMax}`} timer={sigilCharge >= sigilMax ? "FULL" : `+1 in ${fmt(sigilNext)}`} color={COLORS.secondary} />
        </View>

        {enemy && <View style={styles.enemyCard} testID="enemy-card">
          <Image source={{ uri: enemy.portrait }} style={styles.enemyPortrait} />
          <View style={{ flex: 1 }}>
            <View style={styles.cardTopLine}><Text style={styles.enemyName} numberOfLines={1}>{enemy.elite ? "★ " : ""}{enemy.name}</Text><View style={styles.chipRow}>{(enemy.class_chips ?? []).map((c) => <ClassPill key={c.key} chip={c} />)}</View></View>
            <View style={styles.hpLine}><Text style={styles.hpLabel}>HP {enemy.hp}/{enemy.max_hp}</Text><Text style={styles.miniEnemyStats}>ATK {enemy.atk} · INT {enemy.int_stat} · DEF {enemy.def_stat} · MOB {enemy.mob}</Text></View>
            <View style={styles.barTrack}><View style={[styles.hpFill, { width: `${enemyHpPct}%` }]} /></View>
          </View>
        </View>}

        <View style={styles.heroCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroName}>{user.username}</Text>
            <View style={styles.classLine}><Text style={styles.primaryClass}>Primary: {heroChip?.icon ?? "⚔️"} {heroChip?.label ?? "Infantry"}</Text>{secondaryChip && <Text style={styles.secondaryClass}>Sub: {secondaryChip.icon} {secondaryChip.label}</Text>}</View>
          </View>
          <View style={{ alignItems: "flex-end" }}><Text style={styles.heroStat}>HP {user.hp}/{maxHp}</Text><Text style={styles.heroStat}>Mana {user.mana}/{maxMana}</Text></View>
        </View>

        {totals && <View style={styles.statStrip}><Text style={styles.statStripText}>ATK {totals.atk}</Text><Text style={styles.statStripText}>INT {totals.int_stat}</Text><Text style={styles.statStripText}>DEF {totals.def_stat}</Text><Text style={styles.statStripText}>RES {totals.res}</Text><Text style={styles.statStripText}>DEX {totals.dex}</Text><Text style={styles.statStripText}>MOB {totals.mob}</Text></View>}

        <View style={styles.feedBox} testID="battle-log">
          <Text style={styles.feedTitle}>{busy ? "RESOLVING TURN..." : outcome ? "BATTLE RESOLVED" : "YOUR TURN"}</Text>
          <ScrollView style={styles.feedScroll} contentContainerStyle={{ paddingBottom: 4 }}>
            {visibleLog.length === 0 ? <Text style={styles.emptyFeed}>Choose an action. One choice = one turn.</Text> : visibleLog.map((line, i) => <View key={i} style={styles.feedLine}><Text style={styles.feedIcon}>{line.side === "player" ? "▶" : "◆"}</Text><Text style={[styles.feedText, line.crit && styles.critText, line.effective && styles.effectiveText]}>{line.msg}</Text></View>)}
          </ScrollView>
        </View>

        <View style={styles.actionGrid}>
          <ActionButton icon={itemIcon(mainWeapon) || "⚔️"} label={weaponLabel} sub="ATK vs DEF" onPress={() => runAction("weapon")} disabled={!canAct} />
          <ActionButton icon="✨" label="Skill" sub="Choose skill" onPress={() => setSkillMenuOpen(true)} disabled={!canAct} />
          <ActionButton icon="🧪" label="Item" sub="Use consumable" onPress={openItemMenu} disabled={!canAct} />
          <ActionButton icon="🏃" label="Flee" sub="Mobility check" onPress={() => runAction("flee")} disabled={!canAct} />
        </View>

        <View style={styles.utilityRow}>
          <TouchableOpacity testID="battle-skip" style={[styles.utilityBtn, (busy || (!outcome && changeEnemySeconds > 0)) && { opacity: 0.45 }]} onPress={changeEnemy} disabled={busy || (!outcome && changeEnemySeconds > 0)}>
            <Ionicons name="refresh" color={COLORS.textPrimary} size={15} />
            <Text style={styles.utilityText}>{outcome ? "START NEXT BATTLE" : changeEnemySeconds > 0 ? `CHANGE ENEMY ${fmt(changeEnemySeconds)}` : "CHANGE ENEMY"}</Text>
          </TouchableOpacity>
        </View>

        {outcome && <View style={[styles.outcomeCard, outcome.win ? { borderColor: COLORS.success } : { borderColor: outcome.escaped ? COLORS.accent : COLORS.danger }]} testID="battle-outcome"><Text style={[styles.outcomeText, { color: outcome.win ? COLORS.success : outcome.escaped ? COLORS.accent : COLORS.danger }]}>{outcome.escaped ? "ESCAPED" : outcome.win ? "VICTORY" : "DEFEAT"}</Text>{outcome.win && <Text style={styles.rewardText}>+{outcome.rewards.xp} XP · +{outcome.rewards.gold} gold</Text>}{outcome.rewards.item && <Text style={styles.rewardText}>{itemIcon(outcome.rewards.item)} {outcome.rewards.item.name}</Text>}</View>}
      </View>

      <Modal visible={skillMenuOpen} transparent animationType="slide" onRequestClose={() => setSkillMenuOpen(false)}><View style={styles.modalBackdrop}><View style={styles.sheet}><View style={styles.sheetHeader}><Text style={styles.sheetTitle}>SKILLS</Text><TouchableOpacity onPress={() => setSkillMenuOpen(false)}><Ionicons name="close" color={COLORS.textSecondary} size={24} /></TouchableOpacity></View><Text style={styles.sheetHint}>Skills are learned and can become rusty when your current class drifts away.</Text>{skills.map((s) => <SkillRow key={s.id} skill={s} onUse={() => runAction("skill", s)} onInfo={() => setSkillInfo(s)} />)}</View></View></Modal>

      <Modal visible={itemMenuOpen} transparent animationType="slide" onRequestClose={() => setItemMenuOpen(false)}><View style={styles.modalBackdrop}><View style={styles.sheet}><View style={styles.sheetHeader}><Text style={styles.sheetTitle}>ITEMS</Text><TouchableOpacity onPress={() => setItemMenuOpen(false)}><Ionicons name="close" color={COLORS.textSecondary} size={24} /></TouchableOpacity></View><Text style={styles.sheetHint}>Opening this menu does not cost a turn. Using an item does.</Text>{consumables.map((it) => <TouchableOpacity key={it.id} style={styles.itemRow} onPress={() => runAction("item", undefined, it)}><Text style={styles.itemIcon}>{itemIcon(it)}</Text><View style={{ flex: 1 }}><Text style={styles.skillName}>{it.name}</Text><Text style={styles.skillMeta}>{it.hp ? `+${it.hp} HP ` : ""}{it.mana ? `+${it.mana} Mana ` : ""}{it.stamina_restore ? `+${it.stamina_restore} Stamina` : ""}</Text></View></TouchableOpacity>)}</View></View></Modal>

      <Modal visible={!!skillInfo} transparent animationType="fade" onRequestClose={() => setSkillInfo(null)}><View style={styles.modalBackdrop}><View style={styles.infoCard}>{skillInfo && <><Text style={styles.infoTitle}>{skillInfo.icon} {skillInfo.name}</Text><Text style={styles.infoSub}>{skillInfo.class_chip?.icon ?? "◇"} {skillInfo.class_chip?.label ?? "Neutral"} Skill · {skillInfo.mp_cost} Mana</Text><Text style={styles.infoBody}>{skillInfo.description}</Text><InfoRule label="Status" value={`${skillInfo.warning ? "⚠ " : ""}${skillInfo.status_text ?? (skillInfo.warning ? "Rusty" : "Trained")}`} warn={!!skillInfo.warning} /><InfoRule label="Affinity" value={`${skillInfo.affinity_percent ?? 100}%`} /><InfoRule label="Penalty" value={skillInfo.penalty_text ?? "Full power"} />{skillInfo.warning && <Text style={styles.infoTip}>Tip: Equip related gear or use this skill to retrain that class affinity.</Text>}</>}<TouchableOpacity style={styles.closeInfo} onPress={() => setSkillInfo(null)}><Text style={styles.closeInfoText}>CLOSE</Text></TouchableOpacity></View></View></Modal>

      <Modal visible={legendOpen} transparent animationType="fade" onRequestClose={() => setLegendOpen(false)}><View style={styles.modalBackdrop}><View style={styles.infoCard}><Text style={styles.infoTitle}>Affinity Rules</Text>{(classState?.legend ?? []).map((r, i) => <Text key={i} style={styles.legendText}>{r.from.icon} {r.from.label}  ›  {r.to.icon} {r.to.label}</Text>)}<Text style={styles.infoTip}>Classes are dynamic. Your equipment and battle behavior shape your primary and secondary affinities over time.</Text><TouchableOpacity style={styles.closeInfo} onPress={() => setLegendOpen(false)}><Text style={styles.closeInfoText}>CLOSE</Text></TouchableOpacity></View></View></Modal>
    </ImageBackground>
  );
}

function ResourceCard({ label, value, timer, color }: { label: string; value: string; timer: string; color: string }) { return <View style={styles.resourceCard}><Text style={styles.resourceLabel}>{label}</Text><Text style={[styles.resourceValue, { color }]}>{value}</Text><Text style={styles.timerText}>{timer}</Text></View>; }
function ClassPill({ chip }: { chip: ClassChip }) { return <View style={styles.classPill}><Text style={styles.classPillText}>{chip.icon}</Text></View>; }
function ActionButton({ icon, label, sub, onPress, disabled }: { icon: string; label: string; sub: string; onPress: () => void; disabled?: boolean }) { return <TouchableOpacity style={[styles.commandBtn, disabled && { opacity: 0.42 }]} onPress={onPress} disabled={disabled}><Text style={styles.commandIcon}>{icon}</Text><Text style={styles.commandLabel} numberOfLines={1}>{label}</Text><Text style={styles.commandSub}>{sub}</Text></TouchableOpacity>; }
function SkillRow({ skill, onUse, onInfo }: { skill: Skill; onUse: () => void; onInfo: () => void }) { return <View style={[styles.skillRow, skill.warning && styles.skillRowWarn]}><TouchableOpacity style={{ flex: 1 }} onPress={onUse}><Text style={styles.skillName}>{skill.warning ? "⚠ " : ""}{skill.icon} {skill.name}</Text><Text style={styles.skillMeta}>{skill.class_chip?.icon ?? "◇"} {skill.class_chip?.label ?? "Neutral"} · {skill.mp_cost} Mana · {skill.warning ? skill.penalty_text : "Full power"}</Text></TouchableOpacity><TouchableOpacity style={styles.infoBtn} onPress={onInfo}><Text style={styles.infoBtnText}>ⓘ</Text></TouchableOpacity></View>; }
function InfoRule({ label, value, warn }: { label: string; value: string; warn?: boolean }) { return <View style={styles.infoRule}><Text style={styles.infoRuleLabel}>{label}</Text><Text style={[styles.infoRuleValue, warn && { color: COLORS.accent }]}>{value}</Text></View>; }

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center" },
  bg: { flex: 1 }, screen: { flex: 1, paddingTop: 48, paddingHorizontal: 12, paddingBottom: 8 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  title: { color: COLORS.textPrimary, fontSize: 25, fontWeight: "900", letterSpacing: 3 }, subtitle: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  legendMini: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: COLORS.borderStrong, backgroundColor: "rgba(0,0,0,0.25)" }, legendMiniText: { color: COLORS.accent, fontSize: 11, fontWeight: "900" },
  resourceRow: { flexDirection: "row", gap: 8, marginBottom: 8 }, resourceCard: { flex: 1, backgroundColor: "rgba(26,29,36,0.86)", borderRadius: 12, padding: 9, borderWidth: 1, borderColor: COLORS.border }, resourceLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 }, resourceValue: { fontSize: 14, fontWeight: "900", marginTop: 3 }, timerText: { color: COLORS.textSecondary, fontSize: 10, fontWeight: "800", marginTop: 2 },
  enemyCard: { flexDirection: "row", backgroundColor: "rgba(26,29,36,0.95)", borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 16, padding: 10, minHeight: 94 }, enemyPortrait: { width: 58, height: 74, borderRadius: 12, backgroundColor: COLORS.surfaceLight, marginRight: 10 }, cardTopLine: { flexDirection: "row", justifyContent: "space-between", gap: 8, alignItems: "center" }, enemyName: { flex: 1, color: COLORS.textPrimary, fontSize: 16, fontWeight: "900" }, chipRow: { flexDirection: "row", gap: 4 }, classPill: { width: 26, height: 24, alignItems: "center", justifyContent: "center", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", borderWidth: 1, borderColor: COLORS.borderStrong }, classPillText: { fontSize: 13 }, hpLine: { marginTop: 7 }, hpLabel: { color: "#FF6B6B", fontSize: 11, fontWeight: "900" }, miniEnemyStats: { color: COLORS.textMuted, fontSize: 10, marginTop: 2 }, barTrack: { height: 8, backgroundColor: "rgba(255,255,255,0.09)", borderRadius: 999, overflow: "hidden", marginTop: 5 }, hpFill: { height: "100%", backgroundColor: "#E53E3E" },
  heroCard: { flexDirection: "row", alignItems: "center", backgroundColor: "rgba(0,229,255,0.07)", borderWidth: 1, borderColor: "rgba(0,229,255,0.22)", borderRadius: 14, padding: 10, marginTop: 8 }, heroName: { color: COLORS.textPrimary, fontSize: 15, fontWeight: "900" }, classLine: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 4 }, primaryClass: { color: COLORS.textPrimary, fontSize: 10, fontWeight: "900" }, secondaryClass: { color: COLORS.textMuted, fontSize: 10, fontWeight: "800" }, heroStat: { color: COLORS.textSecondary, fontWeight: "800", fontSize: 11 },
  statStrip: { flexDirection: "row", flexWrap: "wrap", gap: 5, justifyContent: "center", marginTop: 7, backgroundColor: "rgba(0,0,0,0.22)", borderRadius: 10, paddingVertical: 6, paddingHorizontal: 4, borderWidth: 1, borderColor: COLORS.border }, statStripText: { color: COLORS.textSecondary, fontSize: 10, fontWeight: "900" },
  feedBox: { flex: 1, minHeight: 112, marginTop: 8, backgroundColor: "rgba(0,0,0,0.30)", borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 9 }, feedTitle: { color: COLORS.accent, fontSize: 11, fontWeight: "900", letterSpacing: 1.5, marginBottom: 4 }, feedScroll: { flex: 1 }, emptyFeed: { color: COLORS.textMuted, fontSize: 12, lineHeight: 18 }, feedLine: { flexDirection: "row", gap: 6, marginVertical: 2 }, feedIcon: { color: COLORS.secondary, fontWeight: "900", width: 14 }, feedText: { color: COLORS.textSecondary, fontSize: 12, flex: 1, lineHeight: 16 }, critText: { color: "#F687B3", fontWeight: "900" }, effectiveText: { color: COLORS.accent, fontWeight: "900" },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }, commandBtn: { width: "48.8%", backgroundColor: "rgba(138,43,226,0.22)", borderWidth: 1, borderColor: COLORS.borderStrong, borderRadius: 14, padding: 9, minHeight: 66 }, commandIcon: { fontSize: 20 }, commandLabel: { color: COLORS.textPrimary, fontWeight: "900", marginTop: 3, fontSize: 12 }, commandSub: { color: COLORS.textMuted, fontSize: 9, marginTop: 1 }, utilityRow: { alignItems: "center", marginTop: 7 }, utilityBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: COLORS.borderStrong, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 13, backgroundColor: "rgba(255,255,255,0.04)" }, utilityText: { color: COLORS.textPrimary, fontWeight: "900", fontSize: 10, letterSpacing: 1 },
  outcomeCard: { position: "absolute", left: 14, right: 14, bottom: 12, borderWidth: 2, borderRadius: 16, backgroundColor: "rgba(10,12,16,0.96)", padding: 12, alignItems: "center" }, outcomeText: { fontSize: 18, fontWeight: "900", letterSpacing: 2 }, rewardText: { color: COLORS.textSecondary, marginTop: 4, fontWeight: "800" },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.62)", justifyContent: "flex-end" }, sheet: { backgroundColor: COLORS.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, maxHeight: "78%", borderWidth: 1, borderColor: COLORS.borderStrong }, sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, sheetTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: "900", letterSpacing: 2 }, sheetHint: { color: COLORS.textMuted, fontSize: 12, marginTop: 8, marginBottom: 10, lineHeight: 17 }, skillRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 }, skillRowWarn: { borderColor: "rgba(255,215,0,0.45)", backgroundColor: "rgba(255,215,0,0.07)" }, skillName: { color: COLORS.textPrimary, fontWeight: "900" }, skillMeta: { color: COLORS.textMuted, fontSize: 11, marginTop: 3 }, infoBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,229,255,0.12)", borderWidth: 1, borderColor: COLORS.borderStrong }, infoBtnText: { color: COLORS.secondary, fontWeight: "900", fontSize: 16 }, itemRow: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.04)", marginBottom: 8 }, itemIcon: { fontSize: 24, marginRight: 10 },
  infoCard: { margin: 22, backgroundColor: COLORS.surface, borderRadius: 20, padding: 18, borderWidth: 1, borderColor: COLORS.borderStrong }, infoTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: "900" }, infoSub: { color: COLORS.textSecondary, fontWeight: "800", marginTop: 4 }, infoBody: { color: COLORS.textSecondary, lineHeight: 20, marginTop: 12 }, infoRule: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 10, marginTop: 10 }, infoRuleLabel: { color: COLORS.textMuted, fontWeight: "800" }, infoRuleValue: { color: COLORS.textPrimary, fontWeight: "900" }, infoTip: { color: COLORS.accent, fontSize: 12, lineHeight: 18, marginTop: 12 }, closeInfo: { marginTop: 16, backgroundColor: COLORS.primary, borderRadius: 14, padding: 12, alignItems: "center" }, closeInfoText: { color: "white", fontWeight: "900" }, legendText: { color: COLORS.textSecondary, fontSize: 14, marginVertical: 4, fontWeight: "800" },
});
