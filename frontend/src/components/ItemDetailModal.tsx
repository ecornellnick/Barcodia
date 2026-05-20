import { useState, useEffect } from "react";
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, Alert, ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  api, Item, RARITY_COLORS, RARITY_GLOW, SLOT_ICON, SLOT_LABEL,
  STAT_META, ELEMENT_COLOR, Slot,
} from "@/src/lib/api";
import { COLORS } from "@/src/lib/theme";

type Props = {
  visible: boolean;
  item: Item | null;
  inventory: Item[];
  charLevel: number;
  onClose: () => void;
  onChanged: () => void;
};

export default function ItemDetailModal({
  visible, item, inventory, charLevel, onClose, onChanged,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [showList, setShowList] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [price, setPrice] = useState("");
  const [band, setBand] = useState<{ min: number; max: number } | null>(null);

  useEffect(() => {
    if (!item) return;
    setShowList(false); setShowUpgrade(false); setPrice(""); setBand(null);
  }, [item]);

  if (!item) return null;
  const color = RARITY_COLORS[item.rarity];
  const glow = RARITY_GLOW[item.rarity];

  const wrap = async (fn: () => Promise<any>) => {
    try { setBusy(true); await fn(); onChanged(); onClose(); }
    catch (e: any) { Alert.alert("Error", e.message ?? "Action failed"); }
    finally { setBusy(false); }
  };

  const handleEquip = (slot?: Slot) => wrap(() => api.equip(item.id, slot));
  const handleUnequip = () => wrap(() => api.unequip(item.id));
  const handleUse = () => wrap(() => api.use(item.id));
  const handleDestroy = () =>
    Alert.alert("Destroy item?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Destroy", style: "destructive", onPress: () => wrap(() => api.destroy(item.id)) },
    ]);

  const openList = async () => {
    setShowList(true);
    try {
      const b = await api.priceBand(item.id);
      setBand({ min: b.min_price, max: b.max_price });
      setPrice(String(Math.round((b.min_price + b.max_price) / 2)));
    } catch (e: any) { Alert.alert("Error", e.message); }
  };

  const handleList = async () => {
    const p = parseInt(price, 10);
    if (!band || isNaN(p)) { Alert.alert("Bad price", "Enter a number in range"); return; }
    if (p < band.min || p > band.max) {
      Alert.alert("Out of range", `Must be ${band.min}-${band.max} gold`); return;
    }
    await wrap(() => api.listItem(item.id, p));
  };

  const shards = inventory.filter((i) => i.slot === "upgrade");
  const canUpgrade = item.slot !== "consumable" && item.slot !== "upgrade";
  const atCap = false; // backend enforces soft cap; shard XP can still be banked
  const handleUpgrade = (scrollId: string) => wrap(() => api.upgrade(item.id, scrollId));

  const equipSlotChoices: Slot[] =
    item.slot === "leg_l" || item.slot === "leg_r" ? ["leg_l", "leg_r"]
    : item.slot === "arm_l" || item.slot === "arm_r" ? ["arm_l", "arm_r"]
    : item.slot === "main_hand" || item.slot === "off_hand"
        ? (item.two_handed ? ["main_hand"] : ["main_hand", "off_hand"])
    : [item.slot];

  const renderStats = () => {
    const rows = STAT_META.filter((s) => (item as any)[s.key] > 0);
    if (rows.length === 0) return null;
    return (
      <View style={styles.statsRow}>
        {rows.map((s) => (
          <View key={s.key} style={[styles.stat, { borderColor: s.color }]}>
            <Text style={[styles.statValue, { color: s.color }]}>+{(item as any)[s.key]}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { borderTopColor: color, shadowColor: color }]} testID="item-detail-modal">
          <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
            <TouchableOpacity testID="item-detail-close" onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>

            <View style={[styles.iconBig, { borderColor: color, shadowColor: glow }]}>
              <Text style={{ fontSize: 52 }}>{SLOT_ICON[item.slot]}</Text>
            </View>

            <View style={styles.tagRow}>
              <Text style={[styles.rarityTag, { color, borderColor: color }]}>
                {item.rarity.toUpperCase()} · LVL {item.level}
              </Text>
              {item.element !== "none" && (
                <Text style={[styles.elementTag, { color: ELEMENT_COLOR[item.element], borderColor: ELEMENT_COLOR[item.element] }]}>
                  {item.element.toUpperCase()}
                </Text>
              )}
              {item.two_handed && (
                <Text style={styles.twoHandTag}>2-HANDED</Text>
              )}
            </View>

            <Text style={styles.name} testID="item-detail-name">{item.name}</Text>
            <Text style={styles.subtype}>{SLOT_LABEL[item.slot]} · {item.material} · {item.shape}</Text>
            <Text style={styles.lore}>{item.lore}</Text>

          {item.slot !== "consumable" && item.slot !== "upgrade" && (
            <View style={styles.itemXpBox}>
              <Text style={styles.itemXpText}>Item XP: {item.upgrade_xp ?? 0} / {item.upgrade_xp_to_next ?? 25}</Text>
            </View>
          )}
          {item.slot === "upgrade" && (
            <View style={styles.itemXpBox}>
              <Text style={styles.itemXpText}>Shard XP Value: {item.upgrade_xp_value ?? item.atk ?? 10}</Text>
            </View>
          )}

            {renderStats()}

            <View style={styles.actions}>
              {item.slot === "consumable" ? (
                <ActionBtn label="USE" onPress={handleUse} disabled={busy} testID="action-use" />
              ) : item.slot === "upgrade" ? (
                <Text style={styles.hint}>Open a weapon/armor to infuse shards into it.</Text>
              ) : item.equipped ? (
                <ActionBtn label="UNEQUIP" variant="secondary" onPress={handleUnequip} disabled={busy} testID="action-unequip" />
              ) : equipSlotChoices.length === 1 ? (
                <ActionBtn
                  label={`EQUIP (${SLOT_LABEL[equipSlotChoices[0]]})`}
                  onPress={() => handleEquip(equipSlotChoices[0])}
                  disabled={busy || item.listed}
                  testID="action-equip"
                />
              ) : (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {equipSlotChoices.map((s) => (
                    <ActionBtn
                      key={s}
                      label={`EQUIP ${SLOT_LABEL[s]}`}
                      onPress={() => handleEquip(s)}
                      disabled={busy || item.listed}
                      testID={`action-equip-${s}`}
                    />
                  ))}
                </View>
              )}

              {canUpgrade && (
                <ActionBtn
                  label="INFUSE SHARD"
                  variant="secondary"
                  onPress={() => setShowUpgrade((v) => !v)}
                  disabled={busy}
                  testID="action-upgrade-toggle"
                />
              )}

              {!item.equipped && !item.listed && (
                <ActionBtn
                  label="LIST ON MARKET"
                  variant="secondary"
                  onPress={openList}
                  disabled={busy}
                  testID="action-list"
                />
              )}

              <ActionBtn label="DESTROY" variant="danger" onPress={handleDestroy} disabled={busy} testID="action-destroy" />
            </View>

            {showUpgrade && (
              <View style={styles.subPanel}>
                <Text style={styles.subTitle}>Choose Upgrade Shard</Text>
                {shards.length === 0 ? (
                  <Text style={styles.hint}>No shards in bag. Duplicate scans can create upgrade shards.</Text>
                ) : (
                  shards.map((s) => (
                    <TouchableOpacity
                      key={s.id}
                      testID={`upgrade-with-${s.id}`}
                      style={styles.scrollRow}
                      onPress={() => handleUpgrade(s.id)}
                      disabled={busy}
                    >
                      <Text style={{ fontSize: 24 }}>🔷</Text>
                      <View style={{ flex: 1, marginLeft: 12 }}>
                        <Text style={[styles.scrollName, { color: RARITY_COLORS[s.rarity] }]}>{s.name}</Text>
                        <Text style={styles.scrollMeta}>{s.rarity} · lvl {s.level}</Text>
                      </View>
                      <Ionicons name="chevron-forward" color={COLORS.textMuted} size={20} />
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}

            {showList && (
              <View style={styles.subPanel}>
                <Text style={styles.subTitle}>List on Trading House</Text>
                {!band ? (
                  <ActivityIndicator color={COLORS.primary} />
                ) : (
                  <>
                    <Text style={styles.hint}>Allowed price: {band.min} – {band.max} gold</Text>
                    <TextInput
                      testID="list-price-input"
                      value={price}
                      onChangeText={setPrice}
                      keyboardType="number-pad"
                      style={styles.priceInput}
                      placeholder="Price"
                      placeholderTextColor={COLORS.textMuted}
                    />
                    <ActionBtn label="POST LISTING" onPress={handleList} disabled={busy} testID="confirm-list" />
                  </>
                )}
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function ActionBtn({
  label, onPress, disabled, variant = "primary", testID,
}: {
  label: string; onPress: () => void; disabled?: boolean;
  variant?: "primary" | "secondary" | "danger"; testID?: string;
}) {
  const bg = variant === "primary" ? COLORS.primary : variant === "danger" ? COLORS.danger : "transparent";
  const border = variant === "secondary" ? COLORS.borderStrong : "transparent";
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={[styles.actionBtn, {
        backgroundColor: bg, borderColor: border,
        borderWidth: variant === "secondary" ? 1 : 0,
        opacity: disabled ? 0.5 : 1, flex: 1,
      }]}
    >
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 3,
    paddingHorizontal: 20, paddingTop: 20, maxHeight: "92%",
    shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.7, shadowRadius: 20, elevation: 12,
  },
  closeBtn: { position: "absolute", right: 16, top: 12, zIndex: 1, padding: 8 },
  iconBig: {
    alignSelf: "center", width: 100, height: 100, borderRadius: 24,
    borderWidth: 2, alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)", shadowOpacity: 1, shadowRadius: 30,
    elevation: 10, marginTop: 8,
  },
  tagRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 6, marginTop: 14 },
  rarityTag: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, borderWidth: 1,
    fontSize: 10, fontWeight: "800", letterSpacing: 2,
  },
  elementTag: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, borderWidth: 1,
    fontSize: 10, fontWeight: "800", letterSpacing: 2,
  },
  twoHandTag: {
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, borderWidth: 1,
    fontSize: 10, fontWeight: "800", letterSpacing: 2, color: "#F687B3", borderColor: "#F687B3",
  },
  name: { textAlign: "center", color: COLORS.textPrimary, fontSize: 22, fontWeight: "900", marginTop: 8 },
  subtype: { textAlign: "center", color: COLORS.textSecondary, fontSize: 11, marginTop: 2, letterSpacing: 1, textTransform: "uppercase" },
  lore: { textAlign: "center", color: COLORS.textSecondary, fontStyle: "italic", marginTop: 8, paddingHorizontal: 12, lineHeight: 18 },
  itemXpBox: { alignSelf: "center", marginTop: 10, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: "rgba(183,148,244,0.12)", borderWidth: 1, borderColor: "rgba(183,148,244,0.35)" },
  itemXpText: { color: "#B794F4", fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  statsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginTop: 16, gap: 6 },
  stat: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5, alignItems: "center", minWidth: 56 },
  statValue: { fontSize: 14, fontWeight: "900" },
  statLabel: { color: COLORS.textSecondary, fontSize: 9, letterSpacing: 1, marginTop: 1 },
  actions: { marginTop: 22, gap: 10 },
  actionBtn: { paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  actionText: { color: "#fff", fontWeight: "800", letterSpacing: 2, fontSize: 12 },
  hint: { color: COLORS.textMuted, fontSize: 12, textAlign: "center", paddingVertical: 8 },
  subPanel: {
    marginTop: 14, backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16, padding: 14, borderWidth: 1, borderColor: COLORS.border,
  },
  subTitle: { color: COLORS.textPrimary, fontWeight: "800", letterSpacing: 2, fontSize: 12, marginBottom: 10 },
  scrollRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  scrollName: { fontWeight: "700", fontSize: 14 },
  scrollMeta: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 },
  priceInput: {
    backgroundColor: "rgba(255,255,255,0.05)", borderColor: COLORS.borderStrong,
    borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    color: COLORS.textPrimary, fontSize: 18, fontWeight: "700", marginVertical: 12, textAlign: "center",
  },
});
