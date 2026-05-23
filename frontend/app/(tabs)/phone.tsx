import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  ActivityIndicator,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import {
  api,
  DailyGoalsPayload,
  ELEMENT_COLOR,
  itemIcon,
  RARITY_COLORS,
  StoreItem,
  Item,
  User,
  Totals,
  ClassState,
  TalentState,
  TalentNode,
  STAT_META,
  CLASS_META,
  SLOT_LABEL,
} from "@/src/lib/api";
import { COLORS } from "@/src/lib/theme";

const BACKEND_BASE =
  process.env.EXPO_PUBLIC_BACKEND_URL?.replace(/\/api$/, "") || "";

const ZERO_TOTALS: Totals = {
  atk: 0,
  int_stat: 0,
  def_stat: 0,
  res: 0,
  dex: 0,
  mob: 0,
  crit: 0,
  luk: 0,
  hp_bonus: 0,
  mana_bonus: 0,
};

const CLASS_ORDER = [
  "infantry",
  "lancer",
  "cavalry",
  "archer",
  "assassin",
  "flier",
  "aquatic",
  "mage",
  "healer",
  "holy",
  "demon",
];

type HeroPhoneState = {
  user: User | null;
  equipped: Item[];
  totals: Totals;
  classState: ClassState | null;
  talentState: TalentState | null;
  xpNext: number;
};

const EMPTY_HERO: HeroPhoneState = {
  user: null,
  equipped: [],
  totals: ZERO_TOTALS,
  classState: null,
  talentState: null,
  xpNext: 100,
};

function briefItemStats(item: Item): string {
  const parts: string[] = [];
  if (item.atk) parts.push(`ATK +${item.atk}`);
  if (item.int_stat) parts.push(`INT +${item.int_stat}`);
  if (item.def_stat) parts.push(`DEF +${item.def_stat}`);
  if (item.res) parts.push(`RES +${item.res}`);
  if (item.dex) parts.push(`DEX +${item.dex}`);
  if (item.mob) parts.push(`MOB +${item.mob}`);
  if (item.hp) parts.push(`HP +${item.hp}`);
  if (item.mana) parts.push(`Mana +${item.mana}`);
  return parts.slice(0, 4).join(" · ") || "No stat bonuses";
}

function pct(n: number, d: number): number {
  if (!d) return 0;
  return Math.max(0, Math.min(100, Math.round((n / d) * 100)));
}

type PhoneAppKey =
  | "scan"
  | "quests"
  | "hero"
  | "daily"
  | "aether"
  | "settings";
type ScreenKey =
  | "home"
  | "travel"
  | "hero"
  | "hero_equipment"
  | "hero_stats"
  | "hero_talents"
  | "hero_class"
  | "daily"
  | "quests"
  | "store"
  | "soon"
  | "settings";
type ToastState = { title: string; body?: string } | null;

const PHONE_APPS: {
  key: PhoneAppKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  screen: ScreenKey;
  subtitle?: string;
}[] = [
  { key: "scan", label: "Scan", icon: "scan-outline", color: "#6EE7F9", screen: "soon", subtitle: "Opening scanner..." },
  { key: "quests", label: "Quests", icon: "list-circle-outline", color: "#68D391", screen: "quests" },
  { key: "hero", label: "Hero", icon: "person-circle-outline", color: "#B794F4", screen: "hero" },
  { key: "daily", label: "Daily", icon: "star-outline", color: "#FBD38D", screen: "daily" },
  { key: "aether", label: "Aether", icon: "sparkles-outline", color: "#F687B3", screen: "store" },
  { key: "settings", label: "Settings", icon: "settings-outline", color: "#CBD5E0", screen: "settings" },
];

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
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function StoreIcon({ item }: { item: StoreItem }) {
  const uri = imageUri(item);
  const color =
    ELEMENT_COLOR[(item.element as keyof typeof ELEMENT_COLOR) || "none"] ||
    ELEMENT_COLOR.none;
  return (
    <View
      style={[
        styles.storeIconAura,
        { shadowColor: color, borderColor: `${color}88` },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={styles.storeIconImage} />
      ) : (
        <Text style={styles.storeEmoji}>{itemIcon(item as any)}</Text>
      )}
    </View>
  );
}

export default function PhoneScreen() {
  const slideY = useRef(new Animated.Value(900)).current;
  const [screen, setScreen] = useState<ScreenKey>("home");
  const [soonText, setSoonText] = useState("Coming soon");
  const [items, setItems] = useState<StoreItem[]>([]);
  const [gold, setGold] = useState(0);
  const [daily, setDaily] = useState<DailyGoalsPayload | null>(null);
  const [loadingStore, setLoadingStore] = useState(false);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [confirming, setConfirming] = useState<StoreItem | null>(null);
  const [selected, setSelected] = useState<StoreItem | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [buying, setBuying] = useState<string | null>(null);
  const [hero, setHero] = useState<HeroPhoneState>(EMPTY_HERO);
  const [loadingHero, setLoadingHero] = useState(false);

  useEffect(() => {
    Animated.spring(slideY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 52,
      friction: 10,
    }).start();
  }, [slideY]);

  const loadStore = useCallback(async () => {
    setLoadingStore(true);
    try {
      const data = await api.storeGold();
      setItems(data.items || []);
      setGold(data.gold || 0);
    } catch (e: any) {
      setToast({
        title: "Store Error",
        body: e.message || "Could not load store.",
      });
    } finally {
      setLoadingStore(false);
    }
  }, []);

  const loadDaily = useCallback(async () => {
    setLoadingDaily(true);
    try {
      const data = await api.dailyGoals();
      setDaily(data);
    } catch (e: any) {
      setToast({
        title: "Daily Goals",
        body: e.message || "Could not load daily goals.",
      });
    } finally {
      setLoadingDaily(false);
    }
  }, []);

  const loadHero = useCallback(async () => {
    setLoadingHero(true);
    try {
      const r = await api.character();
      setHero({
        user: r.user,
        equipped: r.equipped || [],
        totals: r.totals || ZERO_TOTALS,
        classState: r.class_state || null,
        talentState: r.talent_state || null,
        xpNext: r.xp_to_next || 100,
      });
    } catch (e: any) {
      setToast({
        title: "Hero",
        body: e.message || "Could not load Hero data.",
      });
    } finally {
      setLoadingHero(false);
    }
  }, []);

  const spendTalent = useCallback(
    async (node: TalentNode) => {
      try {
        await api.spendTalent(node.id);
        await loadHero();
      } catch (e: any) {
        setToast({
          title: "Talent",
          body: e.message || "Could not spend talent point.",
        });
      }
    },
    [loadHero],
  );

  const resetTalents = useCallback(async () => {
    try {
      await api.resetTalents();
      await loadHero();
    } catch (e: any) {
      setToast({
        title: "Talent",
        body: e.message || "Could not reset talents.",
      });
    }
  }, [loadHero]);

  useFocusEffect(
    useCallback(() => {
      if (screen === "store") loadStore();
      if (screen === "daily") loadDaily();
      if (
        [
          "hero",
          "hero_equipment",
          "hero_stats",
          "hero_talents",
          "hero_class",
        ].includes(screen)
      )
        loadHero();
    }, [screen, loadStore, loadDaily, loadHero]),
  );

  const openApp = (app: (typeof PHONE_APPS)[number]) => {
    if (app.key === "scan") { router.push("/scan"); return; }
    if (app.screen === "soon") setSoonText(app.subtitle || "Coming soon");
    setScreen(app.screen);
  };

  const goBack = () => {
    if (
      ["hero_equipment", "hero_stats", "hero_talents", "hero_class"].includes(
        screen,
      )
    ) {
      setScreen("hero");
      return;
    }
    if (screen !== "home") {
      setScreen("home");
      return;
    }
    router.back();
  };

  const buy = async () => {
    if (!confirming) return;
    setBuying(confirming.id);
    try {
      const res = await api.buyStoreGold(confirming.id);
      setGold(res.gold);
      setToast({
        title: `${res.item?.name || confirming.name} purchased`,
        body: "Added to your Bag.",
      });
      setConfirming(null);
      await loadStore();
    } catch (e: any) {
      setToast({
        title: "Purchase Failed",
        body: e.message || "Could not buy item.",
      });
    } finally {
      setBuying(null);
    }
  };

  const title = useMemo(() => {
    if (screen === "home") return "Barcodia OS";
    if (screen === "travel") return "Travel";
    if (screen === "hero") return "Hero";
    if (screen === "daily") return "Daily Goals";
    if (screen === "quests") return "Quests";
    if (screen === "hero_equipment") return "Hero > Equipment";
    if (screen === "hero_stats") return "Hero > Stats";
    if (screen === "hero_talents") return "Hero > Talents";
    if (screen === "hero_class") return "Hero > Class";
    if (screen === "store") return "General Shop";
    if (screen === "settings") return "Settings";
    return "Coming Soon";
  }, [screen]);

  return (
    <LinearGradient
      colors={["#05070D", "#111827", "#05070D"]}
      style={styles.root}
    >
      <TouchableOpacity
        style={styles.questNotification}
        activeOpacity={0.86}
        onPress={() => setScreen("quests")}
      >
        <View style={styles.questIconBubble}>
          <Ionicons name="radio-outline" color={COLORS.cyan} size={20} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={styles.questNotifyTop}>
            <Text style={styles.questNotifyTitle}>Main Quest</Text>
            <Text style={styles.questNotifyTime}>now</Text>
          </View>
          <Text style={styles.questNotifyBody} numberOfLines={2}>
            Investigate the strange signal
          </Text>
        </View>
        <Ionicons
          name="chevron-down"
          color="rgba(255,255,255,0.56)"
          size={18}
        />
      </TouchableOpacity>

      <Animated.View
        style={[styles.phoneShell, { transform: [{ translateY: slideY }] }]}
      >
        <LinearGradient
          colors={["#0A0F1F", "#131A2E", "#070A12"]}
          style={styles.phoneBezel}
        >
          <View style={styles.hardwareRow}>
            <View style={styles.speaker} />
            <View style={styles.cameraDot} />
          </View>

          <View style={styles.phoneHeader}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={goBack}
              activeOpacity={0.85}
            >
              <Ionicons
                name={screen === "home" ? "chevron-down" : "chevron-back"}
                size={20}
                color="#E2E8F0"
              />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.phoneTitle}>{title}</Text>
              <Text style={styles.phoneSubtitle}>The relic hums quietly.</Text>
            </View>
          </View>

          <View style={styles.phoneScreen}>
            {screen === "home" && <HomeScreen openApp={openApp} />}
            {screen === "travel" && <TravelScreen setScreen={setScreen} />}
            {screen === "hero" && (
              <HeroHub
                setScreen={setScreen}
                hero={hero}
                loading={loadingHero}
              />
            )}
            {screen === "hero_equipment" && (
              <HeroDetail
                kind="equipment"
                hero={hero}
                loading={loadingHero}
                reload={loadHero}
                spendTalent={spendTalent}
                resetTalents={resetTalents}
              />
            )}
            {screen === "hero_stats" && (
              <HeroDetail
                kind="stats"
                hero={hero}
                loading={loadingHero}
                reload={loadHero}
                spendTalent={spendTalent}
                resetTalents={resetTalents}
              />
            )}
            {screen === "hero_talents" && (
              <HeroDetail
                kind="talents"
                hero={hero}
                loading={loadingHero}
                reload={loadHero}
                spendTalent={spendTalent}
                resetTalents={resetTalents}
              />
            )}
            {screen === "hero_class" && (
              <HeroDetail
                kind="class"
                hero={hero}
                loading={loadingHero}
                reload={loadHero}
                spendTalent={spendTalent}
                resetTalents={resetTalents}
              />
            )}
            {screen === "daily" && (
              <DailyScreen
                daily={daily}
                loading={loadingDaily}
                reload={loadDaily}
              />
            )}
            {screen === "quests" && <QuestScreen />}
            {screen === "store" && (
              <StoreScreen
                items={items}
                gold={gold}
                loading={loadingStore}
                onInfo={setSelected}
                onBuy={setConfirming}
              />
            )}
            {screen === "soon" && <ComingSoon text={soonText} />}
            {screen === "settings" && <SettingsScreen />}
          </View>

          <View style={styles.homeIndicator} />
        </LinearGradient>
      </Animated.View>

      <StoreDetailModal
        item={selected}
        onClose={() => setSelected(null)}
        onBuy={(item) => {
          setSelected(null);
          setConfirming(item);
        }}
      />
      <ConfirmModal
        item={confirming}
        buying={buying === confirming?.id}
        onCancel={() => setConfirming(null)}
        onConfirm={buy}
        gold={gold}
      />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </LinearGradient>
  );
}

function HomeScreen({
  openApp,
}: {
  openApp: (app: (typeof PHONE_APPS)[number]) => void;
}) {
  return (
    <View style={styles.appGrid}>
      {PHONE_APPS.map((app) => (
        <TouchableOpacity
          key={app.key}
          style={styles.appTile}
          onPress={() => openApp(app)}
          activeOpacity={0.82}
        >
          <LinearGradient
            colors={[`${app.color}33`, "rgba(255,255,255,0.06)"]}
            style={[styles.appIcon, { borderColor: `${app.color}88` }]}
          >
            <Ionicons name={app.icon} color={app.color} size={26} />
          </LinearGradient>
          <Text style={styles.appLabel}>{app.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function TravelScreen({
  setScreen,
}: {
  setScreen: (screen: ScreenKey) => void;
}) {
  const destinations = [
    {
      name: "General Shop",
      icon: "storefront-outline",
      subtitle: "Buy supplies with gold",
      action: () => setScreen("store"),
    },
    {
      name: "Adventure",
      icon: "map-outline",
      subtitle: "Return to the forest path",
      action: () => router.push("/battle"),
    },
    {
      name: "Tavern",
      icon: "beer-outline",
      subtitle: "Coming soon",
      action: () => setScreen("soon"),
    },
    {
      name: "Blacksmith",
      icon: "hammer-outline",
      subtitle: "Coming soon",
      action: () => setScreen("soon"),
    },
    {
      name: "Home",
      icon: "home-outline",
      subtitle: "Real-world travel soon",
      action: () => setScreen("soon"),
    },
    {
      name: "Grocery Store",
      icon: "cart-outline",
      subtitle: "Real-world travel soon",
      action: () => setScreen("soon"),
    },
  ] as const;
  return (
    <ScrollView
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.sectionHint}>
        Choose where the relic should open a route.
      </Text>
      {destinations.map((d) => (
        <TouchableOpacity
          key={d.name}
          style={styles.destinationCard}
          onPress={d.action}
          activeOpacity={0.85}
        >
          <View style={styles.destinationIcon}>
            <Ionicons name={d.icon as any} color={COLORS.cyan} size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.destinationName}>{d.name}</Text>
            <Text style={styles.destinationSub}>{d.subtitle}</Text>
          </View>
          <Ionicons name="chevron-forward" color={COLORS.muted} size={18} />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function HeroHub({
  setScreen,
  hero,
  loading,
}: {
  setScreen: (screen: ScreenKey) => void;
  hero: HeroPhoneState;
  loading: boolean;
}) {
  const u = hero.user;
  const items = [
    {
      name: "Equipment",
      icon: "shield-half-outline",
      sub: "Equipped gear and slots",
      action: () => setScreen("hero_equipment"),
    },
    {
      name: "Stats",
      icon: "stats-chart-outline",
      sub: "Combat status and resources",
      action: () => setScreen("hero_stats"),
    },
    {
      name: "Talents",
      icon: "git-branch-outline",
      sub: "Spend and reset talent points",
      action: () => setScreen("hero_talents"),
    },
    {
      name: "Class Proficiency",
      icon: "sparkles-outline",
      sub: "Training by class style",
      action: () => setScreen("hero_class"),
    },
    {
      name: "Daily Goals",
      icon: "star-outline",
      sub: "Open daily tracker",
      action: () => setScreen("daily"),
    },
    {
      name: "Wardrobe",
      icon: "shirt-outline",
      sub: "Blend-in system coming soon",
      action: () => setScreen("soon"),
    },
  ];
  return (
    <ScrollView
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    >
      {loading ? (
        <ActivityIndicator color={COLORS.cyan} style={{ marginTop: 20 }} />
      ) : u ? (
        <View style={styles.heroSummaryCard}>
          <Text style={styles.heroSummaryName}>{u.username}</Text>
          <Text style={styles.heroSummarySub}>
            Level {u.level} · {hero.classState?.primary?.icon ?? "⚔️"}{" "}
            {hero.classState?.primary?.label ?? "Infantry"}
          </Text>
          <View style={styles.heroMiniBars}>
            <View style={styles.heroMiniBar}>
              <Text style={styles.heroMiniLabel}>
                HP {u.hp}/{u.max_hp}
              </Text>
              <View style={styles.miniTrack}>
                <View
                  style={[
                    styles.miniFill,
                    {
                      width: `${pct(u.hp, u.max_hp)}%`,
                      backgroundColor: "#E53E3E",
                    },
                  ]}
                />
              </View>
            </View>
            <View style={styles.heroMiniBar}>
              <Text style={styles.heroMiniLabel}>
                Mana {u.mana}/{u.max_mana}
              </Text>
              <View style={styles.miniTrack}>
                <View
                  style={[
                    styles.miniFill,
                    {
                      width: `${pct(u.mana, u.max_mana)}%`,
                      backgroundColor: "#3182CE",
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        </View>
      ) : null}
      {items.map((it) => (
        <TouchableOpacity
          key={it.name}
          style={styles.destinationCard}
          onPress={it.action}
          activeOpacity={0.85}
        >
          <View style={styles.destinationIcon}>
            <Ionicons name={it.icon as any} color="#B794F4" size={22} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.destinationName}>{it.name}</Text>
            <Text style={styles.destinationSub}>{it.sub}</Text>
          </View>
          <Ionicons name="chevron-forward" color={COLORS.muted} size={18} />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function HeroDetail({
  kind,
  hero,
  loading,
  reload,
  spendTalent,
  resetTalents,
}: {
  kind: "equipment" | "stats" | "talents" | "class";
  hero: HeroPhoneState;
  loading: boolean;
  reload: () => void;
  spendTalent: (node: TalentNode) => void;
  resetTalents: () => void;
}) {
  if (loading) {
    return <ActivityIndicator color={COLORS.cyan} style={{ marginTop: 40 }} />;
  }

  const u = hero.user;
  if (!u) {
    return (
      <View style={styles.centerScreen}>
        <Ionicons name="warning-outline" color={COLORS.cyan} size={42} />
        <Text style={styles.soonTitle}>Hero data unavailable</Text>
        <TouchableOpacity style={styles.refreshPill} onPress={reload}>
          <Ionicons name="refresh" color={COLORS.cyan} size={16} />
          <Text style={styles.refreshText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (kind === "equipment") {
    return (
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionHint}>
          Equipped gear only. Bag management stays in the Bag tab.
        </Text>
        {hero.equipped.length === 0 ? (
          <Text style={styles.emptyText}>No gear equipped yet.</Text>
        ) : (
          hero.equipped.map((item) => (
            <View key={item.id} style={styles.equipmentCard}>
              <View style={styles.equipmentIcon}>
                <Text style={styles.equipmentEmoji}>{itemIcon(item)}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.equipmentName}>{item.name}</Text>
                <Text style={styles.equipmentSlot}>
                  {SLOT_LABEL[item.equip_slot || item.slot] || item.slot} ·{" "}
                  {(item.rarity || "common").toUpperCase()} · Lv {item.level}
                </Text>
                <Text style={styles.equipmentStats}>
                  {briefItemStats(item)}
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    );
  }

  if (kind === "stats") {
    const totalRows = STAT_META.filter((m) => {
      const value = Number((hero.totals as any)[m.key] ?? 0);
      return (
        [
          "atk",
          "int_stat",
          "def_stat",
          "res",
          "dex",
          "mob",
          "crit",
          "luk",
        ].includes(m.key) || value !== 0
      );
    });
    return (
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSummaryCard}>
          <Text style={styles.heroSummaryName}>{u.username}</Text>
          <Text style={styles.heroSummarySub}>
            Level {u.level} · XP {u.xp}/{hero.xpNext}
          </Text>
          <Text style={styles.destinationSub}>
            Gold: {u.gold.toLocaleString()} · Tier {u.difficulty_tier}
          </Text>
        </View>
        <View style={styles.statResourceGrid}>
          <View style={styles.statResourceCard}>
            <Text style={styles.statResourceValue}>
              {u.hp}/{u.max_hp}
            </Text>
            <Text style={styles.statResourceLabel}>HP</Text>
          </View>
          <View style={styles.statResourceCard}>
            <Text style={styles.statResourceValue}>
              {u.mana}/{u.max_mana}
            </Text>
            <Text style={styles.statResourceLabel}>Mana</Text>
          </View>
          <View style={styles.statResourceCard}>
            <Text style={styles.statResourceValue}>
              {u.stamina}/{u.stamina_max}
            </Text>
            <Text style={styles.statResourceLabel}>Stamina</Text>
          </View>
          <View style={styles.statResourceCard}>
            <Text style={styles.statResourceValue}>
              {u.sigil_charge ?? 100}/{u.sigil_charge_max ?? 100}
            </Text>
            <Text style={styles.statResourceLabel}>Sigil</Text>
          </View>
        </View>
        {totalRows.map((m) => (
          <View key={m.key} style={styles.phoneStatRow}>
            <View style={styles.phoneStatBadge}>
              <Text style={[styles.phoneStatValue, { color: m.color }]}>
                {Number((hero.totals as any)[m.key] ?? 0)}
              </Text>
              <Text style={styles.phoneStatShort}>{m.label}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.destinationName}>{m.label}</Text>
              <Text style={styles.destinationSub}>
                Current total from level, talents, and equipment.
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    );
  }

  if (kind === "class") {
    const scores = hero.classState?.scores ?? {};
    const max = Math.max(1, ...CLASS_ORDER.map((k) => Number(scores[k] ?? 0)));
    return (
      <ScrollView
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSummaryCard}>
          <Text style={styles.heroSummaryName}>
            {hero.classState?.primary?.icon ?? "⚔️"}{" "}
            {hero.classState?.primary?.label ?? "Infantry"}
          </Text>
          <Text style={styles.heroSummarySub}>
            Current class is shaped by gear, skills, and battle behavior.
          </Text>
        </View>
        {CLASS_ORDER.map((key) => {
          const chip = CLASS_META[key] ?? { key, label: key, icon: "◇" };
          const raw = Number(scores[key] ?? 0);
          const width = Math.max(
            4,
            Math.round((raw / Math.max(100, max)) * 100),
          );
          return (
            <View key={key} style={styles.profPhoneRow}>
              <View style={styles.profPhoneHead}>
                <Text style={styles.destinationName}>
                  {chip.icon} {chip.label}
                </Text>
                <Text style={styles.profPhoneScore}>{raw}</Text>
              </View>
              <View style={styles.profPhoneTrack}>
                <View style={[styles.profPhoneFill, { width: `${width}%` }]} />
              </View>
            </View>
          );
        })}
      </ScrollView>
    );
  }

  const talents = hero.talentState;
  return (
    <ScrollView
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    >
      {!talents ? (
        <Text style={styles.emptyText}>Talent data is not available yet.</Text>
      ) : (
        <>
          <View style={styles.heroSummaryCard}>
            <Text style={styles.heroSummaryName}>Talent Tree</Text>
            <Text style={styles.heroSummarySub}>
              Available: {talents.points_available} · Spent:{" "}
              {talents.points_spent}
            </Text>
            <Text style={styles.destinationSub}>
              {talents.test_mode
                ? "Test mode: extra points are enabled for tuning."
                : "Spend carefully. Reset may cost gold later."}
            </Text>
          </View>
          <TouchableOpacity style={styles.resetButton} onPress={resetTalents}>
            <Ionicons name="refresh" color="#FBD38D" size={16} />
            <Text style={styles.resetButtonText}>
              {talents.reset_free
                ? "Reset Free"
                : `Reset (${talents.reset_cost} gold)`}
            </Text>
          </TouchableOpacity>
          {talents.nodes.map((node) => (
            <View
              key={node.id}
              style={[
                styles.talentPhoneCard,
                node.locked && styles.talentLocked,
              ]}
            >
              <View style={styles.talentPhoneHead}>
                <Text style={styles.talentPhoneIcon}>{node.icon || "✦"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.equipmentName}>{node.name}</Text>
                  <Text style={styles.equipmentSlot}>
                    Rank {node.rank}/{node.max_rank} · Cost {node.cost}
                  </Text>
                </View>
              </View>
              <Text style={styles.equipmentStats}>
                {node.locked ? node.locked_text || "Locked" : node.description}
              </Text>
              {!!node.total_added &&
                Object.keys(node.total_added).length > 0 && (
                  <Text style={styles.talentTotal}>
                    Total:{" "}
                    {Object.entries(node.total_added)
                      .map(([k, v]) => `${k} +${v}`)
                      .join(" · ")}
                  </Text>
                )}
              <TouchableOpacity
                style={[
                  styles.spendButton,
                  (!node.can_rank || node.locked) && styles.spendButtonDisabled,
                ]}
                disabled={!node.can_rank || !!node.locked}
                onPress={() => spendTalent(node)}
              >
                <Text style={styles.spendButtonText}>
                  {node.locked
                    ? "Locked"
                    : node.can_rank
                      ? "Spend Point"
                      : "Maxed / Unavailable"}
                </Text>
              </TouchableOpacity>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}


function QuestScreen() {
  return (
    <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
      <View style={styles.questPanel}>
        <Text style={styles.questSectionTitle}>Main Quest</Text>
        <Text style={styles.questMainTitle}>Strange Interference</Text>
        <Text style={styles.questDescription}>Investigate the source of the buzzing phone. The signal seems to react differently depending on which realm you are in.</Text>
        <View style={styles.questStatusPill}>
          <Text style={styles.questStatusText}>Tracked</Text>
        </View>
      </View>
      <View style={styles.questPanel}>
        <Text style={styles.questSectionTitle}>Side Quests</Text>
        <Text style={styles.questDescription}>No side quests are active yet.</Text>
      </View>
    </ScrollView>
  );
}

function DailyScreen({
  daily,
  loading,
  reload,
}: {
  daily: DailyGoalsPayload | null;
  loading: boolean;
  reload: () => void;
}) {
  if (loading)
    return <ActivityIndicator color={COLORS.cyan} style={{ marginTop: 40 }} />;
  return (
    <ScrollView
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity style={styles.refreshPill} onPress={reload}>
        <Ionicons name="refresh" color={COLORS.cyan} size={16} />
        <Text style={styles.refreshText}>Refresh</Text>
      </TouchableOpacity>
      {!daily ? (
        <Text style={styles.emptyText}>Daily goals are waking up.</Text>
      ) : (
        <>
          <View style={styles.currencyCard}>
            <Text style={styles.currencyLabel}>
              {daily.premium_currency_name || "Aether Gems"}
            </Text>
            <Text style={styles.currencyValue}>
              {daily.currency_balance || 0}
            </Text>
            <Text style={styles.destinationSub}>
              Complete all daily goals for rare currency.
            </Text>
          </View>
          {daily.goals.map((goal) => (
            <View key={goal.key} style={styles.goalCard}>
              <Text style={styles.goalTitle}>
                {goal.done ? "✅" : "◇"} {goal.label}
              </Text>
              <Text style={styles.goalProgress}>
                {goal.progress}/{goal.target}
              </Text>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function StoreScreen({
  items,
  gold,
  loading,
  onInfo,
  onBuy,
}: {
  items: StoreItem[];
  gold: number;
  loading: boolean;
  onInfo: (i: StoreItem) => void;
  onBuy: (i: StoreItem) => void;
}) {
  if (loading)
    return <ActivityIndicator color={COLORS.cyan} style={{ marginTop: 40 }} />;
  return (
    <ScrollView
      contentContainerStyle={styles.storeContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.goldBar}>
        <Text style={styles.goldText}>🪙 {gold.toLocaleString()} Gold</Text>
        <Text style={styles.destinationSub}>
          Trading House lives here later.
        </Text>
      </View>
      {items.length === 0 ? (
        <Text style={styles.emptyText}>No shop goods are available yet.</Text>
      ) : (
        items.map((item) => (
          <View
            key={item.id}
            style={[
              styles.storeCard,
              {
                borderColor:
                  RARITY_COLORS[item.rarity as keyof typeof RARITY_COLORS] ||
                  "rgba(255,255,255,0.16)",
              },
            ]}
          >
            <StoreIcon item={item} />
            <View style={styles.storeInfo}>
              <Text style={styles.storeName}>{item.name}</Text>
              <Text style={styles.storeMeta}>
                {typeLabel(item)} · {(item.rarity || "common").toUpperCase()}
              </Text>
              <Text style={styles.storeStats}>{statLine(item)}</Text>
              <Text style={styles.storeCost}>
                🪙 {(item.gold_cost || 0).toLocaleString()}
              </Text>
            </View>
            <View style={styles.storeActions}>
              <TouchableOpacity
                style={styles.circleButton}
                onPress={() => onInfo(item)}
              >
                <Ionicons name="information" color={COLORS.cyan} size={18} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.buyMiniButton}
                onPress={() => onBuy(item)}
              >
                <Text style={styles.buyMiniText}>Buy</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function ComingSoon({ text }: { text: string }) {
  return (
    <View style={styles.centerScreen}>
      <Ionicons name="sparkles-outline" color={COLORS.cyan} size={42} />
      <Text style={styles.soonTitle}>Coming Soon</Text>
      <Text style={styles.soonText}>{text}</Text>
    </View>
  );
}

function SettingsScreen() {
  return (
    <View style={styles.centerScreen}>
      <Ionicons name="settings-outline" color={COLORS.cyan} size={42} />
      <Text style={styles.soonTitle}>Settings</Text>
      <Text style={styles.soonText}>
        Sound, account, and display settings will live here later.
      </Text>
    </View>
  );
}

function StoreDetailModal({
  item,
  onClose,
  onBuy,
}: {
  item: StoreItem | null;
  onClose: () => void;
  onBuy: (item: StoreItem) => void;
}) {
  return (
    <Modal visible={!!item} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        {item && (
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{item.name}</Text>
            <Text style={styles.storeMeta}>
              {typeLabel(item)} · {(item.rarity || "common").toUpperCase()}
            </Text>
            <Text style={styles.modalBody}>
              {item.description || statLine(item)}
            </Text>
            <Text style={styles.modalBody}>{statLine(item)}</Text>
            <View style={styles.modalRow}>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={() => onBuy(item)}
              >
                <Text style={styles.confirmText}>Buy</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

function ConfirmModal({
  item,
  buying,
  onCancel,
  onConfirm,
  gold,
}: {
  item: StoreItem | null;
  buying: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  gold: number;
}) {
  return (
    <Modal visible={!!item} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        {item && (
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Buy {item.name}?</Text>
            <Text style={styles.modalBody}>
              Cost: 🪙 {(item.gold_cost || 0).toLocaleString()} Gold
            </Text>
            <Text style={styles.modalBody}>
              You have: 🪙 {gold.toLocaleString()} Gold
            </Text>
            <View style={styles.modalRow}>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onCancel}
                disabled={buying}
              >
                <Text style={styles.closeText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={onConfirm}
                disabled={buying}
              >
                <Text style={styles.confirmText}>
                  {buying ? "Buying..." : "Confirm"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  return (
    <Modal visible={!!toast} transparent animationType="fade">
      <View style={styles.modalBackdrop}>
        {toast && (
          <View style={styles.toastCard}>
            <Text style={styles.modalTitle}>{toast.title}</Text>
            {!!toast.body && <Text style={styles.modalBody}>{toast.body}</Text>}
            <TouchableOpacity style={styles.confirmButton} onPress={onClose}>
              <Text style={styles.confirmText}>OK</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 12, paddingTop: 34, paddingBottom: 8 },
  questNotification: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    backgroundColor: "rgba(0,0,0,0.54)",
    borderRadius: 28,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 8,
  },
  questIconBubble: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(110,231,249,0.12)",
    borderWidth: 1,
    borderColor: "rgba(110,231,249,0.22)",
  },
  questNotifyTop: { flexDirection: "row", alignItems: "baseline", gap: 7 },
  questNotifyTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "900" },
  questNotifyTime: {
    color: "rgba(255,255,255,0.58)",
    fontSize: 11,
    fontWeight: "700",
  },
  questNotifyBody: {
    color: "#F7FAFC",
    fontSize: 13,
    fontWeight: "650",
    marginTop: 2,
  },
  phoneShell: { flex: 1 },
  phoneBezel: {
    flex: 1,
    borderRadius: 38,
    borderWidth: 5,
    borderColor: "#020617",
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.75,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    overflow: "hidden",
  },
  hardwareRow: { height: 22, alignItems: "center", justifyContent: "center" },
  speaker: {
    width: 58,
    height: 6,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  cameraDot: {
    position: "absolute",
    width: 9,
    height: 9,
    borderRadius: 99,
    backgroundColor: "#020617",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    transform: [{ translateX: 42 }],
  },
  phoneHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  phoneTitle: {
    color: "#F7FAFC",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  phoneSubtitle: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  phoneScreen: { flex: 1, paddingTop: 14 },
  homeIndicator: {
    width: 92,
    height: 5,
    borderRadius: 99,
    alignSelf: "center",
    backgroundColor: "rgba(255,255,255,0.32)",
    marginTop: 8,
  },
  appGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingTop: 6,
  },
  appTile: { width: "31%", alignItems: "center", marginBottom: 24 },
  appIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.cyan,
    shadowOpacity: 0.18,
    shadowRadius: 10,
  },
  appLabel: {
    color: "#E2E8F0",
    fontSize: 11,
    fontWeight: "800",
    marginTop: 7,
    textAlign: "center",
  },
  listContent: { paddingBottom: 24, gap: 10 },
  sectionHint: { color: COLORS.muted, fontSize: 12, marginBottom: 4 },
  destinationCard: {
    minHeight: 64,
    borderRadius: 18,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  destinationIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(110,231,249,0.10)",
    borderWidth: 1,
    borderColor: "rgba(110,231,249,0.20)",
  },
  destinationName: { color: "#F7FAFC", fontSize: 15, fontWeight: "900" },
  destinationSub: { color: "#CBD5E0", fontSize: 11, marginTop: 2 },
  questPanel: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  questSectionTitle: {
    color: COLORS.cyan,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  questMainTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 8,
  },
  questDescription: {
    color: "#CBD5E0",
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  questStatusPill: {
    alignSelf: "flex-start",
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 99,
    backgroundColor: "rgba(104,211,145,0.14)",
    borderWidth: 1,
    borderColor: "rgba(104,211,145,0.28)",
  },
  questStatusText: { color: "#9AE6B4", fontSize: 11, fontWeight: "900" },
  refreshPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 99,
    backgroundColor: "rgba(110,231,249,0.10)",
    borderWidth: 1,
    borderColor: "rgba(110,231,249,0.24)",
  },
  refreshText: { color: COLORS.cyan, fontWeight: "900", fontSize: 12 },
  currencyCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(251,211,141,0.10)",
    borderWidth: 1,
    borderColor: "rgba(251,211,141,0.22)",
  },
  currencyLabel: {
    color: "#FBD38D",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
  },
  currencyValue: {
    color: "#FFF",
    fontSize: 26,
    fontWeight: "900",
    marginTop: 4,
  },
  goalCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 16,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  goalTitle: { color: "#F7FAFC", fontWeight: "800", flex: 1 },
  goalProgress: { color: COLORS.cyan, fontWeight: "900" },
  storeContent: { paddingBottom: 24, gap: 10 },
  goldBar: {
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(251,211,141,0.10)",
    borderWidth: 1,
    borderColor: "rgba(251,211,141,0.20)",
  },
  goldText: { color: "#FBD38D", fontSize: 16, fontWeight: "900" },
  storeCard: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    padding: 10,
    borderRadius: 18,
    borderWidth: 1.5,
    backgroundColor: "rgba(255,255,255,0.055)",
  },
  storeIconAura: {
    width: 54,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.28)",
    shadowOpacity: 0.55,
    shadowRadius: 12,
  },
  storeIconImage: { width: 50, height: 50, borderRadius: 16 },
  storeEmoji: { fontSize: 28 },
  storeInfo: { flex: 1, minWidth: 0 },
  storeName: {
    color: "#F7FAFC",
    fontWeight: "900",
    fontSize: 13,
    flexWrap: "wrap",
  },
  storeMeta: {
    color: COLORS.cyan,
    fontSize: 10,
    fontWeight: "900",
    marginTop: 2,
  },
  storeStats: { color: COLORS.muted, fontSize: 11, marginTop: 3 },
  storeCost: {
    color: "#FBD38D",
    fontSize: 12,
    fontWeight: "900",
    marginTop: 4,
  },
  storeActions: { alignItems: "center", gap: 8 },
  circleButton: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(110,231,249,0.10)",
    borderWidth: 1,
    borderColor: "rgba(110,231,249,0.25)",
  },
  buyMiniButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: COLORS.cyan,
  },
  buyMiniText: { color: "#021018", fontWeight: "900", fontSize: 11 },
  centerScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  soonTitle: {
    color: "#F7FAFC",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 14,
  },
  soonText: {
    color: COLORS.muted,
    textAlign: "center",
    lineHeight: 20,
    marginTop: 8,
  },
  emptyText: { color: COLORS.muted, textAlign: "center", marginTop: 30 },

  heroSummaryCard: {
    borderRadius: 20,
    padding: 14,
    backgroundColor: "rgba(183,148,244,0.11)",
    borderWidth: 1,
    borderColor: "rgba(183,148,244,0.24)",
  },
  heroSummaryName: { color: "#FFFFFF", fontSize: 20, fontWeight: "900" },
  heroSummarySub: {
    color: "#E9D8FD",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
  },
  heroMiniBars: { gap: 8, marginTop: 12 },
  heroMiniBar: { gap: 5 },
  heroMiniLabel: { color: "#E2E8F0", fontSize: 11, fontWeight: "800" },
  miniTrack: {
    height: 7,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.10)",
    overflow: "hidden",
  },
  miniFill: { height: "100%", borderRadius: 99 },
  equipmentCard: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    padding: 12,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.065)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  equipmentIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.26)",
    borderWidth: 1,
    borderColor: "rgba(110,231,249,0.20)",
  },
  equipmentEmoji: { fontSize: 25 },
  equipmentName: { color: "#F7FAFC", fontSize: 15, fontWeight: "900" },
  equipmentSlot: {
    color: COLORS.cyan,
    fontSize: 10,
    fontWeight: "900",
    marginTop: 2,
  },
  equipmentStats: {
    color: "#CBD5E0",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 5,
  },
  statResourceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statResourceCard: {
    width: "48%",
    borderRadius: 16,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  statResourceValue: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  statResourceLabel: {
    color: COLORS.muted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 3,
  },
  phoneStatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 17,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.055)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  phoneStatBadge: {
    width: 58,
    height: 58,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.24)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  phoneStatValue: { fontSize: 18, fontWeight: "900" },
  phoneStatShort: { color: COLORS.muted, fontSize: 10, fontWeight: "900" },
  profPhoneRow: {
    borderRadius: 17,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.055)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  profPhoneHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  profPhoneScore: { color: COLORS.cyan, fontWeight: "900" },
  profPhoneTrack: {
    height: 7,
    borderRadius: 99,
    backgroundColor: "rgba(255,255,255,0.10)",
    marginTop: 8,
    overflow: "hidden",
  },
  profPhoneFill: {
    height: "100%",
    borderRadius: 99,
    backgroundColor: COLORS.cyan,
  },
  resetButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 99,
    backgroundColor: "rgba(251,211,141,0.10)",
    borderWidth: 1,
    borderColor: "rgba(251,211,141,0.25)",
  },
  resetButtonText: { color: "#FBD38D", fontSize: 12, fontWeight: "900" },
  talentPhoneCard: {
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.065)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  talentLocked: { opacity: 0.58 },
  talentPhoneHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  talentPhoneIcon: { fontSize: 24 },
  talentTotal: {
    color: "#9AE6B4",
    fontSize: 11,
    fontWeight: "850",
    marginTop: 7,
  },
  spendButton: {
    marginTop: 10,
    borderRadius: 13,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: COLORS.cyan,
  },
  spendButtonDisabled: { backgroundColor: "rgba(255,255,255,0.10)" },
  spendButtonText: { color: "#021018", fontSize: 12, fontWeight: "900" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  toastCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "rgba(110,231,249,0.22)",
  },
  modalTitle: {
    color: "#F7FAFC",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 8,
  },
  modalBody: {
    color: COLORS.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  modalRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  closeButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  confirmButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: COLORS.cyan,
  },
  closeText: { color: "#E2E8F0", fontWeight: "900" },
  confirmText: { color: "#021018", fontWeight: "900" },
});
