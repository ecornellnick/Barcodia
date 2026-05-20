import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, Item, RARITY_COLORS, SLOT_ICON } from "@/src/lib/api";
import { COLORS } from "@/src/lib/theme";
import { useAuth } from "@/src/lib/auth";
import ItemDetailModal from "@/src/components/ItemDetailModal";

const FILTERS: { label: string; slot?: Item["slot"] }[] = [
  { label: "ALL" },
  { label: "WEAPON", slot: "main_hand" },
  { label: "OFF", slot: "off_hand" },
  { label: "ARMOR", slot: "chest" },
  { label: "TRINKET", slot: "trinket" },
  { label: "CONSUM", slot: "consumable" },
  { label: "SCROLL", slot: "upgrade" },
];

export default function Inventory() {
  const { user, refresh } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Item["slot"] | undefined>(undefined);
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

  const filtered = filter ? items.filter((i) => i.slot === filter) : items;

  return (
    <View style={styles.container} testID="inventory-screen">
      <View style={styles.header}>
        <Text style={styles.title}>BAG</Text>
        <Text style={styles.count} testID="inventory-count">{items.length} items</Text>
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => {
          const active = filter === f.slot;
          return (
            <TouchableOpacity
              key={f.label}
              onPress={() => setFilter(f.slot)}
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
      </View>

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
            return (
              <TouchableOpacity
                style={[styles.tile, { borderColor: color }]}
                onPress={() => setSelected(item)}
                testID={`item-${item.id}`}
              >
                {item.equipped && (
                  <View style={styles.equippedTag}>
                    <Text style={styles.equippedText}>EQ</Text>
                  </View>
                )}
                <Text style={styles.tileIcon}>{SLOT_ICON[item.slot]}</Text>
                <Text style={[styles.tileName, { color }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.tileLvl}>Lv {item.level}</Text>
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
  count: { color: COLORS.textSecondary, fontSize: 12, letterSpacing: 1 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, marginBottom: 4 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  chipText: { color: COLORS.textSecondary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  tile: {
    flex: 1 / 3,
    aspectRatio: 1,
    borderWidth: 2,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    padding: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tileIcon: { fontSize: 36, marginBottom: 6 },
  tileName: { fontSize: 11, fontWeight: "700", textAlign: "center" },
  tileLvl: { color: COLORS.textMuted, fontSize: 10, marginTop: 2 },
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
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyTitle: { color: COLORS.textPrimary, fontWeight: "800", marginTop: 12, letterSpacing: 2 },
  emptyText: { color: COLORS.textSecondary, marginTop: 6 },
});
