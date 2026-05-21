import { useCallback, useMemo, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Modal } from "react-native";
import { useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { api, StoreItem, itemIcon, RARITY_COLORS, ELEMENT_COLOR } from "@/src/lib/api";
import { COLORS } from "@/src/lib/theme";

const BACKEND_BASE = process.env.EXPO_PUBLIC_BACKEND_URL?.replace(/\/api$/, "") || "";

type TabKey = "store" | "trading";
type ToastState = { title: string; body?: string } | null;

function imageUri(item: StoreItem): string | null {
  const u = item.image_url || item.image;
  if (!u) return null;
  if (u.startsWith("http")) return u;
  if (u.startsWith("/")) return `${BACKEND_BASE}${u}`;
  return null;
}

function statLine(item: StoreItem): string {
  const parts: string[] = [];
  if (item.atk) parts.push(`ATK +${item.atk}`);
  if (item.int_stat) parts.push(`INT +${item.int_stat}`);
  if (item.def_stat) parts.push(`DEF +${item.def_stat}`);
  if (item.res) parts.push(`RES +${item.res}`);
  if (item.hp) parts.push(`HP +${item.hp}`);
  if (item.mana) parts.push(`Mana +${item.mana}`);
  if (item.stamina_restore) parts.push(`Stamina +${item.stamina_restore}`);
  return parts.slice(0, 4).join(" · ") || item.description || "Store item";
}

function typeLabel(item: StoreItem): string {
  const t = item.item_type || item.slot || "item";
  return t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function shortName(name: string): string {
  if (!name) return "Unnamed Item";
  const words = name.split(/\s+/).filter(Boolean);
  if (words.length <= 2) return name;
  if (name.length <= 20) return name;
  return words.slice(0, 2).join(" ");
}

export default function StoreScreen() {
  const [tab, setTab] = useState<TabKey>("store");
  const [items, setItems] = useState<StoreItem[]>([]);
  const [gold, setGold] = useState(0);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const [selected, setSelected] = useState<StoreItem | null>(null);
  const [confirming, setConfirming] = useState<StoreItem | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.storeGold();
      setItems(data.items || []);
      setGold(data.gold || 0);
    } catch (e: any) {
      setToast({ title: "Store Error", body: e.message || "Could not load store." });
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const confirmBuy = (item: StoreItem) => {
    if ((item.gold_cost || 0) > gold) {
      setToast({ title: "Not Enough Gold", body: "You do not have enough gold for this item." });
      return;
    }
    setConfirming(item);
  };

  const buy = async () => {
    const item = confirming;
    if (!item) return;
    setBuying(item.id);
    try {
      const res = await api.buyStoreGold(item.id);
      setGold(res.gold);
      setConfirming(null);
      setToast({ title: `${item.name} was purchased`, body: "Added to your bag." });
    } catch (e: any) {
      setToast({ title: "Purchase Failed", body: e.message || "Could not buy item." });
    } finally {
      setBuying(null);
    }
  };

  const selectedImage = useMemo(() => selected ? imageUri(selected) : null, [selected]);
  const confirmImage = useMemo(() => confirming ? imageUri(confirming) : null, [confirming]);

  return (
    <LinearGradient colors={["#070910", "#101019", "#080910"]} style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>STORE</Text>
          <Text style={styles.subtitle}>Gold goods now. Rare wares later.</Text>
        </View>
        <View style={styles.goldPill}>
          <Text style={styles.goldIcon}>🪙</Text>
          <Text style={styles.goldText}>{gold}</Text>
        </View>
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === "store" && styles.tabActive]} onPress={() => setTab("store")}>
          <Ionicons name="storefront-outline" size={18} color={tab === "store" ? "#fff" : "#D9D3E5"} />
          <Text style={[styles.tabText, tab === "store" && styles.tabTextActive]}>Gold Store</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === "trading" && styles.tabActive]} onPress={() => setTab("trading")}>
          <Ionicons name="swap-horizontal-outline" size={18} color={tab === "trading" ? "#fff" : "#D9D3E5"} />
          <Text style={[styles.tabText, tab === "trading" && styles.tabTextActive]}>Trading House</Text>
        </TouchableOpacity>
      </View>

      {tab === "trading" ? (
        <View style={styles.comingSoon}>
          <Ionicons name="construct-outline" size={56} color={COLORS.cyan} />
          <Text style={styles.emptyTitle}>Trading House</Text>
          <Text style={styles.emptyText}>Player listings, selling, and history will live here.</Text>
        </View>
      ) : loading ? (
        <View style={styles.comingSoon}><ActivityIndicator color={COLORS.cyan} /></View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {items.length === 0 ? (
            <View style={styles.comingSoon}>
              <Ionicons name="bag-handle-outline" size={56} color={COLORS.muted} />
              <Text style={styles.emptyTitle}>Store empty</Text>
              <Text style={styles.emptyText}>Use Admin to add gold store items.</Text>
            </View>
          ) : items.map(item => {
            const uri = imageUri(item);
            const rarity = item.rarity || "common";
            const border = RARITY_COLORS[rarity as keyof typeof RARITY_COLORS] || COLORS.border;
            const element = item.element || "none";
            const elementColor = ELEMENT_COLOR[element as keyof typeof ELEMENT_COLOR] || COLORS.muted;
            const disabled = (item.gold_cost || 0) > gold;
            return (
              <View key={item.id} style={[styles.card, { borderColor: border }]}> 
                <TouchableOpacity style={styles.infoTap} onPress={() => setSelected(item)}>
                  <View style={[styles.iconWrap, { shadowColor: elementColor }]}> 
                    {uri ? <Image source={{ uri }} style={styles.itemImage} /> : <Text style={styles.icon}>{itemIcon(item)}</Text>}
                  </View>
                  <Ionicons name="information-circle-outline" size={22} color={COLORS.cyan} style={styles.infoIcon} />
                </TouchableOpacity>
                <View style={styles.cardBody}>
                  <Text style={styles.itemName} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78}>{item.name || "Unnamed Item"}</Text>
                  <Text style={styles.meta}>{String(rarity).toUpperCase()} · {typeLabel(item)}</Text>
                  <Text style={styles.statLine} numberOfLines={2}>{statLine(item)}</Text>
                </View>
                <TouchableOpacity style={[styles.buyBtn, disabled && styles.buyBtnDisabled]} onPress={() => confirmBuy(item)} disabled={buying === item.id}>
                  {buying === item.id ? <ActivityIndicator color="#fff" /> : <>
                    <Text style={styles.buyCoin}>🪙</Text>
                    <Text style={styles.buyText}>{item.gold_cost || 0}</Text>
                  </>}
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <TouchableOpacity style={styles.close} onPress={() => setSelected(null)}><Ionicons name="close" size={26} color={COLORS.muted} /></TouchableOpacity>
            {selected && <>
              <View style={styles.modalIcon}>{selectedImage ? <Image source={{ uri: selectedImage }} style={styles.modalImage} /> : <Text style={styles.modalEmoji}>{itemIcon(selected)}</Text>}</View>
              <Text style={styles.modalTitle}>{selected.name}</Text>
              <Text style={styles.modalMeta}>{String(selected.rarity || "common").toUpperCase()} · {typeLabel(selected)}</Text>
              <Text style={styles.modalDesc}>{selected.description || selected.lore || "A store item prepared by the Barcodia admin."}</Text>
              <Text style={styles.modalStats}>{statLine(selected)}</Text>
              <View style={styles.confirmRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setSelected(null)}><Text style={styles.cancelText}>Close</Text></TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={() => { const item = selected; setSelected(null); confirmBuy(item); }}><Text style={styles.confirmText}>Buy 🪙 {selected.gold_cost || 0}</Text></TouchableOpacity>
              </View>
            </>}
          </View>
        </View>
      </Modal>

      <Modal visible={!!confirming} transparent animationType="fade" onRequestClose={() => setConfirming(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            {confirming && <>
              <View style={styles.modalIcon}>{confirmImage ? <Image source={{ uri: confirmImage }} style={styles.modalImage} /> : <Text style={styles.modalEmoji}>{itemIcon(confirming)}</Text>}</View>
              <Text style={styles.modalTitle}>Buy {confirming.name}?</Text>
              <Text style={styles.modalDesc}>Spend 🪙 {confirming.gold_cost || 0} gold to add this item to your bag.</Text>
              <View style={styles.confirmRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirming(null)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={buy} disabled={buying === confirming.id}>{buying === confirming.id ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmText}>Confirm</Text>}</TouchableOpacity>
              </View>
            </>}
          </View>
        </View>
      </Modal>

      <Modal visible={!!toast} transparent animationType="fade" onRequestClose={() => setToast(null)}>
        <View style={styles.toastBackdrop}>
          <View style={styles.toastCard}>
            <Ionicons name="sparkles-outline" size={34} color={COLORS.cyan} />
            <Text style={styles.toastTitle}>{toast?.title}</Text>
            {!!toast?.body && <Text style={styles.toastBody}>{toast.body}</Text>}
            <TouchableOpacity style={styles.toastBtn} onPress={() => setToast(null)}><Text style={styles.toastBtnText}>OK</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 54, paddingHorizontal: 18 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  title: { color: "#fff", fontSize: 40, letterSpacing: 8, fontWeight: "900" },
  subtitle: { color: COLORS.muted, fontSize: 14, marginTop: 3 },
  goldPill: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "rgba(255,215,0,.45)", backgroundColor: "rgba(255,215,0,.08)", borderRadius: 22, paddingHorizontal: 12, paddingVertical: 9 },
  goldIcon: { fontSize: 17, marginRight: 7 },
  goldText: { color: "#FFD84A", fontSize: 17, fontWeight: "900" },
  tabs: { flexDirection: "row", gap: 10, marginBottom: 14 },
  tab: { flex: 1, borderWidth: 1, borderColor: "rgba(255,255,255,.18)", backgroundColor: "rgba(255,255,255,.09)", borderRadius: 17, paddingVertical: 12, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  tabActive: { backgroundColor: COLORS.purple, borderColor: COLORS.purple },
  tabText: { color: "#D9D3E5", fontSize: 13, fontWeight: "900" },
  tabTextActive: { color: "#fff" },
  grid: { paddingBottom: 120, gap: 12 },
  card: { borderWidth: 2, backgroundColor: "rgba(16,18,28,.92)", borderRadius: 20, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  infoTap: { position: "relative" },
  infoIcon: { position: "absolute", right: -6, top: -8, backgroundColor: "rgba(0,0,0,.6)", borderRadius: 12 },
  iconWrap: { width: 66, height: 66, borderRadius: 16, backgroundColor: "rgba(0,0,0,.28)", alignItems: "center", justifyContent: "center", shadowOpacity: .65, shadowRadius: 9 },
  itemImage: { width: 58, height: 58, borderRadius: 12 },
  icon: { fontSize: 38 },
  cardBody: { flex: 1, minWidth: 0 },
  itemName: { color: "#fff", fontSize: 15, fontWeight: "900", lineHeight: 18, flexWrap: "wrap" },
  meta: { color: COLORS.muted, fontSize: 11, fontWeight: "800", letterSpacing: 1.1, marginTop: 4 },
  statLine: { color: "#BFC7D5", fontSize: 12, marginTop: 6, lineHeight: 17 },
  buyBtn: { width: 72, minHeight: 54, borderRadius: 15, backgroundColor: COLORS.purple, alignItems: "center", justifyContent: "center", paddingHorizontal: 8, paddingVertical: 8 },
  buyBtnDisabled: { opacity: .45 },
  buyCoin: { fontSize: 16 },
  buyText: { color: "#fff", fontSize: 13, fontWeight: "900", marginTop: 2 },
  comingSoon: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  emptyTitle: { color: "#fff", fontSize: 24, fontWeight: "900", marginTop: 14 },
  emptyText: { color: COLORS.muted, fontSize: 16, textAlign: "center", marginTop: 8, lineHeight: 23 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,.72)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { width: "100%", maxWidth: 420, borderRadius: 26, borderWidth: 1, borderColor: COLORS.border, backgroundColor: "#151925", padding: 22, alignItems: "center" },
  close: { position: "absolute", right: 16, top: 16, zIndex: 2 },
  modalIcon: { width: 96, height: 96, borderRadius: 24, backgroundColor: "rgba(255,255,255,.06)", alignItems: "center", justifyContent: "center", marginBottom: 14, overflow: "hidden" },
  modalImage: { width: 96, height: 96, borderRadius: 24 },
  modalEmoji: { fontSize: 52 },
  modalTitle: { color: "#fff", fontSize: 24, fontWeight: "900", textAlign: "center" },
  modalMeta: { color: COLORS.cyan, fontSize: 13, fontWeight: "900", marginTop: 7, letterSpacing: 1.4 },
  modalDesc: { color: "#C8D0DD", fontSize: 15, lineHeight: 21, textAlign: "center", marginTop: 14 },
  modalStats: { color: "#fff", fontSize: 15, fontWeight: "800", textAlign: "center", marginTop: 14 },
  modalBuy: { width: "100%", backgroundColor: COLORS.purple, borderRadius: 18, alignItems: "center", paddingVertical: 15, marginTop: 18 },
  modalBuyText: { color: "#fff", fontSize: 16, fontWeight: "900" },
  confirmRow: { flexDirection: "row", gap: 12, width: "100%", marginTop: 20 },
  cancelBtn: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, alignItems: "center", paddingVertical: 14 },
  confirmBtn: { flex: 1, backgroundColor: COLORS.purple, borderRadius: 18, alignItems: "center", paddingVertical: 14 },
  cancelText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  confirmText: { color: "#fff", fontSize: 15, fontWeight: "900" },
  toastBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,.45)", alignItems: "center", justifyContent: "center", padding: 28 },
  toastCard: { width: "100%", maxWidth: 380, backgroundColor: "#151925", borderWidth: 1, borderColor: COLORS.cyan, borderRadius: 24, padding: 22, alignItems: "center" },
  toastTitle: { color: "#fff", fontSize: 22, fontWeight: "900", textAlign: "center", marginTop: 10 },
  toastBody: { color: COLORS.muted, fontSize: 15, textAlign: "center", marginTop: 8 },
  toastBtn: { backgroundColor: COLORS.purple, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 34, marginTop: 18 },
  toastBtnText: { color: "#fff", fontWeight: "900" },
});
