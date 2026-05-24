import { useMemo, useState } from "react";
import {
  ImageBackground,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  TERRAIN,
  calculateAttackTiles,
  calculateLegalMoveTiles,
  canMoveUnitTo,
  cityStreetAmbushScenario,
  getTerrain,
  getTerrainKey,
  getUnitAt,
  isBattleDefeat,
  isBattleVictory,
  moveUnit,
  resetAllyMovement,
  resolveAttack,
} from "../../src/battle";

const scenario = cityStreetAmbushScenario;
const GRID_COLS = scenario.map.cols;
const GRID_ROWS = scenario.map.rows;
export default function BattleLabScreen() {
  const [units, setUnits] = useState(() => scenario.units.map((unit) => ({ ...unit, actionState: unit.side === "ally" ? "ready" : unit.actionState })));
  const [selectedId, setSelectedId] = useState("hero_plain_clothes");
  const [battleLog, setBattleLog] = useState<string[]>(["Battle Lab v54: select Hero, move on blue tiles, then attack enemies on red tiles."]);
  const selected = units.find((unit) => unit.id === selectedId && !unit.defeated) || units.find((unit) => !unit.defeated) || units[0];
  const battleState = isBattleVictory(units) ? "victory" : isBattleDefeat(units) ? "defeat" : "active";

  const moveCostPreview = useMemo(() => calculateLegalMoveTiles(scenario.map, selected, units), [selected, units]);
  const movePreview = useMemo(() => new Set(moveCostPreview.keys()), [moveCostPreview]);
  const attackPreview = useMemo(() => calculateAttackTiles(scenario.map, selected), [selected]);
  const selectedTerrain = getTerrain(scenario.map, selected.x, selected.y);

  function pushLog(message: string) {
    setBattleLog((items) => [message, ...items].slice(0, 6));
  }

  function handleTilePress(x: number, y: number) {
    const occupant = getUnitAt(units, x, y);
    if (occupant) {
      if (occupant.defeated) return;
      if (selected && selected.side === "ally" && occupant.side === "enemy") {
        const result = resolveAttack(scenario.map, units, selected.id, occupant.id);
        setUnits(result.units);
        result.log.reverse().forEach(pushLog);
        return;
      }
      setSelectedId(occupant.id);
      pushLog(`Selected ${occupant.name}.`);
      return;
    }

    if (!selected || battleState !== "active") return;
    if (canMoveUnitTo(scenario.map, selected, units, { x, y })) {
      setUnits((current) => moveUnit(current, selected.id, { x, y }));
      pushLog(`${selected.name} moved to (${x + 1}, ${y + 1}).`);
      return;
    }

    pushLog(`${selected.name} cannot move to (${x + 1}, ${y + 1}).`);
  }

  function resetBattleLab() {
    setUnits(scenario.units.map((unit) => ({ ...unit, actionState: unit.side === "ally" ? "ready" : unit.actionState })));
    setSelectedId("hero_plain_clothes");
    setBattleLog(["Battle reset. Select Hero, move on blue tiles, then attack enemies on red tiles."]);
  }

  function refreshAllyMovement() {
    setUnits((current) => resetAllyMovement(current));
    pushLog("Ally movement refreshed for testing.");
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>DEV ONLY • Battle Test Lab</Text>
          <Text style={styles.title}>{scenario.title}</Text>
          <Text style={styles.subtitle}>{scenario.map.subtitle}</Text>
        </View>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.mapPanel}>
          <ImageBackground
            source={require("../../assets/images/battle/first_battle_map.png")}
            style={styles.mapImage}
            imageStyle={styles.mapImageRounded}
            resizeMode="cover"
          >
            <View style={styles.gridLayer}>
              {Array.from({ length: GRID_ROWS }).map((_, y) => (
                <View key={`row-${y}`} style={styles.gridRow}>
                  {Array.from({ length: GRID_COLS }).map((__, x) => {
                    const key = `${x},${y}`;
                    const terrain = getTerrainKey(scenario.map, x, y);
                    return (
                      <TouchableOpacity
                        key={key}
                        activeOpacity={0.8}
                        onPress={() => handleTilePress(x, y)}
                        style={[
                          styles.gridCell,
                          terrain === "wall" && styles.blockedCell,
                          attackPreview.has(key) && styles.attackCell,
                          movePreview.has(key) && styles.moveCell,
                        ]}
                      >
                        {moveCostPreview.has(key) && terrain !== "wall" ? (
                          <Text style={styles.moveCostText}>{moveCostPreview.get(key)}</Text>
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </View>

            {units.map((unit) => (
              <TouchableOpacity
                key={unit.id}
                activeOpacity={0.9}
                onPress={() => { if (unit.defeated) return; setSelectedId(unit.id); pushLog(`Selected ${unit.name}.`); }}
                style={[
                  styles.unitToken,
                  {
                    left: `${((unit.x + 0.5) / GRID_COLS) * 100}%`,
                    top: `${((unit.y + 0.48) / GRID_ROWS) * 100}%`,
                  },
                  unit.side === "ally" && styles.allyUnit,
                  unit.side === "enemy" && styles.enemyUnit,
                  unit.side === "neutral" && styles.neutralUnit,
                  selectedId === unit.id && styles.selectedUnit,
                  unit.hasMoved && styles.movedUnit,
                  unit.defeated && styles.defeatedUnit,
                ]}
              >
                <Text style={styles.unitEmoji}>{unit.defeated ? "☠️" : unit.side === "ally" ? "🧍" : unit.side === "enemy" ? "⚔️" : "🧒"}</Text>
                <Text style={styles.unitLabel}>{unit.name}</Text>
                <View style={styles.tokenHpTrack}><View style={[styles.tokenHpFill, { width: `${Math.max(0, Math.min(100, (unit.hp / unit.maxHp) * 100))}%` }]} /></View>
              </TouchableOpacity>
            ))}
          </ImageBackground>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Selected Unit</Text>
            <Text style={styles.unitName}>{selected.name}</Text>
            <Text style={styles.meta}>{selected.role}</Text>
            <View style={styles.hpTrack}><View style={[styles.hpFill, { width: `${Math.max(0, Math.min(100, (selected.hp / selected.maxHp) * 100))}%` }]} /></View>
            <Text style={styles.stat}>HP: {selected.hp}/{selected.maxHp}</Text>
            <Text style={styles.stat}>Move: {selected.move} • Range: {selected.range}</Text>
            <Text style={styles.stat}>ATK: {selected.attack} • DEF: {selected.defense}</Text>
            <Text style={styles.stat}>State: {selected.defeated ? "Defeated" : selected.hasAttacked ? "Attacked" : selected.hasMoved ? "Moved" : selected.canAct ? "Ready" : "Waiting"}</Text>
            {selected.note ? <Text style={styles.note}>{selected.note}</Text> : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Battle Status</Text>
            <Text style={styles.unitName}>{battleState === "victory" ? "Victory" : battleState === "defeat" ? "Defeat" : "Active Skirmish"}</Text>
            <Text style={styles.note}>Tap an enemy in a red tile while an ally is selected to attack. Terrain defense modifies damage. Adjacent enemies can counterattack.</Text>
            <Text style={styles.stat}>Enemies left: {units.filter((unit) => unit.side === "enemy" && !unit.defeated).length}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Current Terrain</Text>
            <Text style={styles.unitName}>{selectedTerrain.label}</Text>
            <Text style={styles.stat}>Move Cost: {selectedTerrain.moveCost >= 99 ? "Blocked" : selectedTerrain.moveCost}</Text>
            <Text style={styles.stat}>DEF Modifier: {selectedTerrain.defenseBonusPct > 0 ? "+" : ""}{selectedTerrain.defenseBonusPct}%</Text>
            <Text style={styles.note}>Movement is terrain-aware. Blue tiles are legal destinations. Occupied tiles and walls cannot be entered.</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Battle 001 Story</Text>
            <Text style={styles.note}>A child tricks the hero, steals his money, then hides behind local thugs. The child is visible but cannot move, attack, or be targeted.</Text>
            <Text style={styles.note}>Victory: {scenario.victoryCondition}</Text>
            <Text style={styles.note}>Defeat: {scenario.defeatCondition}</Text>
          </View>
        </View>

        <View style={styles.battleControls}>
          <TouchableOpacity style={styles.controlButton} onPress={refreshAllyMovement}>
            <Text style={styles.controlButtonText}>Refresh Movement</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.controlButton, styles.resetButton]} onPress={resetBattleLab}>
            <Text style={styles.controlButtonText}>Reset Battle Lab</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.legendPanel}>
          <Text style={styles.cardTitle}>Battle Log</Text>
          {battleLog.map((item, index) => (
            <Text key={`${item}-${index}`} style={styles.logLine}>✦ {item}</Text>
          ))}
        </View>

        <View style={styles.legendPanel}>
          <Text style={styles.cardTitle}>Terrain Legend</Text>
          {Object.values(TERRAIN).map((tile) => (
            <View key={tile.key} style={styles.legendRow}>
              <Text style={styles.legendName}>{tile.label}</Text>
              <Text style={styles.legendText}>Move {tile.moveCost >= 99 ? "Blocked" : tile.moveCost} • DEF {tile.defenseBonusPct > 0 ? "+" : ""}{tile.defenseBonusPct}%</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#080511" },
  header: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(245,197,95,0.28)",
    backgroundColor: "rgba(19,9,35,0.96)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  kicker: { color: "#C4B5FD", fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  title: { color: "#FFF1B8", fontSize: 22, fontWeight: "900", marginTop: 3 },
  subtitle: { color: "#D6C9B3", fontSize: 12, fontWeight: "700", marginTop: 4 },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "rgba(124,58,237,0.32)",
    borderWidth: 1,
    borderColor: "rgba(216,180,254,0.65)",
  },
  backButtonText: { color: "#FFF7D6", fontSize: 13, fontWeight: "900" },
  body: { padding: 14, gap: 14 },
  mapPanel: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(245,197,95,0.45)",
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  mapImage: { width: "100%", aspectRatio: 16 / 9, minHeight: 390 },
  mapImageRounded: { borderRadius: 22 },
  gridLayer: { ...StyleSheet.absoluteFillObject },
  gridRow: { flex: 1, flexDirection: "row" },
  gridCell: {
    flex: 1,
    borderWidth: 0.7,
    borderColor: "rgba(255,255,255,0.42)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  moveCell: { backgroundColor: "rgba(59,130,246,0.22)" },
  moveCostText: { color: "rgba(219,234,254,0.95)", fontSize: 9, fontWeight: "900", textAlign: "center", marginTop: 2 },
  attackCell: { backgroundColor: "rgba(239,68,68,0.25)" },
  blockedCell: { backgroundColor: "rgba(15,23,42,0.24)" },
  unitToken: {
    position: "absolute",
    transform: [{ translateX: -42 }, { translateY: -36 }],
    minWidth: 84,
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderWidth: 2,
  },
  allyUnit: { backgroundColor: "rgba(59,130,246,0.50)", borderColor: "rgba(147,197,253,0.98)" },
  enemyUnit: { backgroundColor: "rgba(220,38,38,0.50)", borderColor: "rgba(252,165,165,0.98)" },
  neutralUnit: { backgroundColor: "rgba(245,158,11,0.48)", borderColor: "rgba(253,230,138,0.98)" },
  selectedUnit: { borderColor: "#FFF1B8", shadowColor: "#FACC15", shadowOpacity: 0.7, shadowRadius: 10 },
  movedUnit: { opacity: 0.72 },
  defeatedUnit: { opacity: 0.42 },
  unitEmoji: { fontSize: 20 },
  unitLabel: { color: "white", fontSize: 10, fontWeight: "900", textAlign: "center" },
  tokenHpTrack: { width: 58, height: 5, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(0,0,0,0.45)", marginTop: 3 },
  tokenHpFill: { height: "100%", backgroundColor: "#22C55E" },
  hpTrack: { height: 9, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(0,0,0,0.45)", marginTop: 10 },
  hpFill: { height: "100%", backgroundColor: "#22C55E" },
  infoGrid: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  card: {
    flex: 1,
    minWidth: 240,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(245,197,95,0.36)",
    backgroundColor: "rgba(15,11,24,0.92)",
  },
  cardTitle: { color: "#FFE7A3", fontSize: 14, fontWeight: "900", marginBottom: 8 },
  unitName: { color: "#FFFFFF", fontSize: 18, fontWeight: "900" },
  meta: { color: "#C4B5FD", fontSize: 12, fontWeight: "800", marginTop: 3 },
  stat: { color: "#F5E6C8", fontSize: 13, fontWeight: "800", marginTop: 6 },
  note: { color: "#CDBFA9", fontSize: 12, fontWeight: "700", lineHeight: 17, marginTop: 8 },
  battleControls: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  controlButton: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(147,197,253,0.75)",
    backgroundColor: "rgba(37,99,235,0.36)",
  },
  resetButton: { borderColor: "rgba(252,165,165,0.75)", backgroundColor: "rgba(127,29,29,0.45)" },
  controlButtonText: { color: "#FFF7D6", fontSize: 13, fontWeight: "900" },
  legendPanel: {
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(245,197,95,0.36)",
    backgroundColor: "rgba(15,11,24,0.92)",
  },
  logLine: { color: "#F5E6C8", fontSize: 12, fontWeight: "800", lineHeight: 18, marginTop: 4 },
  legendRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  legendName: { color: "#FFF1B8", fontSize: 12, fontWeight: "900" },
  legendText: { color: "#D6C9B3", fontSize: 12, fontWeight: "700" },
});
