import { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  api, Item, RARITY_COLORS, RARITY_GLOW, itemIcon, itemPrimaryPower,
  itemDefensePower, itemStatTotal,
} from "@/src/lib/api";
import { COLORS } from "@/src/lib/theme";
import { useAuth } from "@/src/lib/auth";
import ItemDetailModal from "@/src/components/ItemDetailModal";

const INVENTORY_MAX = 50;

type FilterKey = "all" | "weapon" | "off" | "armor" | "trinket" | "consumable" | "upgrade";
type SortKey =
  | "newest" | "name" | "rarity" | "level" | "weapon_power"
  | "armor_defense" | "stat_total" | "slot";

const FILTERS: { label: string; key: FilterKey }[] = [
  { label: "ALL", key: "all" },
  { label: "WEAPON", key: "weapon" },
  { label: "OFF", key: "off" },
  { label: "ARMOR", key: "armor" },
  { label: "TRINKET", key: "trinket" },
  { label: "CONSUM", key: "consumable" },
  { label: "SHARD", key: "upgrade" },
];

const SORTS: { label: string; key: SortKey; defaultDesc: boolean }[] = [
  { label: "Newest", key: "newest", defaultDesc: true },
  { label: "Name", key: "name", defaultDesc: false },
  { label: "Rarity", key: "rarity", defaultDesc: true },
  { label: "Level", key: "level", defaultDesc: true },
  { label: "Weapon Power", key: "weapon_power", defaultDesc: true },
  { label: "Armor DEF", key: "armor_defense", defaultDesc: true },
  { label: "Stat Total", key: "stat_total", defaultDesc: true },
  { label: "Type", key: "slot", defaultDesc: false },
];

const RARITY_RANK: Record<string, number> = {
  common: 1,
  uncommon: 2,
  rare: 3,
  epic: 4,
  legendary: 5,
};

const ARMOR_SLOTS = new Set(["head", "chest", "leg_l", "leg_r", "arm_l", "arm_r"]);
const TRINKET_SLOTS = new Set(["trinket", "ring", "necklace"]);

function matchesFilter(item: Item, filter: FilterKey) {
  if (filter === "all") return true;
  if (filter === "weapon") return item.slot === "main_hand";
  if (filter === "off") return item.slot === "off_hand";
  if (filter === "armor") return ARMOR_SLOTS.has(item.slot);
  if (filter === "trinket") return TRINKET_SLOTS.has(item.slot);
  if (filter === "consumable") return item.slot === "consumable";
  if (filter === "upgrade") return item.slot === "upgrade";
  return true;
}

function sortValue(item: Item, sort: SortKey) {
  switch (sort) {
    case "name": return item.name.toLowerCase();
    case "rarity": return RARITY_RANK[item.rarity] ?? 0;
    case "level": return item.level ?? 0;
    case "weapon_power": return item.slot === "main_hand" ? itemPrimaryPower(item) : -1;
    case "armor_defense": return ARMOR_SLOTS.has(item.slot) || item.slot === "off_hand" ? itemDefensePower(item) : -1;
    case "stat_total": return itemStatTotal(item);
    case "slot": return item.slot;
    case "newest":
    default:
      return item.id;
  }
}

function compareItems(a: Item, b: Item, sort: SortKey, desc: boolean) {
  const av = sortValue(a, sort);
  const bv = sortValue(b, sort);
  let out = 0;
  if (typeof av === "string" || typeof bv === "string") out = String(av).localeCompare(String(bv));
  else out = Number(av) - Number(bv);

  if (out === 0) {
    out = (RARITY_RANK[a.rarity] ?? 0) - (RARITY_RANK[b.rarity] ?? 0);
    if (out === 0) out = (a.level ?? 0) - (b.level ?? 0);
    if (out === 0) out = a.name.localeCompare(b.name);
  }
  return desc ? -out : out;
}

function elementAura(item: Item) {
  if (item.element === "fire") return "rgba(245,101,101,0.28)";
  if (item.element === "ice") return "rgba(99,179,237,0.28)";
  if (item.element === "lightning") return "rgba(236,201,75,0.28)";
  if (item.element === "holy") return "rgba(251,211,141,0.28)";
  if (item.element === "shadow") return "rgba(159,122,234,0.28)";
  if (item.element === "nature") return "rgba(104,211,145,0.28)";
  return "rgba(255,255,255,0.04)";
}

export default function Inventory() {
  const { user, refresh } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [desc, setDesc] = useState(true);
  const [selected, setSelected] = useState<Item | null>(null);

  const load = useCallback(async () => {
    try {
      const inv = await api.inventory();
      setItems(inv);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const onChanged = async () => {
    await load();
    await refresh();
  };

  const filtered = useMemo(() => {
    return items
      .filter((i) => matchesFilter(i, filter))
      .slice()
      .sort((a, b) => compareItems(a, b, sort, desc));
  }, [items, filter, sort, desc]);

  const activeSort = SORTS.find((s) => s.key === sort);

  const chooseSort = (key: SortKey) => {
    if (key === sort) {
      setDesc((v) => !v);
      return;
    }
    const found = SORTS.find((s) => s.key === key);
    setSort(key);
    setDesc(found?.defaultDesc ?? true);
  };

  return (
    <View style={styles.container} testID="inventory-screen">
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>BAG</Text>
          <Text style={styles.capacity}>{items.length}/{INVENTORY_MAX} slots used</Text>
        </View>
        <Text style={styles.count} testID="inventory-count">{filtered.length} shown</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.label}
              onPress={() => setFilter(f.key)}
              style={[
                styles.chip,
                active && { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
              ]}
              testID={`filter-${f.label}`}
            >
              <Text style={[styles.chipText, active && { color: "#fff" }]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.sortBox}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sortLabel}>SORT</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
            {SORTS.map((s) => {
              const active = sort === s.key;
              return (
                <TouchableOpacity key={s.key} onPress={() => chooseSort(s.key)} style={[styles.sortChip, active && styles.sortChipActive]}>
                  <Text style={[styles.sortText, active && styles.sortTextActive]}>{s.label}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
        <TouchableOpacity style={styles.directionBtn} onPress={() => setDesc((v) => !v)}>
          <Ionicons name={desc ? "arrow-down" : "arrow-up"} color={COLORS.secondary} size={18} />
          <Text style={styles.directionText}>{desc ? "DESC" : "ASC"}</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sortHint}>
        {activeSort?.label ?? "Newest"} · {desc ? "high/new to low/old" : "low/old to high/new"}
      </Text>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : filtered.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="cube-outline" color={COLORS.textMuted} size={60} />
          <Text style={styles.emptyTitle}>Empty bag</Text>
          <Text style={styles.emptyText}>Head to Scan tab to find loot.</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          numColumns={3}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 12, paddingBottom: 60 }}
          columnWrapperStyle={{ gap: 10 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
          }
          renderItem={({ item }) => {
            const color = RARITY_COLORS[item.rarity];
            const power = item.slot === "main_hand" ? itemPrimaryPower(item)
              : ARMOR_SLOTS.has(item.slot) || item.slot === "off_hand" ? itemDefensePower(item)
              : itemStatTotal(item);
            return (
              <TouchableOpacity
                style={[styles.tile, { borderColor: color, shadowColor: RARITY_GLOW[item.rarity], backgroundColor: elementAura(item) }]}
                onPress={() => setSelected(item)}
                testID={`item-${item.id}`}
              >
                {item.equipped && (
                  <View style={styles.equippedTag}>
                    <Text style={styles.equippedText}>EQ</Text>
                  </View>
                )}
                {item.element !== "none" && <View style={[styles.elementDot, { backgroundColor: color }]} />}
                <Text style={styles.tileIcon}>{itemIcon(item)}</Text>
                <Text style={[styles.tileName, { color }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.tileLvl}>Lv {item.level} · {power}</Text>
              </TouchableOpacity>
            );
          }}
        />
      )}

      <ItemDetailModal
        visible={!!selected}
        item={selected}
        inventory={items}
        charLevel={user?.level ?? 1}
        onClose={() => setSelected(null)}
        onChanged={onChanged}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: 50 },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  title: { color: "#fff", fontSize: 28, fontWeight: "900", letterSpacing: 4 },
  capacity: { color: COLORS.textMuted, fontSize: 11, marginTop: 3, letterSpacing: 1 },
  count: { color: COLORS.textSecondary, fontSize: 12, letterSpacing: 1 },
  filterRow: { gap: 8, paddingHorizontal: 16, paddingBottom: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  chipText: { color: COLORS.textSecondary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  sortBox: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, marginTop: 4 },
  sortLabel: { color: COLORS.textMuted, fontSize: 9, letterSpacing: 2, fontWeight: "900", marginBottom: 5 },
  sortRow: { gap: 8, paddingRight: 8 },
  sortChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: "rgba(255,255,255,0.035)" },
  sortChipActive: { borderColor: COLORS.secondary, backgroundColor: "rgba(0,229,255,0.10)" },
  sortText: { color: COLORS.textMuted, fontSize: 10, fontWeight: "800" },
  sortTextActive: { color: COLORS.secondary },
  directionBtn: { alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.borderStrong, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, minWidth: 62 },
  directionText: { color: COLORS.secondary, fontSize: 8, fontWeight: "900", marginTop: 2 },
  sortHint: { color: COLORS.textMuted, fontSize: 10, paddingHorizontal: 20, marginTop: 6, marginBottom: 4 },
  tile: {
    flex: 1 / 3,
    aspectRatio: 1,
    borderWidth: 2,
    borderRadius: 14,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.75,
    shadowRadius: 12,
    elevation: 5,
  },
  tileIcon: { fontSize: 34, marginBottom: 6 },
  tileName: { fontSize: 11, fontWeight: "700", textAlign: "center" },
  tileLvl: { color: COLORS.textMuted, fontSize: 9, marginTop: 2 },
  equippedTag: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  equippedText: { fontSize: 8, fontWeight: "900", color: "#000", letterSpacing: 1 },
  elementDot: { position: "absolute", top: 7, left: 7, width: 8, height: 8, borderRadius: 999 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyTitle: { color: COLORS.textPrimary, fontWeight: "800", marginTop: 12, letterSpacing: 2 },
  emptyText: { color: COLORS.textSecondary, marginTop: 6 },
});
