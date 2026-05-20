import { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
  ImageBackground,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { api, Listing, RARITY_COLORS, SLOT_ICON } from "@/src/lib/api";
import { COLORS, IMAGES } from "@/src/lib/theme";
import { useAuth } from "@/src/lib/auth";

export default function Market() {
  const { user, refresh } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mine, setMine] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const l = await api.listings();
      setListings(l);
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

  const buy = (l: Listing) => {
    Alert.alert(
      "Buy item?",
      `${l.item.name} for ${l.price} gold from ${l.seller_name}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Buy",
          onPress: async () => {
            try {
              setBusyId(l.id);
              await api.buyListing(l.id);
              await load();
              await refresh();
            } catch (e: any) {
              Alert.alert("Failed", e.message);
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const cancel = (l: Listing) => {
    Alert.alert("Cancel listing?", `Return ${l.item.name} to your bag`, [
      { text: "No", style: "cancel" },
      {
        text: "Cancel listing",
        onPress: async () => {
          try {
            setBusyId(l.id);
            await api.cancelListing(l.id);
            await load();
          } catch (e: any) {
            Alert.alert("Failed", e.message);
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const visible = mine
    ? listings.filter((l) => l.seller_id === user?.id)
    : listings.filter((l) => l.seller_id !== user?.id);

  return (
    <View style={styles.container} testID="market-screen">
      <ImageBackground source={{ uri: IMAGES.tradingHouse }} style={styles.heroBg}>
        <LinearGradient
          colors={["rgba(10,12,16,0.4)", "rgba(10,12,16,0.95)"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroInner}>
          <Text style={styles.heroTitle}>TRADING HOUSE</Text>
          <Text style={styles.heroSub}>Barcodia Marketplace</Text>
          <View style={styles.goldRow}>
            <Ionicons name="diamond-outline" color={COLORS.accent} size={16} />
            <Text style={styles.goldText} testID="market-gold">{user?.gold ?? 0} gold</Text>
          </View>
        </View>
      </ImageBackground>

      <View style={styles.tabRow}>
        <TouchableOpacity
          testID="market-tab-browse"
          style={[styles.tab, !mine && styles.tabActive]}
          onPress={() => setMine(false)}
        >
          <Text style={[styles.tabText, !mine && styles.tabTextActive]}>BROWSE</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="market-tab-mine"
          style={[styles.tab, mine && styles.tabActive]}
          onPress={() => setMine(true)}
        >
          <Text style={[styles.tabText, mine && styles.tabTextActive]}>MY LISTINGS</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={COLORS.primary} style={{ marginTop: 40 }} />
      ) : visible.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="storefront-outline" color={COLORS.textMuted} size={60} />
          <Text style={styles.emptyTitle}>
            {mine ? "No active listings" : "No items for sale"}
          </Text>
          <Text style={styles.emptyText}>
            {mine ? "List items from your bag." : "Pull to refresh."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor="#fff"
            />
          }
          renderItem={({ item: l }) => {
            const color = RARITY_COLORS[l.item.rarity];
            return (
              <View
                style={[styles.row, { borderColor: color }]}
                testID={`listing-${l.id}`}
              >
                <View style={[styles.icon, { borderColor: color }]}>
                  <Text style={{ fontSize: 30 }}>{SLOT_ICON[l.item.slot]}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={[styles.itemName, { color }]} numberOfLines={1}>
                    {l.item.name}
                  </Text>
                  <Text style={styles.itemMeta}>
                    {l.item.rarity} · Lv {l.item.level} · {l.item.slot}
                  </Text>
                  <Text style={styles.seller}>by {l.seller_name}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.price}>{l.price}g</Text>
                  {mine ? (
                    <TouchableOpacity
                      testID={`cancel-${l.id}`}
                      onPress={() => cancel(l)}
                      disabled={busyId === l.id}
                      style={[styles.btn, { backgroundColor: "transparent", borderWidth: 1, borderColor: COLORS.borderStrong }]}
                    >
                      <Text style={[styles.btnText, { color: COLORS.textPrimary }]}>
                        {busyId === l.id ? "..." : "CANCEL"}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      testID={`buy-${l.id}`}
                      onPress={() => buy(l)}
                      disabled={busyId === l.id || (user?.gold ?? 0) < l.price}
                      style={[
                        styles.btn,
                        {
                          backgroundColor:
                            (user?.gold ?? 0) < l.price ? COLORS.surfaceLight : COLORS.primary,
                        },
                      ]}
                    >
                      <Text style={styles.btnText}>
                        {busyId === l.id ? "..." : (user?.gold ?? 0) < l.price ? "POOR" : "BUY"}
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  heroBg: { height: 150, justifyContent: "flex-end" },
  heroInner: { padding: 20, paddingBottom: 16 },
  heroTitle: { color: "#fff", fontSize: 26, fontWeight: "900", letterSpacing: 4 },
  heroSub: { color: COLORS.textSecondary, fontSize: 11, letterSpacing: 2, marginTop: 2, textTransform: "uppercase" },
  goldRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  goldText: { color: COLORS.accent, fontWeight: "800", letterSpacing: 1 },
  tabRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    alignItems: "center",
  },
  tabActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabText: { color: COLORS.textSecondary, fontWeight: "800", letterSpacing: 2, fontSize: 11 },
  tabTextActive: { color: "#fff" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.03)",
    borderLeftWidth: 3,
    borderRadius: 12,
    padding: 12,
  },
  icon: {
    width: 60,
    height: 60,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  itemName: { fontSize: 15, fontWeight: "800" },
  itemMeta: { color: COLORS.textSecondary, fontSize: 11, marginTop: 2, textTransform: "capitalize" },
  seller: { color: COLORS.textMuted, fontSize: 11, marginTop: 4 },
  price: { color: COLORS.accent, fontWeight: "900", fontSize: 18 },
  btn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    marginTop: 6,
    minWidth: 70,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "800", letterSpacing: 2, fontSize: 11 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  emptyTitle: { color: COLORS.textPrimary, fontWeight: "800", marginTop: 12, letterSpacing: 2 },
  emptyText: { color: COLORS.textSecondary, marginTop: 6 },
});
