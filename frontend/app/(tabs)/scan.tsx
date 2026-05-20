import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { api, Item, RARITY_COLORS, SLOT_ICON } from "@/src/lib/api";
import { COLORS } from "@/src/lib/theme";
import { useAuth } from "@/src/lib/auth";

const SIGIL_COST = 10;

export default function Scan() {
  const { user, refresh } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning, setScanning] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reveal, setReveal] = useState<Item | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const lastScanned = useRef<string>("");
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sigilNext, setSigilNext] = useState(user?.sigil_next_seconds ?? 0);

  const sigilCharge = user?.sigil_charge ?? 100;
  const sigilMax = user?.sigil_charge_max ?? 100;
  const sigilPct = Math.max(0, Math.min(100, (sigilCharge / sigilMax) * 100));

  useEffect(() => {
    return () => {
      if (lockTimer.current) clearTimeout(lockTimer.current);
    };
  }, []);

  useEffect(() => { setSigilNext(user?.sigil_next_seconds ?? 0); }, [user?.sigil_next_seconds]);
  useEffect(() => {
    const t = setInterval(() => setSigilNext((v) => Math.max(0, v - 1)), 1000);
    return () => clearInterval(t);
  }, []);

  const submitCode = async (code: string) => {
    if (busy) return;
    if ((user?.sigil_charge ?? 100) < SIGIL_COST) {
      Alert.alert("Sigil Charge depleted", `The scanner needs ${SIGIL_COST} Sigil Charge to transmute again.`);
      lastScanned.current = "";
      setScanning(true);
      return;
    }

    setBusy(true);
    setScanning(false);
    try {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}
      const result = await api.scan(code);
      setReveal(result);
      await refresh();
    } catch (e: any) {
      Alert.alert("Scan failed", e.message ?? "Try a different barcode");
      lastScanned.current = "";
      setScanning(true);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const onBarcode = ({ data }: { data: string }) => {
    if (!scanning || busy) return;
    if (data === lastScanned.current) return;
    lastScanned.current = data;
    submitCode(data);
  };

  const dismissReveal = () => {
    setReveal(null);
    lastScanned.current = "";
    setScanning(true);
  };

  const closeReveal = () => {
    setReveal(null);
    lastScanned.current = "";
    setScanning(false);
  };

  const submitManual = () => {
    const code = manualCode.trim();
    if (code.length < 4) {
      Alert.alert("Invalid", "Enter at least 4 characters");
      return;
    }
    setManualOpen(false);
    setManualCode("");
    lastScanned.current = code;
    submitCode(code);
  };

  const renderStats = (item: Item) => (
    <View style={styles.revealStats}>
      {item.atk > 0 && <Text style={styles.revealStat}>ATK +{item.atk}</Text>}
      {item.int_stat > 0 && <Text style={styles.revealStat}>INT +{item.int_stat}</Text>}
      {item.def_stat > 0 && <Text style={styles.revealStat}>DEF +{item.def_stat}</Text>}
      {item.res > 0 && <Text style={styles.revealStat}>RES +{item.res}</Text>}
      {item.dex > 0 && <Text style={styles.revealStat}>DEX +{item.dex}</Text>}
      {item.mob > 0 && <Text style={styles.revealStat}>MOB +{item.mob}</Text>}
      {item.crit > 0 && <Text style={styles.revealStat}>CRIT +{item.crit}%</Text>}
      {item.luk > 0 && <Text style={styles.revealStat}>LUK +{item.luk}</Text>}
      {item.hp > 0 && <Text style={styles.revealStat}>HP +{item.hp}</Text>}
      {item.mana > 0 && <Text style={styles.revealStat}>Mana +{item.mana}</Text>}
      {(item as any).stamina_restore > 0 && <Text style={styles.revealStat}>STA +{(item as any).stamina_restore}</Text>}
    </View>
  );

  if (!permission) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  function renderManualModal() {
    return (
      <Modal visible={manualOpen} transparent animationType="fade" onRequestClose={() => setManualOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.manualBackdrop}
        >
          <View style={styles.manualCard}>
            <Text style={styles.manualTitle}>ENTER BARCODE</Text>
            <Text style={styles.manualHint}>
              Type any barcode digits. Barcodia will attempt to transmute it automatically.
            </Text>
            <TextInput
              testID="scan-manual-input"
              value={manualCode}
              onChangeText={setManualCode}
              autoFocus
              placeholder="012345678905"
              placeholderTextColor={COLORS.textMuted}
              style={styles.manualInput}
              keyboardType="default"
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => setManualOpen(false)}
                style={[styles.manualBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: COLORS.borderStrong }]}
              >
                <Text style={styles.manualBtnText}>CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="scan-manual-submit"
                onPress={submitManual}
                style={[styles.manualBtn, { backgroundColor: COLORS.primary }]}
              >
                <Text style={styles.manualBtnText}>TRANSMUTE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  const fmt = (seconds: number) => {
    if (seconds <= 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const ss = seconds % 60;
    return `${m}:${String(ss).padStart(2, "0")}`;
  };

  function renderSigilCharge() {
    return (
      <View style={styles.sigilCard} testID="sigil-charge-card">
        <View style={styles.sigilHeader}>
          <Text style={styles.sigilLabel}>SIGIL CHARGE</Text>
          <Text style={styles.sigilValue}>{sigilCharge}/{sigilMax}</Text>
        </View>
        <View style={styles.sigilTrack}>
          <LinearGradient
            colors={[COLORS.primary, COLORS.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.sigilFill, { width: `${sigilPct}%` }]}
          />
        </View>
        <Text style={styles.sigilHint}>Each scan costs {SIGIL_COST}. Charge slowly returns over time.</Text>
        <Text style={styles.sigilHint}>{sigilCharge >= sigilMax ? "FULL" : `+1 in ${fmt(sigilNext)}`}</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permWrap} testID="scan-permission">
        <Ionicons name="scan-circle-outline" color={COLORS.primary} size={80} />
        <Text style={styles.permTitle}>Camera needed to scan</Text>
        <Text style={styles.permText}>
          We use your camera only to read barcodes — nothing is stored.
        </Text>
        <TouchableOpacity testID="scan-grant" style={styles.cta} onPress={requestPermission}>
          <Text style={styles.ctaText}>GRANT CAMERA</Text>
        </TouchableOpacity>
        <TouchableOpacity
          testID="scan-manual-open-fallback"
          style={[styles.cta, { backgroundColor: "transparent", borderWidth: 1, borderColor: COLORS.borderStrong, marginTop: 12 }]}
          onPress={() => setManualOpen(true)}
        >
          <Text style={[styles.ctaText, { color: COLORS.textPrimary }]}>ENTER CODE MANUALLY</Text>
        </TouchableOpacity>
        {renderManualModal()}
      </View>
    );
  }

  return (
    <View style={styles.container} testID="scan-screen">
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={scanning ? onBarcode : undefined}
        barcodeScannerSettings={{
          barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"],
        }}
      />

      <LinearGradient
        colors={["rgba(10,12,16,0.85)", "transparent", "rgba(10,12,16,0.95)"]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={styles.topBar} pointerEvents="box-none">
        <Text style={styles.title}>SCANNER</Text>
        <Text style={styles.subtitle}>Reality becomes fantasy through sigils</Text>
        {renderSigilCharge()}
      </View>

      <View style={styles.frameWrap} pointerEvents="none">
        <View style={[styles.corner, styles.tl]} />
        <View style={[styles.corner, styles.tr]} />
        <View style={[styles.corner, styles.bl]} />
        <View style={[styles.corner, styles.br]} />
        <View style={styles.scanLine} />
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          testID="scan-manual-open"
          style={styles.manualOpen}
          onPress={() => setManualOpen(true)}
        >
          <Ionicons name="keypad-outline" color={COLORS.textPrimary} size={20} />
          <Text style={styles.manualOpenText}>Enter code manually</Text>
        </TouchableOpacity>
        {!scanning && !busy && !reveal && (
          <TouchableOpacity
            style={[styles.manualOpen, { marginTop: 10, borderColor: COLORS.primary }]}
            onPress={() => { lastScanned.current = ""; setScanning(true); }}
          >
            <Ionicons name="scan-outline" color={COLORS.primary} size={20} />
            <Text style={styles.manualOpenText}>Resume scanner</Text>
          </TouchableOpacity>
        )}
        {busy && (
          <View style={styles.busyWrap}>
            <ActivityIndicator color={COLORS.secondary} />
            <Text style={styles.busyText}>TRANSMUTING SIGIL...</Text>
          </View>
        )}
      </View>

      {renderManualModal()}

      <Modal visible={!!reveal} transparent animationType="slide" onRequestClose={closeReveal}>
        <View style={styles.revealBackdrop}>
          {reveal && (
            <View
              style={[
                styles.revealCard,
                { borderColor: RARITY_COLORS[reveal.rarity], shadowColor: RARITY_COLORS[reveal.rarity] },
              ]}
              testID="scan-reveal"
            >
              <Text style={styles.revealHeader}>NEW ITEM ACQUIRED</Text>
              {reveal.discovery_bonus && <Text style={styles.discoveryText}>FIRST DISCOVERY BONUS</Text>}
              {reveal.recent_duplicate && <Text style={styles.echoText}>ECHO TRANSMUTATION</Text>}
              <Text style={{ fontSize: 72, marginVertical: 12 }}>{SLOT_ICON[reveal.slot]}</Text>
              <Text style={[styles.revealRarity, { color: RARITY_COLORS[reveal.rarity] }]}> 
                {reveal.rarity.toUpperCase()} · LVL {reveal.level}
              </Text>
              <Text style={styles.revealName} testID="scan-reveal-name">{reveal.name}</Text>
              <Text style={styles.revealLore}>{reveal.lore}</Text>
              {!!reveal.message && <Text style={styles.revealMessage}>{reveal.message}</Text>}
              {renderStats(reveal)}

              <View style={styles.revealSigilRow}>
                <Text style={styles.revealSigilLabel}>Sigil Charge</Text>
                <Text style={styles.revealSigilValue}>{reveal.sigil_charge ?? sigilCharge}/{reveal.sigil_charge_max ?? sigilMax}</Text>
              </View>

              <View style={styles.revealButtonRow}>
                <TouchableOpacity
                  testID="scan-reveal-close"
                  onPress={closeReveal}
                  style={[styles.revealBtn, styles.closeRevealBtn]}
                >
                  <Text style={styles.closeRevealText}>CLOSE</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID="scan-reveal-dismiss"
                  onPress={dismissReveal}
                  style={[styles.revealBtn, styles.scanAgainBtn]}
                >
                  <Text style={styles.ctaText}>SCAN AGAIN</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.bg },
  topBar: { position: "absolute", top: 58, left: 18, right: 18, alignItems: "center" },
  title: { color: "#fff", fontSize: 24, fontWeight: "900", letterSpacing: 6 },
  subtitle: { color: COLORS.textSecondary, fontSize: 12, letterSpacing: 1, marginTop: 4, textAlign: "center" },
  sigilCard: {
    width: "100%",
    marginTop: 14,
    backgroundColor: "rgba(26,29,36,0.86)",
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 16,
    padding: 12,
  },
  sigilHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 7 },
  sigilLabel: { color: COLORS.secondary, fontSize: 11, fontWeight: "900", letterSpacing: 2 },
  sigilValue: { color: COLORS.textPrimary, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  sigilTrack: { height: 10, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden" },
  sigilFill: { height: "100%", borderRadius: 999 },
  sigilHint: { color: COLORS.textMuted, fontSize: 10, marginTop: 6, textAlign: "center" },
  frameWrap: {
    position: "absolute",
    top: "36%",
    left: "10%",
    right: "10%",
    height: 220,
  },
  corner: {
    position: "absolute",
    width: 36,
    height: 36,
    borderColor: COLORS.secondary,
  },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4 },
  br: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4 },
  scanLine: {
    position: "absolute",
    left: 10,
    right: 10,
    top: "50%",
    height: 2,
    backgroundColor: COLORS.secondary,
    shadowColor: COLORS.secondary,
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 8,
  },
  bottomBar: { position: "absolute", bottom: 40, left: 0, right: 0, alignItems: "center" },
  manualOpen: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    backgroundColor: "rgba(26,29,36,0.92)",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
  },
  manualOpenText: { color: COLORS.textPrimary, fontWeight: "700", letterSpacing: 1 },
  busyWrap: { marginTop: 12, alignItems: "center", gap: 8 },
  busyText: { color: COLORS.secondary, fontSize: 11, fontWeight: "900", letterSpacing: 2 },

  permWrap: { flex: 1, padding: 32, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.bg },
  permTitle: { color: COLORS.textPrimary, fontSize: 20, fontWeight: "900", marginTop: 16, letterSpacing: 1 },
  permText: { color: COLORS.textSecondary, fontSize: 13, textAlign: "center", marginTop: 8, lineHeight: 20 },
  cta: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 24,
  },
  ctaText: { color: "#fff", fontWeight: "800", letterSpacing: 2 },

  manualBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.8)", justifyContent: "center", padding: 24 },
  manualCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 18,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  manualTitle: { color: COLORS.textPrimary, fontWeight: "900", letterSpacing: 2, marginBottom: 6 },
  manualHint: { color: COLORS.textSecondary, fontSize: 12, marginBottom: 16 },
  manualInput: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 14,
  },
  manualBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  manualBtnText: { color: "#fff", fontWeight: "800", letterSpacing: 2 },

  revealBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", padding: 24 },
  revealCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 2,
    padding: 24,
    alignItems: "center",
    shadowOpacity: 0.7,
    shadowRadius: 30,
    elevation: 12,
  },
  revealHeader: { color: COLORS.textSecondary, fontSize: 11, letterSpacing: 3, fontWeight: "700" },
  discoveryText: { color: COLORS.accent, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginTop: 8 },
  echoText: { color: COLORS.secondary, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginTop: 8 },
  revealRarity: { fontSize: 11, fontWeight: "900", letterSpacing: 3 },
  revealName: { color: "#fff", fontSize: 22, fontWeight: "900", marginTop: 6, textAlign: "center" },
  revealLore: { color: COLORS.textSecondary, fontStyle: "italic", marginTop: 8, textAlign: "center", lineHeight: 18 },
  revealMessage: { color: COLORS.textMuted, fontSize: 11, marginTop: 8, textAlign: "center", lineHeight: 16 },
  revealStats: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 12 },
  revealStat: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: "800",
    backgroundColor: "rgba(255,215,0,0.08)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  revealSigilRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  revealSigilLabel: { color: COLORS.secondary, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  revealSigilValue: { color: COLORS.textPrimary, fontSize: 11, fontWeight: "900", letterSpacing: 1 },
  revealButtonRow: { flexDirection: "row", gap: 10, width: "100%", marginTop: 22 },
  revealBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  scanAgainBtn: { backgroundColor: COLORS.primary },
  closeRevealBtn: { backgroundColor: "transparent", borderWidth: 1, borderColor: COLORS.borderStrong },
  closeRevealText: { color: COLORS.textPrimary, fontWeight: "800", letterSpacing: 2 },
});
