import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ImageBackground,
  ScrollView,
  ActivityIndicator,
  Alert,
  Modal,
  useWindowDimensions,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import {
  api,
  Enemy,
  BattleLog,
  Item,
  ClassState,
  Totals,
  Skill,
  AdventureMap,
  DailyGoalsPayload,
  itemIcon,
} from "@/src/lib/api";
import { COLORS, IMAGES } from "@/src/lib/theme";
import { useAuth } from "@/src/lib/auth";

const WHISPERWOOD_MAP = require("../../assets/images/whisperwood-map.png");

const ENEMY_PORTRAITS: Record<string, any> = {
  "asset:enemy_slime": require("../../assets/images/enemies/enemy_slime.png"),
  "asset:enemy_red_slime": require("../../assets/images/enemies/enemy_red_slime.png"),
  "asset:enemy_bat": require("../../assets/images/enemies/enemy_bat.png"),
  "asset:enemy_tree": require("../../assets/images/enemies/enemy_tree.png"),
  "asset:enemy_wolf": require("../../assets/images/enemies/enemy_wolf.png"),
  "asset:enemy_goblin": require("../../assets/images/enemies/enemy_goblin.png"),
  "asset:enemy_wisp": require("../../assets/images/enemies/enemy_wisp.png"),
  "asset:enemy_boss_thorn": require("../../assets/images/enemies/enemy_boss_thorn.png"),
  "asset:enemy_skeleton": require("../../assets/images/enemies/enemy_skeleton.png"),
  "asset:enemy_dark_mage": require("../../assets/images/enemies/enemy_dark_mage.png"),
  "asset:enemy_knight": require("../../assets/images/enemies/enemy_knight.png"),
  "asset:enemy_orc": require("../../assets/images/enemies/enemy_orc.png"),
  "asset:enemy_ice_golem": require("../../assets/images/enemies/enemy_ice_golem.png"),
  "asset:enemy_shadow_assassin": require("../../assets/images/enemies/enemy_shadow_assassin.png"),
  "asset:enemy_hell_hound": require("../../assets/images/enemies/enemy_hell_hound.png"),
  "asset:enemy_wyvern": require("../../assets/images/enemies/enemy_wyvern.png"),
};

function enemyPortraitSource(portrait?: string) {
  if (!portrait) return null;
  if (portrait.startsWith("asset:")) return ENEMY_PORTRAITS[portrait] ?? null;
  return { uri: portrait };
}


type Action = "weapon" | "skill" | "item" | "flee";
type Mode = "home" | "quick" | "adventure" | "fight";

function fmt(seconds: number) {
  if (seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function hpPct(enemy: Enemy | null) {
  if (!enemy) return 0;
  return Math.max(0, Math.min(100, (enemy.hp / enemy.max_hp) * 100));
}

export default function Battle() {
  const { user, refresh } = useAuth();
  const { width } = useWindowDimensions();
  const mapWidth = Math.max(300, width - 36);
  const [mode, setMode] = useState<Mode>("home");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [enemy, setEnemy] = useState<Enemy | null>(null);
  const [stamina, setStamina] = useState(0);
  const [stamMax, setStamMax] = useState(5);
  const [staminaNext, setStaminaNext] = useState(0);
  const [tier, setTier] = useState(1);
  const [visibleLog, setVisibleLog] = useState<BattleLog[]>([]);
  const [outcome, setOutcome] = useState<{ win: boolean; escaped?: boolean; rewards: { xp: number; gold: number; item: Item | null } } | null>(null);
  const [classState, setClassState] = useState<ClassState | null>(null);
  const [mainWeapon, setMainWeapon] = useState<Item | null>(null);
  const [totals, setTotals] = useState<Totals | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [skillMenuOpen, setSkillMenuOpen] = useState(false);
  const [skillInfo, setSkillInfo] = useState<Skill | null>(null);
  const [itemMenuOpen, setItemMenuOpen] = useState(false);
  const [consumables, setConsumables] = useState<Item[]>([]);
  const [changeEnemySeconds, setChangeEnemySeconds] = useState(0);
  const [daily, setDaily] = useState<DailyGoalsPayload | null>(null);
  const [adventure, setAdventure] = useState<AdventureMap | null>(null);
  const [battleMode, setBattleMode] = useState("quick");
  const [activeNode, setActiveNode] = useState<number | null>(null);

  const loadHome = useCallback(async () => {
    try {
      const [goals, map] = await Promise.all([api.dailyGoals(), api.adventureMap()]);
      setDaily(goals);
      setAdventure(map);
    } catch (e: any) {
      Alert.alert("Battle menu failed", e.message ?? "Could not load battle data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadHome();
    }, [loadHome]),
  );

  useEffect(() => {
    const t = setInterval(() => {
      setStaminaNext((v) => Math.max(0, v - 1));
      setChangeEnemySeconds((v) => Math.max(0, v - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  const loadPreview = useCallback(async () => {
    const r = await api.battlePreview();
    setEnemy(r.enemy);
    setStamina(r.stamina);
    setStamMax(r.stamina_max);
    setStaminaNext(r.stamina_next_seconds ?? 0);
    setTier(r.difficulty_tier);
    setClassState(r.class_state);
    setMainWeapon(r.main_weapon);
    setTotals(r.totals);
    setSkills(r.skills ?? []);
    setChangeEnemySeconds(r.change_enemy_seconds ?? 0);
    setBattleMode(r.mode ?? "quick");
    setActiveNode(r.adventure_node ?? null);
    setOutcome(null);
    setMode("fight");
  }, []);

  const startQuick = async () => {
    setBusy(true);
    try {
      setVisibleLog([]);
      await loadPreview();
    } catch (e: any) {
      Alert.alert("Quick Hunt unavailable", e.message ?? "Try again later.");
    } finally {
      setBusy(false);
    }
  };

  const startAdventure = async (node: number) => {
    setBusy(true);
    try {
      setVisibleLog([]);
      await api.adventureStart(node);
      await loadPreview();
    } catch (e: any) {
      Alert.alert("Adventure unavailable", e.message ?? "Try again later.");
    } finally {
      setBusy(false);
    }
  };


  const pathPoint = (node: any) => ({
    x: (mapWidth * Number(node.x || 50)) / 100,
    y: Number(node.y || 0) + (node.kind === "boss" ? 48 : node.kind === "miniboss" ? 42 : 35),
  });

  const renderTrailPiece = (from: { x: number; y: number }, to: { x: number; y: number }, key: string, completed = false) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const steps = Math.max(3, Math.floor(length / 16));
    const pieces = [];

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = from.x + dx * t;
      const y = from.y + dy * t;
      const size = i % 3 === 0 ? 9 : i % 2 === 0 ? 7 : 6;
      pieces.push(
        <View
          key={`${key}-stone-${i}`}
          style={[
            styles.trailStone,
            completed && styles.trailStoneComplete,
            {
              left: x - size / 2,
              top: y - size / 2,
              width: size,
              height: size,
              borderRadius: size,
              opacity: 0.62 + (i % 4) * 0.07,
            },
          ]}
        />,
      );
      if (i % 5 === 2) {
        pieces.push(
          <View
            key={`${key}-rune-${i}`}
            style={[
              styles.trailFirefly,
              {
                left: x + (i % 2 === 0 ? 10 : -12),
                top: y + (i % 3 === 0 ? -10 : 8),
              },
            ]}
          />,
        );
      }
    }
    return pieces;
  };

  const renderForestTrail = () => {
    const nodes = adventure?.nodes ?? [];
    if (nodes.length < 2) return null;
    const pieces: any[] = [];

    // The path is intentionally hand-authored around visible landmarks.
    // It should feel like a forest trail, not a technical graph connector.
    const detours: Record<number, { x: number; y: number }[]> = {
      1: [{ x: mapWidth * 0.28, y: 235 }, { x: mapWidth * 0.42, y: 270 }],
      2: [{ x: mapWidth * 0.58, y: 365 }, { x: mapWidth * 0.42, y: 410 }],
      3: [{ x: mapWidth * 0.30, y: 500 }, { x: mapWidth * 0.40, y: 590 }],
      4: [{ x: mapWidth * 0.58, y: 640 }, { x: mapWidth * 0.50, y: 710 }],
      5: [{ x: mapWidth * 0.40, y: 760 }, { x: mapWidth * 0.24, y: 840 }],
      6: [{ x: mapWidth * 0.24, y: 930 }, { x: mapWidth * 0.47, y: 990 }],
      7: [{ x: mapWidth * 0.64, y: 1070 }, { x: mapWidth * 0.46, y: 1125 }],
      8: [{ x: mapWidth * 0.34, y: 1200 }, { x: mapWidth * 0.54, y: 1265 }],
      9: [{ x: mapWidth * 0.70, y: 1340 }, { x: mapWidth * 0.56, y: 1400 }],
    };

    for (let i = 0; i < nodes.length - 1; i++) {
      const fromNode = nodes[i];
      const toNode = nodes[i + 1];
      const completed = Boolean(fromNode.completed && (toNode.completed || toNode.unlocked));
      const points = [pathPoint(fromNode), ...(detours[fromNode.node] ?? []), pathPoint(toNode)];
      for (let j = 0; j < points.length - 1; j++) {
        pieces.push(...renderTrailPiece(points[j], points[j + 1], `trail-${i}-${j}`, completed));
      }
    }
    return pieces;
  };

  const syncFromResponse = async (r: any) => {
    const nextLines = r.log ?? [];
    setVisibleLog((cur) => [...nextLines, ...cur].slice(0, 8));
    setEnemy(r.next_enemy ?? r.enemy);
    if (r.class_state) setClassState(r.class_state);
    if (r.main_weapon !== undefined) setMainWeapon(r.main_weapon ?? null);
    if (r.skills) setSkills(r.skills);
    if (r.user) {
      setStamina(r.user.stamina);
      setStamMax(r.user.stamina_max);
      setTier(r.user.difficulty_tier);
    }
    if (r.resolved) {
      setOutcome({ win: r.win, escaped: r.escaped, rewards: r.rewards });
      setVisibleLog(nextLines);
      await loadHome();
    }
    await refresh();
  };

  const runAction = async (action: Action, skill?: Skill, item?: Item) => {
    if (busy || outcome) return;
    setBusy(true);
    setSkillMenuOpen(false);
    setItemMenuOpen(false);
    try {
      const r = await api.battleFight(action, item?.id, skill?.id);
      await syncFromResponse(r);
    } catch (e: any) {
      Alert.alert("Battle failed", e.message ?? "Try again");
    } finally {
      setBusy(false);
    }
  };

  const openItemMenu = async () => {
    if (busy || outcome) return;
    try {
      const inv = await api.inventory();
      const usable = inv.filter((it) => it.slot === "consumable" && !it.listed);
      setConsumables(usable);
      if (usable.length === 0) {
        Alert.alert("No items", "You do not have a usable consumable. This does not cost a turn.");
        return;
      }
      setItemMenuOpen(true);
    } catch (e: any) {
      Alert.alert("Item menu failed", e.message ?? "Could not load items.");
    }
  };

  const changeEnemy = async () => {
    if (busy || battleMode === "adventure") return;
    try {
      const r = await api.battleSkip();
      setEnemy(r.enemy);
      setVisibleLog([]);
      setOutcome(null);
      setChangeEnemySeconds(r.change_enemy_seconds ?? 300);
    } catch (e: any) {
      Alert.alert("Failed", e.message);
    }
  };

  if (!user || loading) return <View style={styles.loading}><ActivityIndicator color={COLORS.primary} size="large" /></View>;

  const weaponLabel = mainWeapon?.name ?? "Bare Hands";
  const maxHp = user.max_hp + (totals?.hp_bonus ?? 0);
  const maxMana = user.max_mana + (totals?.mana_bonus ?? 0);
  const canAct = !busy && !outcome;

  const renderHome = () => (
    <View style={styles.homeNoScroll}>
      <Text style={styles.title}>BATTLE</Text>
      <Text style={styles.subtitle}>Quick goals or fixed adventure nodes</Text>

      <View style={styles.compactTeaser}>
        <Text style={styles.sectionTitle}>CHOOSE YOUR PATH</Text>
        <Text style={styles.goalHint}>Quick Hunt is for fast daily battles. Adventure is fixed progression.</Text>
      </View>

      <View style={styles.modeGridCompact}>
        <TouchableOpacity style={styles.modeCardCompact} onPress={startQuick} disabled={busy}>
          <Text style={styles.modeIconSmall}>⚔️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.modeTitleSmall}>Quick Hunt</Text>
            <Text style={styles.modeTextSmall}>Scaled enemies · modest rewards</Text>
            <Text style={styles.modeSmall}>Quick Hunt Tier {user.difficulty_tier ?? tier}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.modeCardCompact} onPress={() => setMode("adventure")} disabled={busy}>
          <Text style={styles.modeIconSmall}>🗺️</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.modeTitleSmall}>Adventure</Text>
            <Text style={styles.modeTextSmall}>Static nodes · boss rewards</Text>
            <Text style={styles.modeSmall}>Adventure Tier {adventure?.progress?.tier ?? adventure?.tier ?? 1} · Node {adventure?.progress?.current_node ?? 1}</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderAdventure = () => {
    const mapNodes = adventure?.nodes ?? [];
    const mapNode = (num: number) => mapNodes.find((n: any) => Number(n.node) === num);
    const mapHeight = Math.round(width * (1445 / 768));
    // Percent coordinates are centered on the actual baked node circles in whisperwood-map.png.
    // Keep the visual highlight tightly around the number circle only; tap targets are larger and invisible.
    const nodeZones: Record<number, { x: number; y: number; tapSize?: number; ringSize?: number }> = {
      1: { x: 37.2, y: 4.6, tapSize: 14, ringSize: 42 },
      2: { x: 73.6, y: 11.5, tapSize: 14, ringSize: 42 },
      3: { x: 46.9, y: 20.1, tapSize: 14, ringSize: 42 },
      4: { x: 79.3, y: 29.1, tapSize: 14, ringSize: 42 },
      5: { x: 54.8, y: 41.9, tapSize: 17, ringSize: 54 },
      6: { x: 31.6, y: 54.1, tapSize: 14, ringSize: 42 },
      7: { x: 74.7, y: 64.6, tapSize: 14, ringSize: 42 },
      8: { x: 41.1, y: 73.8, tapSize: 14, ringSize: 42 },
      9: { x: 82.1, y: 81.1, tapSize: 14, ringSize: 42 },
      10: { x: 51.7, y: 92.0, tapSize: 18, ringSize: 62 },
    };

    return (
      <ScrollView contentContainerStyle={styles.mapScroll}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setMode("home")}><Text style={styles.backText}>← Battle Menu</Text></TouchableOpacity>
        <View style={styles.mapHeader}>
          <Text style={styles.title}>Tier {adventure?.progress?.tier ?? adventure?.tier ?? 1} · {adventure?.name ?? "Whisperwood Forest"}</Text>
          <Text style={styles.subtitle}>{adventure?.subtitle ?? "Ancient roots. Faded magic. Hidden dangers."}</Text>
        </View>

        <ImageBackground source={WHISPERWOOD_MAP} resizeMode="cover" style={[styles.premiumMap, { width, height: mapHeight }]}>
          {Object.entries(nodeZones).map(([nodeNum, pos]) => {
            const node = mapNode(Number(nodeNum));
            const nodeNumber = Number(nodeNum);
            const unlocked = Boolean(node?.unlocked ?? nodeNumber === 1);
            const completed = Boolean(node?.completed);
            const expectedCurrent = Number(adventure?.progress?.current_node ?? ((adventure?.progress?.highest_node ?? 0) + 1));
            const current = Boolean(node?.current) || (!completed && nodeNumber === expectedCurrent);
            const tapPct = pos.tapSize ?? 14;
            const centerX = (width * pos.x) / 100;
            const centerY = (mapHeight * pos.y) / 100;
            const ringSize = pos.ringSize ?? 42;
            const tapW = (width * tapPct) / 100;
            const tapH = (mapHeight * tapPct) / 100;
            const canStart = current && unlocked && !completed && !busy;
            return (
              <View key={nodeNum} pointerEvents="box-none">
                {current && (
                  <View
                    pointerEvents="none"
                    style={[
                      styles.currentNodeRing,
                      nodeNumber === 5 && styles.currentMiniRing,
                      nodeNumber === 10 && styles.currentBossRing,
                      { left: centerX - ringSize / 2, top: centerY - ringSize / 2, width: ringSize, height: ringSize, borderRadius: ringSize / 2 },
                    ]}
                  />
                )}
                <TouchableOpacity
                  disabled={!canStart}
                  activeOpacity={0.72}
                  onPress={() => startAdventure(nodeNumber)}
                  style={[
                    styles.premiumNodeTap,
                    {
                      left: centerX - tapW / 2,
                      top: centerY - tapH / 2,
                      width: tapW,
                      height: tapH,
                    },
                  ]}
                />
              </View>
            );
          })}
        </ImageBackground>
      </ScrollView>
    );
  };

  const renderFight = () => (
    <View style={styles.fightWrap}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => { setMode("home"); setEnemy(null); setOutcome(null); }}><Text style={styles.backText}>← Menu</Text></TouchableOpacity>
        <Text style={styles.modeBadge}>{battleMode === "adventure" ? `Adventure Node ${activeNode}` : `Quick Hunt · Tier ${tier}`}</Text>
      </View>
      <View style={styles.enemyCard}>
        <View style={styles.enemyHeader}>
          <View style={styles.enemyPortraitWrap}>
            {enemyPortraitSource(enemy?.portrait) ? (
              <Image source={enemyPortraitSource(enemy?.portrait)!} style={styles.enemyPortrait} />
            ) : (
              <Text style={styles.enemyPortraitFallback}>☠️</Text>
            )}
          </View>
          <View style={{ flex: 1 }}>
            <View style={styles.rowBetween}>
              <Text style={styles.enemyName}>{enemy?.name ?? "Enemy"}</Text>
              <Text style={styles.enemyTags}>{enemy?.class_chips?.map((c) => `${c.icon} ${c.label}`).join("  ")}</Text>
            </View>
            <View style={styles.hpTrack}><View style={[styles.hpFill, { width: `${hpPct(enemy)}%` }]} /></View>
            <Text style={styles.enemyHp}>HP {Math.max(0, enemy?.hp ?? 0)}/{enemy?.max_hp ?? 0}</Text>
          </View>
        </View>
      </View>

      <View style={styles.heroCard}>
        <View><Text style={styles.heroName}>{user.username}</Text><Text style={styles.heroClass}>{classState?.primary?.icon} {classState?.primary?.label}</Text></View>
        <View><Text style={styles.heroVitals}>HP {user.hp}/{maxHp}</Text><Text style={styles.heroVitals}>Mana {user.mana}/{maxMana}</Text></View>
      </View>

      <View style={styles.feedBox}>
        <Text style={styles.feedTitle}>BATTLE FEED</Text>
        {visibleLog.length === 0 ? <Text style={styles.emptyFeed}>Choose one action.</Text> : visibleLog.map((l, idx) => <Text key={idx} style={[styles.logLine, l.side === "player" ? styles.playerLog : styles.enemyLog]}>• {l.msg}</Text>)}
      </View>

      {outcome ? (
        <View style={[styles.outcome, outcome.win ? styles.victory : styles.defeat]}>
          <Text style={styles.outcomeTitle}>{outcome.escaped ? "ESCAPED" : outcome.win ? "VICTORY" : "DEFEAT"}</Text>
          <Text style={styles.outcomeText}>+{outcome.rewards.xp} XP · +{outcome.rewards.gold} gold</Text>
          {outcome.rewards.item && <Text style={styles.outcomeText}>{itemIcon(outcome.rewards.item)} {outcome.rewards.item.name}</Text>}
          <TouchableOpacity
            style={styles.continueBtn}
            onPress={async () => {
              setOutcome(null);
              setEnemy(null);
              await loadHome();
              setMode(battleMode === "adventure" ? "adventure" : "home");
            }}
          >
            <Text style={styles.continueText}>{battleMode === "adventure" ? "RETURN TO MAP" : "CONTINUE"}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.actions}>
          <TouchableOpacity disabled={!canAct} style={styles.actionBtn} onPress={() => runAction("weapon")}><Text style={styles.actionIcon}>{itemIcon(mainWeapon)}</Text><Text style={styles.actionTitle}>{weaponLabel}</Text><Text style={styles.actionSub}>Weapon attack</Text></TouchableOpacity>
          <TouchableOpacity disabled={!canAct} style={styles.actionBtn} onPress={() => setSkillMenuOpen(true)}><Text style={styles.actionIcon}>✨</Text><Text style={styles.actionTitle}>Skill</Text><Text style={styles.actionSub}>Choose learned skill</Text></TouchableOpacity>
          <TouchableOpacity disabled={!canAct} style={styles.actionBtn} onPress={openItemMenu}><Text style={styles.actionIcon}>🧪</Text><Text style={styles.actionTitle}>Item</Text><Text style={styles.actionSub}>Use consumable</Text></TouchableOpacity>
          <TouchableOpacity disabled={!canAct} style={styles.actionBtn} onPress={() => runAction("flee")}><Text style={styles.actionIcon}>🏃</Text><Text style={styles.actionTitle}>Flee</Text><Text style={styles.actionSub}>Mobility check</Text></TouchableOpacity>
          {battleMode !== "adventure" && <TouchableOpacity disabled={changeEnemySeconds > 0 || busy} style={styles.smallUtility} onPress={changeEnemy}><Text style={styles.utilityText}>↻ Change Enemy {changeEnemySeconds > 0 ? fmt(changeEnemySeconds) : ""}</Text></TouchableOpacity>}
        </View>
      )}

      <Modal visible={skillMenuOpen} transparent animationType="fade" onRequestClose={() => setSkillMenuOpen(false)}>
        <View style={styles.modalShade}><View style={styles.menuModal}><Text style={styles.modalTitle}>SKILLS</Text>{skills.map((s) => <View key={s.id} style={styles.skillRow}><TouchableOpacity style={styles.skillMain} onPress={() => runAction("skill", s)}><Text style={styles.skillName}>{s.icon} {s.name} {s.warning ? "⚠" : ""}</Text><Text style={styles.skillSub}>{s.mp_cost} Mana · {s.status_text} · {s.penalty_text}</Text></TouchableOpacity><TouchableOpacity onPress={() => setSkillInfo(s)}><Text style={styles.infoBtn}>ⓘ</Text></TouchableOpacity></View>)}<TouchableOpacity onPress={() => setSkillMenuOpen(false)}><Text style={styles.closeText}>CLOSE</Text></TouchableOpacity></View></View>
      </Modal>
      <Modal visible={!!skillInfo} transparent animationType="fade" onRequestClose={() => setSkillInfo(null)}><View style={styles.modalShade}><View style={styles.menuModal}><Text style={styles.modalTitle}>{skillInfo?.icon} {skillInfo?.name}</Text><Text style={styles.skillInfo}>{skillInfo?.description}</Text><Text style={styles.skillInfo}>Affinity: {skillInfo?.affinity_percent}% · {skillInfo?.status_text}</Text><Text style={styles.skillInfo}>{skillInfo?.penalty_text}</Text><TouchableOpacity onPress={() => setSkillInfo(null)}><Text style={styles.closeText}>CLOSE</Text></TouchableOpacity></View></View></Modal>
      <Modal visible={itemMenuOpen} transparent animationType="fade" onRequestClose={() => setItemMenuOpen(false)}><View style={styles.modalShade}><View style={styles.menuModal}><Text style={styles.modalTitle}>ITEMS</Text>{consumables.map((it) => <TouchableOpacity key={it.id} style={styles.itemRow} onPress={() => runAction("item", undefined, it)}><Text style={styles.skillName}>{itemIcon(it)} {it.name}</Text><Text style={styles.skillSub}>+{it.hp || 0} HP · +{it.mana || 0} Mana</Text></TouchableOpacity>)}<TouchableOpacity onPress={() => setItemMenuOpen(false)}><Text style={styles.closeText}>CLOSE</Text></TouchableOpacity></View></View></Modal>
    </View>
  );

  return (
    <ImageBackground source={{ uri: IMAGES.bgMystical }} style={styles.bg}>
      <LinearGradient colors={["rgba(10,12,16,0.82)", "rgba(10,12,16,0.98)"]} style={StyleSheet.absoluteFill} />
      <View style={styles.screen}>{mode === "adventure" ? renderAdventure() : mode === "fight" ? renderFight() : renderHome()}</View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 }, screen: { flex: 1, paddingTop: 50 }, loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.bg },
  homeNoScroll: { flex: 1, padding: 20, paddingBottom: 90, justifyContent: "center" }, title: { color: "#fff", fontSize: 30, fontWeight: "900", letterSpacing: 4 }, subtitle: { color: COLORS.textMuted, marginTop: 6, marginBottom: 16 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }, sectionTitle: { color: COLORS.textPrimary, fontWeight: "900", letterSpacing: 2 }, gemText: { color: COLORS.accent, fontWeight: "900" },
  mapTeaserCard: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 18, padding: 14, backgroundColor: "rgba(0,229,255,0.055)", marginBottom: 14 }, goalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }, goalText: { color: COLORS.textSecondary, fontWeight: "700" }, doneText: { color: COLORS.secondary }, goalCount: { color: COLORS.textMuted }, goalHint: { color: COLORS.textMuted, marginTop: 8, fontSize: 12 },
  modeGridCompact: { gap: 10 }, compactTeaser: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 12, backgroundColor: "rgba(0,229,255,0.045)", marginBottom: 12 }, modeCardCompact: { borderWidth: 1, borderColor: COLORS.borderStrong, borderRadius: 18, padding: 12, backgroundColor: "rgba(128,40,220,0.14)", flexDirection: "row", alignItems: "center", gap: 12, minHeight: 102 }, modeIconSmall: { fontSize: 28 }, modeTitleSmall: { color: "#fff", fontSize: 18, fontWeight: "900" }, modeTextSmall: { color: COLORS.textSecondary, marginTop: 4, fontSize: 12 }, modeGrid: { gap: 12 }, modeCard: { borderWidth: 1, borderColor: COLORS.borderStrong, borderRadius: 20, padding: 16, backgroundColor: "rgba(128,40,220,0.14)" }, modeIcon: { fontSize: 34 }, modeTitle: { color: "#fff", fontSize: 21, fontWeight: "900", marginTop: 8 }, modeText: { color: COLORS.textSecondary, marginTop: 6, lineHeight: 20 }, modeSmall: { color: COLORS.secondary, fontWeight: "800", marginTop: 10 },
  backBtn: { marginHorizontal: 20, marginBottom: 8 },
  backText: { color: COLORS.secondary, fontWeight: "900" },
  mapScroll: { paddingBottom: 0 },
  mapHeader: { paddingHorizontal: 20, marginBottom: 8 },
  forestMap: {
    height: 1500,
    margin: 18,
    borderRadius: 30,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(104,211,145,0.45)",
    backgroundColor: "#06140f",
    shadowColor: "#68D391",
    shadowOpacity: 0.26,
    shadowRadius: 26,
    elevation: 10,
  },
  mapVignette: { position: "absolute", left: -60, right: -60, top: -40, bottom: -40, borderRadius: 80, borderWidth: 42, borderColor: "rgba(0,0,0,0.26)" },
  canopyA: { position: "absolute", top: 42, left: -32, width: 245, height: 170, borderRadius: 95, backgroundColor: "rgba(37,93,58,0.30)" },
  canopyB: { position: "absolute", top: 90, right: -45, width: 270, height: 190, borderRadius: 105, backgroundColor: "rgba(33,84,55,0.24)" },
  canopyC: { position: "absolute", top: 760, left: -55, width: 210, height: 185, borderRadius: 100, backgroundColor: "rgba(36,88,76,0.20)" },
  mistA: { position: "absolute", top: 245, left: 18, width: 170, height: 120, borderRadius: 70, backgroundColor: "rgba(140,210,190,0.08)" },
  mistB: { position: "absolute", top: 1060, right: 12, width: 190, height: 120, borderRadius: 75, backgroundColor: "rgba(156,122,234,0.08)" },
  ancientTrunk: { position: "absolute", top: 150, left: "46%", width: 82, height: 510, borderRadius: 46, backgroundColor: "rgba(47,34,22,0.82)", transform: [{ rotate: "5deg" }], borderWidth: 1, borderColor: "rgba(251,211,141,0.12)" },
  ancientTrunkGlow: { position: "absolute", top: 170, left: "49%", width: 8, height: 430, borderRadius: 999, backgroundColor: "rgba(104,211,145,0.08)", transform: [{ rotate: "5deg" }] },
  rootA: { position: "absolute", top: 450, left: "27%", width: 180, height: 18, borderRadius: 20, backgroundColor: "rgba(58,39,25,0.58)", transform: [{ rotate: "-28deg" }] },
  rootB: { position: "absolute", top: 600, left: "36%", width: 210, height: 20, borderRadius: 20, backgroundColor: "rgba(58,39,25,0.56)", transform: [{ rotate: "28deg" }] },
  rootC: { position: "absolute", top: 785, left: "14%", width: 230, height: 18, borderRadius: 20, backgroundColor: "rgba(58,39,25,0.42)", transform: [{ rotate: "-12deg" }] },
  miniBossGrove: { position: "absolute", top: 610, left: "35%", width: 170, height: 150, borderRadius: 70, backgroundColor: "rgba(63,38,24,0.68)", borderWidth: 1, borderColor: "rgba(255,170,70,0.26)" },
  groveIcon: { position: "absolute", top: 635, left: "49%", marginLeft: -18, fontSize: 34, opacity: 0.58 },
  boulderA: { position: "absolute", top: 355, left: "18%", width: 92, height: 62, borderRadius: 32, backgroundColor: "rgba(125,140,155,0.16)", transform: [{ rotate: "-12deg" }] },
  boulderB: { position: "absolute", top: 905, right: "12%", width: 116, height: 82, borderRadius: 42, backgroundColor: "rgba(125,140,155,0.13)", transform: [{ rotate: "9deg" }] },
  boulderC: { position: "absolute", top: 1230, left: "10%", width: 128, height: 78, borderRadius: 44, backgroundColor: "rgba(125,140,155,0.12)" },
  forestRunesA: { position: "absolute", top: 305, right: 44, color: "rgba(0,229,255,0.20)", fontSize: 18 },
  forestRunesB: { position: "absolute", top: 790, left: 44, color: "rgba(104,211,145,0.18)", fontSize: 20 },
  forestRunesC: { position: "absolute", top: 1180, right: 74, color: "rgba(159,122,234,0.18)", fontSize: 20 },
  trailStone: { position: "absolute", backgroundColor: "rgba(152,118,75,0.78)", borderWidth: 1, borderColor: "rgba(246,214,158,0.22)", shadowColor: "#F6D69E", shadowOpacity: 0.14, shadowRadius: 4 },
  trailStoneComplete: { backgroundColor: "rgba(102,172,112,0.78)", borderColor: "rgba(165,255,190,0.34)", shadowColor: COLORS.secondary, shadowOpacity: 0.22 },
  trailFirefly: { position: "absolute", width: 5, height: 5, borderRadius: 999, backgroundColor: "rgba(0,229,255,0.30)", shadowColor: COLORS.primary, shadowOpacity: 0.65, shadowRadius: 7 },
  node: { position: "absolute", marginLeft: -42, width: 84, minHeight: 70, borderRadius: 20, borderWidth: 2, backgroundColor: "rgba(10,12,16,0.90)", alignItems: "center", justifyContent: "center", padding: 6, shadowColor: "#000", shadowOpacity: 0.38, shadowRadius: 12 },
  miniNode: { width: 96, minHeight: 84, marginLeft: -48, backgroundColor: "rgba(72,47,25,0.93)", borderColor: "rgba(255,170,70,0.62)" },
  bossNode: { width: 116, minHeight: 96, marginLeft: -58, backgroundColor: "rgba(80,20,30,0.94)" },
  lockedNode: { opacity: 0.35 },
  nodeNum: { color: "#fff", fontSize: 20, fontWeight: "900" },
  nodeLabel: { color: COLORS.textSecondary, fontSize: 10, textAlign: "center", marginTop: 3 },

  premiumMap: {
    alignSelf: "center",
    backgroundColor: "#06140f",
  },
  premiumNodeTap: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(0,229,255,0.001)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 20,
  },
  currentNodeRing: {
    position: "absolute",
    borderWidth: 3,
    borderColor: COLORS.primary,
    backgroundColor: "transparent",
    shadowColor: COLORS.primary,
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 18,
  },
  currentMiniRing: { borderColor: "#B779FF", backgroundColor: "transparent", shadowColor: "#B779FF" },
  currentBossRing: { borderColor: "#FF6B6B", backgroundColor: "transparent", shadowColor: "#FF6B6B" },
  fightWrap: { flex: 1, padding: 14, gap: 10 }, topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, modeBadge: { color: COLORS.textMuted, fontWeight: "900" }, enemyHeader: { flexDirection: "row", gap: 10, alignItems: "center" }, enemyPortraitWrap: { width: 54, height: 54, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: COLORS.borderStrong, backgroundColor: "rgba(0,0,0,0.35)", alignItems: "center", justifyContent: "center" }, enemyPortrait: { width: "100%", height: "100%" }, enemyPortraitFallback: { fontSize: 26 }, enemyCard: { borderWidth: 1, borderColor: COLORS.borderStrong, borderRadius: 18, padding: 12, backgroundColor: "rgba(255,255,255,0.06)" }, enemyName: { color: "#fff", fontSize: 20, fontWeight: "900" }, enemyTags: { color: COLORS.textSecondary, fontSize: 11, flexShrink: 1, textAlign: "right" }, hpTrack: { height: 10, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 999, overflow: "hidden", marginTop: 10 }, hpFill: { height: "100%", backgroundColor: COLORS.danger }, enemyHp: { color: COLORS.textMuted, marginTop: 4, textAlign: "right" },
  heroCard: { flexDirection: "row", justifyContent: "space-between", borderWidth: 1, borderColor: "rgba(0,229,255,0.35)", borderRadius: 18, padding: 12, backgroundColor: "rgba(0,229,255,0.07)" }, heroName: { color: "#fff", fontWeight: "900", fontSize: 18 }, heroClass: { color: COLORS.textSecondary, marginTop: 4 }, heroVitals: { color: COLORS.textSecondary, textAlign: "right", fontWeight: "800" },
  feedBox: { minHeight: 118, borderWidth: 1, borderColor: COLORS.border, borderRadius: 16, padding: 12, backgroundColor: "rgba(0,0,0,0.32)" }, feedTitle: { color: "#fff", fontWeight: "900", letterSpacing: 2, marginBottom: 6 }, emptyFeed: { color: COLORS.textMuted }, logLine: { fontSize: 13, marginVertical: 2 }, playerLog: { color: COLORS.secondary }, enemyLog: { color: "#FF7A7A" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, actionBtn: { width: "48%", borderRadius: 18, padding: 12, backgroundColor: "rgba(128,40,220,0.30)", borderWidth: 1, borderColor: COLORS.borderStrong }, actionIcon: { fontSize: 24 }, actionTitle: { color: "#fff", fontWeight: "900", fontSize: 15, marginTop: 4 }, actionSub: { color: COLORS.textMuted, fontSize: 11, marginTop: 2 }, smallUtility: { width: "100%", borderWidth: 1, borderColor: COLORS.border, borderRadius: 14, padding: 10, alignItems: "center" }, utilityText: { color: COLORS.textSecondary, fontWeight: "800" },
  outcome: { borderWidth: 2, borderRadius: 18, padding: 18, alignItems: "center", backgroundColor: "rgba(0,0,0,0.35)" }, victory: { borderColor: COLORS.success }, defeat: { borderColor: COLORS.danger }, outcomeTitle: { color: "#fff", fontSize: 24, fontWeight: "900", letterSpacing: 4 }, outcomeText: { color: COLORS.textSecondary, marginTop: 8, fontWeight: "800" }, continueBtn: { marginTop: 14, backgroundColor: COLORS.primary, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 14 }, continueText: { color: "#fff", fontWeight: "900", letterSpacing: 2 },
  modalShade: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", alignItems: "center", justifyContent: "center", padding: 20 }, menuModal: { width: "100%", borderRadius: 22, borderWidth: 1, borderColor: COLORS.borderStrong, backgroundColor: COLORS.surface, padding: 18 }, modalTitle: { color: "#fff", fontSize: 20, fontWeight: "900", letterSpacing: 2, marginBottom: 10 }, skillRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 10 }, skillMain: { flex: 1 }, skillName: { color: "#fff", fontWeight: "900" }, skillSub: { color: COLORS.textMuted, marginTop: 3, fontSize: 12 }, infoBtn: { color: COLORS.secondary, fontSize: 24, paddingHorizontal: 8 }, skillInfo: { color: COLORS.textSecondary, marginVertical: 5, lineHeight: 20 }, itemRow: { paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: COLORS.border }, closeText: { color: COLORS.secondary, textAlign: "center", marginTop: 16, fontWeight: "900", letterSpacing: 2 },
});
