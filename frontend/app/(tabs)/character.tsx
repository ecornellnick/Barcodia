import { useState, useCallback, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, Image, ImageBackground,
  TouchableOpacity, RefreshControl, ActivityIndicator, Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/lib/auth";
import { api, Item, Totals, RARITY_COLORS, SLOT_ICON, Slot, GEAR_SLOTS, STAT_META, ClassState } from "@/src/lib/api";
import { COLORS, IMAGES, resolveAvatar } from "@/src/lib/theme";
import AvatarPickerModal from "@/src/components/AvatarPickerModal";
import ItemDetailModal from "@/src/components/ItemDetailModal";

const ZERO_TOTALS: Totals = {
  atk: 0, int_stat: 0, def_stat: 0, res: 0, dex: 0, mob: 0,
  crit: 0, luk: 0, hp_bonus: 0, mana_bonus: 0,
};

// Paper-doll positions: 3-col grid
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

export default function Character() {
  const { user, refresh, logout } = useAuth();
  const router = useRouter();
  const [equipped, setEquipped] = useState<Item[]>([]);
  const [inventory, setInventory] = useState<Item[]>([]);
  const [totals, setTotals] = useState<Totals>(ZERO_TOTALS);
  const [classState, setClassState] = useState<ClassState | null>(null);
  const [xpNext, setXpNext] = useState(100);
  const [loading, setLoading] = useState(true);
  const [showAvatar, setShowAvatar] = useState(false);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [staminaNext, setStaminaNext] = useState(user?.stamina_next_seconds ?? 0);
  const [sigilNext, setSigilNext] = useState(user?.sigil_next_seconds ?? 0);

  const load = useCallback(async () => {
    try {
      const [r, inv] = await Promise.all([api.character(), api.inventory()]);
      setEquipped(r.equipped);
      setTotals(r.totals);
      setClassState(r.class_state);
      setXpNext(r.xp_to_next);
      setInventory(inv);
      await refresh();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  }, [refresh]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => { setStaminaNext(user?.stamina_next_seconds ?? 0); setSigilNext(user?.sigil_next_seconds ?? 0); }, [user?.stamina_next_seconds, user?.sigil_next_seconds]);
  useEffect(() => { const t = setInterval(() => { setStaminaNext((v) => Math.max(0, v - 1)); setSigilNext((v) => Math.max(0, v - 1)); }, 1000); return () => clearInterval(t); }, []);
  const fmt = (seconds: number) => { if (seconds <= 0) return "FULL"; const m = Math.floor(seconds / 60); const ss = seconds % 60; return `${m}:${String(ss).padStart(2, "0")}`; };

  if (!user || loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    );
  }

  const xpPct = Math.min(100, (user.xp / xpNext) * 100);
  const hpPct = (user.hp / user.max_hp) * 100;
  const manaPct = (user.mana / user.max_mana) * 100;
  const sigilCharge = user.sigil_charge ?? 100;
  const sigilMax = user.sigil_charge_max ?? 100;
  const sigilPct = Math.max(0, Math.min(100, (sigilCharge / sigilMax) * 100));

  const mainHand = equipped.find((e) => e.equip_slot === "main_hand");
  const isTwoH = !!mainHand?.two_handed;

  const findEquipped = (slot: Slot) =>
    equipped.find((e) => (e.equip_slot ?? e.slot) === slot);

  return (
    <ImageBackground source={{ uri: IMAGES.bgMystical }} style={styles.bg}>
      <LinearGradient colors={["rgba(10,12,16,0.7)", "rgba(10,12,16,0.98)"]} style={StyleSheet.absoluteFill} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor="#fff" />}
        testID="character-screen"
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>HERO</Text>
          <TouchableOpacity testID="logout-btn" onPress={logout} style={styles.iconBtn}>
            <Ionicons name="log-out-outline" color={COLORS.textSecondary} size={22} />
          </TouchableOpacity>
        </View>

        <View style={styles.avatarBlock}>
          <TouchableOpacity testID="avatar-edit-btn" onPress={() => setShowAvatar(true)} activeOpacity={0.85}>
            <View style={styles.avatarRing}>
              <Image source={{ uri: resolveAvatar(user.avatar) }} style={styles.avatar} />
              <View style={styles.levelBadge}><Text style={styles.levelText}>{user.level}</Text></View>
              <View style={styles.editPill}><Ionicons name="pencil" color="#fff" size={12} /></View>
            </View>
          </TouchableOpacity>
          <Text style={styles.username} testID="character-name">{user.username}</Text>
          <Text style={styles.caption}>Level {user.level} · Tier {user.difficulty_tier}</Text>
          <View style={styles.classBand} testID="hero-class-band">
            <Text style={styles.classBandLabel}>CURRENT CLASS</Text>
            <Text style={styles.classBandText}>{classState?.primary?.icon ?? "⚔️"} {classState?.primary?.label ?? "Infantry"}</Text>
            {classState?.secondary && <Text style={styles.classBandSub}>Secondary: {classState.secondary.icon} {classState.secondary.label}</Text>}
            <Text style={styles.classBandHint}>Class changes dynamically from gear and battle behavior.</Text>
          </View>

          <View style={styles.barWrap}>
            <View style={styles.barLabel}>
              <Text style={styles.barLabelText}>XP</Text>
              <Text style={styles.barLabelText}>{user.xp} / {xpNext}</Text>
            </View>
            <View style={styles.barTrack}>
              <LinearGradient colors={[COLORS.primary, COLORS.secondary]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.barFill, { width: `${xpPct}%` }]} />
            </View>
          </View>

          <View style={styles.vitalsRow}>
            <Vital label="HP" value={`${user.hp}/${user.max_hp}`} pct={hpPct} color="#E53E3E" />
            <Vital label="Mana" value={`${user.mana}/${user.max_mana}`} pct={manaPct} color="#3182CE" />
          </View>
          <View style={[styles.vitalsRow, { marginTop: 8 }]}>
            <View style={styles.vital}>
              <View style={styles.barLabel}>
                <Text style={[styles.barLabelText, { color: "#F6E05E" }]}>STAMINA</Text>
                <Text style={styles.barLabelText}>{user.stamina}/{user.stamina_max}</Text>
              </View>
              <View style={styles.staminaRow}>
                {Array.from({ length: user.stamina_max }).map((_, i) => (
                  <View key={i} style={[styles.staminaPip, i < user.stamina && styles.staminaPipFull]} />
                ))}
              </View>
              <Text style={styles.sigilCaption}>{user.stamina >= user.stamina_max ? "FULL" : `+1 in ${fmt(staminaNext)}`}</Text>
            </View>
          </View>

          <View style={[styles.barWrap, { marginTop: 12 }]} testID="hero-sigil-charge">
            <View style={styles.barLabel}>
              <Text style={[styles.barLabelText, { color: COLORS.secondary }]}>SIGIL CHARGE</Text>
              <Text style={styles.barLabelText}>{sigilCharge} / {sigilMax}</Text>
            </View>
            <View style={styles.barTrack}>
              <LinearGradient colors={[COLORS.primary, COLORS.secondary]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.barFill, { width: `${sigilPct}%` }]} />
            </View>
            <Text style={styles.sigilCaption}>Scanner energy for transmuting real-world barcodes. {sigilCharge >= sigilMax ? "FULL" : `+1 in ${fmt(sigilNext)}`}</Text>
          </View>
        </View>

        <View style={styles.goldCard}>
          <Ionicons name="diamond-outline" color={COLORS.accent} size={20} />
          <Text style={styles.goldText} testID="gold-amount">{user.gold} gold</Text>
        </View>

        <Text style={styles.sectionTitle}>EQUIPMENT</Text>
        <View style={styles.doll}>
          {[0, 1, 2, 3].map((row) => (
            <View key={row} style={styles.dollRow}>
              {[0, 1, 2].map((col) => {
                const cell = DOLL_LAYOUT.find((c) => c.row === row && c.col === col);
                if (!cell) return <View key={col} style={styles.dollSlotPlaceholder} />;
                const it = findEquipped(cell.slot);
                const isOffBlocked = cell.slot === "off_hand" && isTwoH;
                const onPress = () => {
                  if (it) setSelectedItem(it);
                };
                return (
                  <TouchableOpacity
                    key={col}
                    style={[
                      styles.dollSlot,
                      it && { borderColor: RARITY_COLORS[it.rarity] },
                      isOffBlocked && { opacity: 0.4, borderStyle: "dashed" },
                    ]}
                    onPress={onPress}
                    activeOpacity={it ? 0.7 : 1}
                    disabled={!it}
                    testID={`slot-${cell.slot}`}
                  >
                    {isOffBlocked ? (
                      <Ionicons name="lock-closed" size={18} color={COLORS.textMuted} />
                    ) : it ? (
                      <Text style={{ fontSize: 26 }}>{SLOT_ICON[cell.slot]}</Text>
                    ) : (
                      <Text style={[styles.dollEmpty, { fontSize: 22 }]}>{SLOT_ICON[cell.slot]}</Text>
                    )}
                    <Text style={styles.dollLabel}>{cell.label}</Text>
                    {it && (
                      <Text style={[styles.dollLvl, { color: RARITY_COLORS[it.rarity] }]}>
                        Lv {it.level}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>STATS</Text>
        <View style={styles.statsGrid}>
          {STAT_META.filter((s) => s.key !== "hp" && s.key !== "mana").map((s) => {
            const val =
              s.key === "atk" ? totals.atk :
              s.key === "int_stat" ? totals.int_stat :
              s.key === "def_stat" ? totals.def_stat :
              s.key === "res" ? totals.res :
              s.key === "dex" ? totals.dex :
              s.key === "mob" ? totals.mob :
              s.key === "crit" ? totals.crit :
              s.key === "luk" ? totals.luk : 0;
            return (
              <View key={s.key} style={[styles.statBlock, { borderColor: s.color }]}>
                <Text style={[styles.statValue, { color: s.color }]}>{val}</Text>
                <Text style={styles.statLabel}>{s.label}</Text>
              </View>
            );
          })}
        </View>

        <View style={styles.tipCard}>
          <Ionicons name="information-circle-outline" color={COLORS.secondary} size={18} />
          <Text style={styles.tipText}>
            Tap an empty slot icon to scan more loot. Tap an equipped item to inspect or unequip.
          </Text>
        </View>
      </ScrollView>

      <AvatarPickerModal
        visible={showAvatar}
        currentAvatar={user.avatar}
        onClose={() => setShowAvatar(false)}
        onSaved={refresh}
      />
      <ItemDetailModal
        visible={!!selectedItem}
        item={selectedItem}
        inventory={inventory}
        charLevel={user.level}
        onClose={() => setSelectedItem(null)}
        onChanged={load}
      />
    </ImageBackground>
  );
}

function Vital({ label, value, pct, color }: { label: string; value: string; pct: number; color: string }) {
  return (
    <View style={styles.vital}>
      <View style={styles.barLabel}>
        <Text style={[styles.barLabelText, { color }]}>{label}</Text>
        <Text style={styles.barLabelText}>{value}</Text>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: COLORS.bg },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.bg },
  content: { padding: 18, paddingTop: 56, paddingBottom: 60 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  headerTitle: { color: COLORS.textPrimary, fontSize: 26, fontWeight: "900", letterSpacing: 4 },
  iconBtn: { padding: 8 },
  avatarBlock: { alignItems: "center", marginBottom: 16 },
  avatarRing: {
    width: 124, height: 124, borderRadius: 999,
    borderWidth: 3, borderColor: COLORS.accent, padding: 4,
    shadowColor: COLORS.accent, shadowOpacity: 0.6, shadowRadius: 20, elevation: 8,
  },
  avatar: { width: "100%", height: "100%", borderRadius: 999 },
  levelBadge: {
    position: "absolute", bottom: -6, right: -6,
    backgroundColor: COLORS.primary, width: 40, height: 40, borderRadius: 999,
    alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: COLORS.bg,
  },
  levelText: { color: "#fff", fontWeight: "900", fontSize: 14 },
  editPill: {
    position: "absolute", top: -2, left: -2, backgroundColor: COLORS.secondary,
    width: 26, height: 26, borderRadius: 999, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: COLORS.bg,
  },
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
  staminaPip: {
    flex: 1, height: 10, borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1, borderColor: "rgba(246,224,94,0.3)",
  },
  staminaPipFull: { backgroundColor: "#F6E05E", borderColor: "#F6E05E" },
  sigilCaption: { color: COLORS.textMuted, fontSize: 10, textAlign: "center", marginTop: 5 },
  classBand: { marginTop: 10, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: COLORS.borderStrong, borderRadius: 14, padding: 12, alignItems: "center" },
  classBandLabel: { color: COLORS.textMuted, fontSize: 9, fontWeight: "900", letterSpacing: 2 },
  classBandText: { color: COLORS.textPrimary, fontSize: 18, fontWeight: "900", marginTop: 4 },
  classBandSub: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2 },
  classBandHint: { color: COLORS.textMuted, fontSize: 10, marginTop: 5, textAlign: "center" },
  goldCard: {
    flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "center",
    backgroundColor: "rgba(255,215,0,0.08)", borderColor: "rgba(255,215,0,0.4)",
    borderWidth: 1, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 999,
    marginTop: 18, marginBottom: 20,
  },
  goldText: { color: COLORS.accent, fontWeight: "800", letterSpacing: 1 },
  sectionTitle: {
    color: COLORS.textSecondary, fontSize: 11, fontWeight: "800",
    letterSpacing: 3, marginBottom: 10, marginTop: 4,
  },
  doll: { gap: 8, marginBottom: 22 },
  dollRow: { flexDirection: "row", gap: 8, justifyContent: "center" },
  dollSlot: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 100,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
  },
  dollSlotPlaceholder: { flex: 1, maxWidth: 100 },
  dollEmpty: { opacity: 0.25 },
  dollLabel: { color: COLORS.textMuted, fontSize: 8, letterSpacing: 1, marginTop: 2 },
  dollLvl: { fontSize: 9, fontWeight: "900", marginTop: 1 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  statBlock: {
    width: "23%",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  statValue: { fontSize: 18, fontWeight: "900" },
  statLabel: { color: COLORS.textSecondary, fontSize: 9, letterSpacing: 1, marginTop: 1 },
  tipCard: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(0,229,255,0.06)", borderColor: "rgba(0,229,255,0.25)",
    borderWidth: 1, padding: 12, borderRadius: 12,
  },
  tipText: { color: COLORS.textSecondary, fontSize: 11, flex: 1 },
});
