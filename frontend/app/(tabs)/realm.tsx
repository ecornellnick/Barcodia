import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { api, RealmInfo, RealmLocation, RealmPayload } from "@/src/lib/api";
import { COLORS } from "@/src/lib/theme";

const BACKEND_BASE = process.env.EXPO_PUBLIC_BACKEND_URL?.replace(/\/api$/, "") || "";

const REALM_IMAGE_SOURCES: Record<string, any> = {
  "asset:realms/bedroom.png": require("../../assets/images/realms/bedroom_clean.png"),
  "asset:realms/bedroom_clean.png": require("../../assets/images/realms/bedroom_clean.png"),
  "asset:realms/whisperwood_beacon.png": require("../../assets/images/realms/whisperwood_beacon_clean.png"),
  "asset:realms/whisperwood_beacon_clean.png": require("../../assets/images/realms/whisperwood_beacon_clean.png"),
};

function imageSource(image?: string): any {
  if (!image) return undefined;
  if (REALM_IMAGE_SOURCES[image]) return REALM_IMAGE_SOURCES[image];
  if (image.startsWith("http")) return { uri: image };
  if (image.startsWith("asset:")) return { uri: `${BACKEND_BASE}/assets/${image.replace("asset:", "")}` };
  if (image.startsWith("/")) return { uri: `${BACKEND_BASE}${image}` };
  return undefined;
}

export default function RealmScreen() {
  const [data, setData] = useState<RealmPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try { setError(""); setLoading(true); setData(await api.realm()); }
    catch (e: any) { setError(e.message || "Could not load realms."); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const traverse = async (realm: RealmInfo, loc: RealmLocation) => {
    if (loc.unlocked === false) return;
    try {
      setWorking(`${realm.id}:${loc.id}`);
      const next = await api.traverseRealm(realm.id, loc.id);
      setData(next);
      router.push("/world");
    } catch (e: any) { setError(e.message || "Traverse failed."); }
    finally { setWorking(null); }
  };

  const realms = useMemo(() => data?.realms || [], [data]);

  return (
    <LinearGradient colors={["#06101F", "#100820", "#05070D"]} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Traverse Realm</Text>
        <Text style={styles.subtitle}>Select where the phone should resonate.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading && !data ? <ActivityIndicator color={COLORS.cyan} style={{ marginTop: 30 }} /> : null}
        {realms.map((realm) => (
          <RealmCard key={realm.id} realm={realm} current={data?.current_realm === realm.id} currentLocationId={data?.current_location_id || ""} working={working} onTraverse={traverse} />
        ))}
      </ScrollView>
    </LinearGradient>
  );
}

function RealmCard({ realm, current, currentLocationId, working, onTraverse }: { realm: RealmInfo; current: boolean; currentLocationId: string; working: string | null; onTraverse: (realm: RealmInfo, loc: RealmLocation) => void }) {
  const accent = realm.accent || COLORS.cyan;
  const heroLoc = realm.locations.find(l => l.current_default) || realm.locations[0];
  const image = imageSource(heroLoc?.image);
  return (
    <View style={[styles.card, current && { borderColor: accent, shadowColor: accent, shadowOpacity: 0.28, shadowRadius: 14 }]}>
      <View style={styles.cardHeader}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 9, flex: 1 }}>
          <Ionicons name={realm.id === "real" ? "home-outline" : "sparkles-outline"} color={accent} size={18} />
          <Text style={styles.realmName}>{realm.label}</Text>
        </View>
        {current ? <Text style={[styles.currentBadge, { color: accent, borderColor: accent }]}>Current</Text> : null}
      </View>
      {image ? <Image source={image} style={styles.cardImage} resizeMode="cover" /> : <View style={styles.cardImageFallback}><Text style={styles.muted}>No image yet</Text></View>}
      <Text style={styles.locationsLabel}>Locations</Text>
      <View style={styles.locationGrid}>
        {realm.locations.map((loc) => {
          const isCurrentLoc = current && loc.id === currentLocationId;
          const locked = loc.unlocked === false;
          return (
            <TouchableOpacity key={loc.id} disabled={locked || isCurrentLoc || working !== null} style={[styles.locationChip, isCurrentLoc && { borderColor: accent, backgroundColor: `${accent}18` }, locked && styles.locked]} onPress={() => onTraverse(realm, loc)} activeOpacity={0.86}>
              <Ionicons name={locked ? "lock-closed-outline" : isCurrentLoc ? "checkmark-circle-outline" : "chevron-forward-outline"} color={locked ? "rgba(255,255,255,0.35)" : accent} size={15} />
              <Text style={[styles.locName, locked && { color: "rgba(255,255,255,0.42)" }]} numberOfLines={1}>{loc.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingTop: 62, paddingHorizontal: 14, paddingBottom: 104 },
  title: { color: "#fff", fontSize: 29, fontWeight: "900", letterSpacing: 1.4, textAlign: "center" },
  subtitle: { color: "rgba(255,255,255,0.72)", textAlign: "center", fontWeight: "800", marginTop: 4, marginBottom: 12, fontSize: 12.5 },
  error: { color: "#FC8181", textAlign: "center", fontWeight: "900", marginBottom: 10 },
  card: { borderRadius: 21, padding: 10, borderWidth: 1.2, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(9,12,24,0.78)", marginBottom: 14, shadowOffset: { width: 0, height: 10 }, shadowRadius: 14, shadowOpacity: 0.20, elevation: 6 },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  realmName: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 0.65, textTransform: "uppercase", flexShrink: 1 },
  currentBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, fontSize: 10, fontWeight: "900", textTransform: "uppercase" },
  cardImage: { width: "100%", height: 86, borderRadius: 15, marginBottom: 9, backgroundColor: "rgba(255,255,255,0.06)" },
  cardImageFallback: { width: "100%", height: 86, borderRadius: 15, marginBottom: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.06)" },
  muted: { color: "rgba(255,255,255,0.62)", fontWeight: "800" },
  locationsLabel: { color: "rgba(255,255,255,0.70)", fontSize: 11, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 7 },
  locationGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  locationChip: { width: "48%", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 9, paddingVertical: 9, borderRadius: 13, borderWidth: 1, borderColor: "rgba(255,255,255,0.10)", backgroundColor: "rgba(255,255,255,0.045)" },
  locked: { opacity: 0.58 },
  locName: { color: "#fff", fontSize: 12.5, fontWeight: "900", flex: 1 },
});
