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
  api,
  Item,
  RARITY_COLORS,
  RARITY_GLOW,
  itemIcon,
  itemPrimaryPower,
  itemDefensePower,
  itemStatTotal,
} from "@/src/lib/api";
import { COLORS } from "@/src/lib/theme";
import { useAuth } from "@/src/lib/auth";
import ItemDetailModal from "@/src/components/ItemDetailModal";

const INVENTORY_MAX = 50;

type FilterKey =
  | "all"
  | "weapon"
  | "off"
  | "armor"
  | "trinket"
  | "consumable"
  | "upgrade";
type SortKey =
  | "newest"
  | "name"
  | "rarity"
  | "level"
  | "weapon_power"
  | "armor_defense"
  | "stat_total"
  | "slot";

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
  { label: "Power", key: "weapon_power", defaultDesc: true },
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

const ARMOR_SLOTS = new Set([
  "head",
  "chest",
  "leg_l",
  "leg_r",
  "arm_l",
  "arm_r",
]);
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
    case "name":
      return item.name.toLowerCase();
    case "rarity":
      return RARITY_RANK[item.rarity] ?? 0;
    case "level":
      return item.level ?? 0;
    case "weapon_power":
      return item.slot === "main_hand" ? itemPrimaryPower(item) : -1;
    case "armor_defense":
      return ARMOR_SLOTS.has(item.slot) || item.slot === "off_hand"
        ? itemDefensePower(item)
        : -1;
    case "stat_total":
      return itemStatTotal(item);
    case "slot":
      return item.slot;
    case "newest":
    default:
      return item.id;
  }
}

function compareItems(a: Item, b: Item, sort: SortKey, desc: boolean) {
  const av = sortValue(a, sort);
  const bv = sortValue(b, sort);
  let out = 0;
  if (typeof av === "string" || typeof bv === "string")
    out = String(av).localeCompare(String(bv));
  else out = Number(av) - Number(bv);

  if (out === 0) {
    out = (RARITY_RANK[a.rarity] ?? 0) - (RARITY_RANK[b.rarity] ?? 0);
    if (out === 0) out = (a.level ?? 0) - (b.level ?? 0);
    if (out === 0) out = a.name.localeCompare(b.name);
  }
  return desc ? -out : out;
}

function elementAura(item: Item) {
  if (item.element === "fire")
    return {
      bg: "rgba(245,101,101,0.16)",
      glow: "rgba(245,101,101,0.9)",
      label: "🔥",
    };
  if (item.element === "ice")
    return {
      bg: "rgba(99,179,237,0.16)",
      glow: "rgba(99,179,237,0.9)",
      label: "❄️",
    };
  if (item.element === "lightning")
    return {
      bg: "rgba(236,201,75,0.16)",
      glow: "rgba(236,201,75,0.9)",
      label: "⚡",
    };
  if (item.element === "holy")
    return {
      bg: "rgba(251,211,141,0.16)",
      glow: "rgba(251,211,141,0.9)",
      label: "☀️",
    };
  if (item.element === "shadow")
    return {
      bg: "rgba(159,122,234,0.18)",
      glow: "rgba(159,122,234,0.95)",
      label: "🌑",
    };
  if (item.element === "nature")
    return {
      bg: "rgba(104,211,145,0.15)",
      glow: "rgba(104,211,145,0.9)",
      label: "🍃",
    };
  return null;
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
          <Text style={styles.capacity}>
            {items.length}/{INVENTORY_MAX} slots used
          </Text>
        </View>
        <Text style={styles.count} testID="inventory-count">
          {filtered.length} shown
        </Text>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <TouchableOpacity
              key={f.label}
              onPress={() => setFilter(f.key)}
              style={[
                styles.chip,
                active && {
                  backgroundColor: COLORS.primary,
                  borderColor: COLORS.primary,
                },
              ]}
              testID={`filter-${f.label}`}
            >
              <Text style={[styles.chipText, active && { color: "#fff" }]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.sortBox}>
        <View style={styles.sortTopRow}>
          <Text style={styles.sortLabel}>SORT</Text>
          <TouchableOpacity
            style={styles.directionBtn}
            onPress={() => setDesc((v) => !v)}
          >
            <Ionicons
              name={desc ? "arrow-down" : "arrow-up"}
              color={COLORS.secondary}
              size={14}
            />
            <Text style={styles.directionText}>{desc ? "DESC" : "ASC"}</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.sortRow}>
          {SORTS.map((s) => {
            const active = sort === s.key;
            return (
              <TouchableOpacity
                key={s.key}
                onPress={() => chooseSort(s.key)}
                style={[styles.sortChip, active && styles.sortChipActive]}
              >
                <Text
                  style={[styles.sortText, active && styles.sortTextActive]}
                  numberOfLines={1}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <Text style={styles.sortHint}>
        {activeSort?.label ?? "Newest"} ·{" "}
        {desc ? "high/new to low/old" : "low/old to high/new"}
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
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#fff"
            />
          }
          renderItem={({ item }) => {
            const color = RARITY_COLORS[item.rarity];
            const aura = elementAura(item);
            const power =
              item.slot === "main_hand"
                ? itemPrimaryPower(item)
                : ARMOR_SLOTS.has(item.slot) || item.slot === "off_hand"
                  ? itemDefensePower(item)
                  : itemStatTotal(item);
            return (
              <TouchableOpacity
                style={[
                  styles.tile,
                  { borderColor: color, shadowColor: RARITY_GLOW[item.rarity] },
                ]}
                onPress={() => setSelected(item)}
                testID={`item-${item.id}`}
              >
                {item.equipped && (
                  <View style={styles.equippedTag}>
                    <Text style={styles.equippedText}>EQ</Text>
                  </View>
                )}
                <View style={[styles.rarityDot, { backgroundColor: color }]} />
                <View
                  style={[
                    styles.iconWrap,
                    aura && {
                      backgroundColor: aura.bg,
                      shadowColor: aura.glow,
                      borderColor: aura.glow,
                    },
                  ]}
                >
                  {aura && <Text style={styles.auraGlyph}>{aura.label}</Text>}
                  <Text style={styles.tileIcon}>{itemIcon(item)}</Text>
                </View>
                <Text style={[styles.tileName, { color }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.tileLvl}>
                  Lv {item.level} · {power}
                </Text>
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
    marginBottom: 10,
  },
  title: { color: "#fff", fontSize: 28, fontWeight: "900", letterSpacing: 4 },
  capacity: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginTop: 3,
    letterSpacing: 1,
  },
  count: { color: COLORS.textSecondary, fontSize: 12, letterSpacing: 1 },

  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 3,
    alignItems: "center",
    marginBottom: 6,
    width: "100%",
    overflow: "hidden",
  },
  chip: {
    height: 32,
    minWidth: 58,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: "rgba(255,255,255,0.04)",
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 0,
    flexShrink: 0,
  },
  chipText: {
    color: COLORS.textSecondary,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
  },

  sortBox: {
    paddingHorizontal: 16,
    marginTop: 2,
    marginBottom: 2,
    width: "100%",
    overflow: "hidden",
  },
  sortTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  sortLabel: {
    color: COLORS.textMuted,
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: "900",
  },
  sortRow: { flexDirection: "row", flexWrap: "wrap", gap: 7, alignItems: "center", width: "100%" },
  sortChip: {
    height: 28,
    minWidth: 54,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 999,
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.035)",
    alignItems: "center",
    justifyContent: "center",
    flexGrow: 0,
    flexShrink: 0,
  },
  sortChipActive: {
    borderColor: COLORS.secondary,
    backgroundColor: "rgba(0,229,255,0.10)",
  },
  sortText: { color: COLORS.textMuted, fontSize: 10, fontWeight: "800" },
  sortTextActive: { color: COLORS.secondary },
  directionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 999,
    paddingHorizontal: 10,
    height: 28,
    minWidth: 72,
    backgroundColor: "rgba(255,255,255,0.035)",
  },
  directionText: {
    color: COLORS.secondary,
    fontSize: 8,
    fontWeight: "900",
  },
  sortHint: {
    color: COLORS.textMuted,
    fontSize: 10,
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 4,
  },

  tile: {
    flex: 1 / 3,
    aspectRatio: 1,
    borderWidth: 2,
    borderRadius: 14,
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.045)",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  iconWrap: {
    width: 58,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    backgroundColor: "rgba(0,0,0,0.22)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    shadowOpacity: 0.85,
    shadowRadius: 13,
    elevation: 6,
    overflow: "hidden",
  },
  auraGlyph: {
    position: "absolute",
    top: 3,
    right: 4,
    fontSize: 12,
    opacity: 0.9,
  },
  tileIcon: { fontSize: 32 },
  tileName: {
    fontSize: 11,
    fontWeight: "800",
    textAlign: "center",
    maxWidth: "100%",
  },
  tileLvl: { color: COLORS.textMuted, fontSize: 9, marginTop: 2 },
  equippedTag: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: COLORS.accent,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 2,
  },
  equippedText: {
    fontSize: 8,
    fontWeight: "900",
    color: "#000",
    letterSpacing: 1,
  },
  rarityDot: {
    position: "absolute",
    top: 7,
    left: 7,
    width: 8,
    height: 8,
    borderRadius: 999,
    zIndex: 2,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontWeight: "800",
    marginTop: 12,
    letterSpacing: 2,
  },
  emptyText: { color: COLORS.textSecondary, marginTop: 6 },
});
