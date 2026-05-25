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
  allLivingAlliesDone,
  calculateAttackTiles,
  calculateLegalMoveTiles,
  canMoveUnitTo,
  cityStreetAmbushScenario,
  getBattleOutcome,
  getTerrain,
  getTerrainKey,
  getUnitAt,
  moveUnit,
  phaseLabel,
  resolveAttack,
  resolveSkillUse,
  getSkillsForUnit,
  getSkillCooldown,
  skillRangeText,
  buildCombatPreview,
  hpPct,
  terrainBonusText,
  unitActionLabel,
  runEnemyPhase,
  startEnemyPhase,
  startPlayerPhase,
  buildBattleResult,
  battleResultSummary,
  runBattleQa,
  formatBattleQaIssues,
} from "../../src/battle";
import type { BattlePhase, BattleUnit } from "../../src/battle";

const scenario = cityStreetAmbushScenario;
const GRID_COLS = scenario.map.cols;
const GRID_ROWS = scenario.map.rows;

function freshUnits(): BattleUnit[] {
  return startPlayerPhase(scenario.units.map((unit) => ({ ...unit })));
}

function manhattanDistanceLocal(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function buildRangeTilesForUnit(cols: number, rows: number, unit: BattleUnit | undefined, minRange: number, maxRange: number) {
  const tiles = new Set<string>();
  if (!unit) return tiles;
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const distance = manhattanDistanceLocal(unit, { x, y });
      if (distance >= minRange && distance <= maxRange) tiles.add(`${x},${y}`);
    }
  }
  return tiles;
}

export default function BattleLabScreen() {
  const [units, setUnits] = useState<BattleUnit[]>(freshUnits);
  const [phase, setPhase] = useState<BattlePhase>("player");
  const [turnNumber, setTurnNumber] = useState(1);
  const [selectedId, setSelectedId] = useState("hero_plain_clothes");
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [previewTargetId, setPreviewTargetId] = useState<string | null>(null);
  const [battleLog, setBattleLog] = useState<string[]>([
    "Battle Lab v65: QA cleanup, retry flow, and story-return foundation are active.",
  ]);
  const [showGrid, setShowGrid] = useState(false);
  const [showMoveCosts, setShowMoveCosts] = useState(false);
  const [actionMode, setActionMode] = useState<"move" | "attack">("move");

  const outcome = getBattleOutcome(units);
  const battleResult = buildBattleResult(units);
  const effectivePhase: BattlePhase = outcome === "victory" ? "victory" : outcome === "defeat" ? "defeat" : phase;
  const selected = units.find((unit) => unit.id === selectedId && !unit.defeated) || units.find((unit) => !unit.defeated) || units[0];
  const canUseSelected = effectivePhase === "player" && selected?.side === "ally" && selected?.canAct && !selected?.hasAttacked;

  const moveCostPreview = useMemo(
    () => (canUseSelected ? calculateLegalMoveTiles(scenario.map, selected, units) : new Map<string, number>()),
    [canUseSelected, selected, units],
  );
  const movePreview = useMemo(() => new Set(moveCostPreview.keys()), [moveCostPreview]);
  const selectedTerrain = getTerrain(scenario.map, selected.x, selected.y);
  const selectedSkills = selected ? getSkillsForUnit(selected) : [];
  const selectedSkill = selectedSkillId ? selectedSkills.find((skill) => skill.id === selectedSkillId) : undefined;
  const normalAttackPreview = useMemo(
    () => (canUseSelected ? calculateAttackTiles(scenario.map, selected) : new Set<string>()),
    [canUseSelected, selected],
  );
  const skillTargetPreview = useMemo(
    () =>
      canUseSelected && selectedSkill
        ? buildRangeTilesForUnit(GRID_COLS, GRID_ROWS, selected, selectedSkill.rangeMin ?? 0, selectedSkill.range)
        : new Set<string>(),
    [canUseSelected, selected, selectedSkill],
  );
  const activeAttackPreview = selectedSkill ? skillTargetPreview : actionMode === "attack" ? normalAttackPreview : new Set<string>();
  const activeMovePreview = actionMode === "move" && !selectedSkill ? movePreview : new Set<string>();
  const attackableEnemyIds = useMemo(() => {
    if (!selected || effectivePhase !== "player" || selected.side !== "ally") return new Set<string>();
    return new Set(
      units
        .filter((unit) => {
          if (unit.defeated || unit.side === "neutral") return false;
          const inRange = activeAttackPreview.has(`${unit.x},${unit.y}`);
          if (!inRange) return false;
          if (selectedSkill?.target === "ally") return unit.side === "ally";
          if (selectedSkill?.target === "self") return unit.id === selected.id;
          return unit.side === "enemy";
        })
        .map((unit) => unit.id),
    );
  }, [activeAttackPreview, effectivePhase, selected, selectedSkill, units]);
  const previewTarget =
    units.find((unit) => unit.id === previewTargetId && !unit.defeated) ||
    units.find((unit) => attackableEnemyIds.has(unit.id));
  const combatPreview = buildCombatPreview(scenario.map, selected, previewTarget, selectedSkill);
  const livingEnemies = units.filter((unit) => unit.side === "enemy" && !unit.defeated).length;
  const livingAllies = units.filter((unit) => unit.side === "ally" && !unit.defeated).length;

  function pushLog(message: string) {
    setBattleLog((items) => [message, ...items].slice(0, 10));
  }

  function pushLogs(messages: string[]) {
    setBattleLog((items) => [...messages.slice().reverse(), ...items].slice(0, 10));
  }

  function selectUnit(unit: BattleUnit) {
    if (unit.defeated) return;
    setSelectedId(unit.id);
    setSelectedSkillId(null);
    setPreviewTargetId(null);
    setActionMode("move");
    pushLog(`Selected ${unit.name}.`);
  }

  function selectNextReadyAlly(nextUnits: BattleUnit[]) {
    const ready = nextUnits.find((unit) => unit.side === "ally" && !unit.defeated && unit.canAct && !unit.hasAttacked);
    if (ready) setSelectedId(ready.id);
  }

  function maybeAutoEndPlayerPhase(nextUnits: BattleUnit[]) {
    if (allLivingAlliesDone(nextUnits) && getBattleOutcome(nextUnits) === "active") {
      pushLog("All ready allies have acted. Press End Turn to let the thugs move.");
    }
  }

  function handleTilePress(x: number, y: number) {
    const occupant = getUnitAt(units, x, y);
    if (occupant) {
      if (occupant.defeated) return;
      if (effectivePhase === "player" && selected?.side === "ally" && occupant.side === "enemy") {
        setPreviewTargetId(occupant.id);
      }
      if (effectivePhase === "player" && selected?.side === "ally" && occupant.side !== "neutral") {
        if (selectedSkillId) {
          const result = resolveSkillUse(scenario.map, units, selected.id, occupant.id, selectedSkillId);
          setUnits(result.units);
          pushLogs(result.log);
          if (result.ok) {
            setSelectedSkillId(null);
            setPreviewTargetId(null);
            maybeAutoEndPlayerPhase(result.units);
            selectNextReadyAlly(result.units);
          }
          return;
        }

        if (occupant.side === "enemy") {
          const result = resolveAttack(scenario.map, units, selected.id, occupant.id);
          setUnits(result.units);
          pushLogs(result.log);
          maybeAutoEndPlayerPhase(result.units);
          selectNextReadyAlly(result.units);
          return;
        }
      }
      selectUnit(occupant);
      return;
    }

    if (!selected || effectivePhase !== "player") return;
    if (canMoveUnitTo(scenario.map, selected, units, { x, y })) {
      const nextUnits = moveUnit(units, selected.id, { x, y });
      setUnits(nextUnits);
      setSelectedSkillId(null);
      setPreviewTargetId(null);
      pushLog(`${selected.name} moved to (${x + 1}, ${y + 1}).`);
      return;
    }

    pushLog(`${selected.name} cannot move to (${x + 1}, ${y + 1}).`);
  }

  function endPlayerTurn() {
    if (effectivePhase !== "player") return;
    const enemyReady = startEnemyPhase(units);
    setPhase("enemy");
    pushLog("Player phase ended.");

    const result = runEnemyPhase(scenario.map, enemyReady);
    const outcomeAfterEnemy = getBattleOutcome(result.units);
    if (outcomeAfterEnemy === "victory") {
      setUnits(result.units);
      setPhase("victory");
      pushLogs(result.log);
      return;
    }
    if (outcomeAfterEnemy === "defeat") {
      setUnits(result.units);
      setPhase("defeat");
      pushLogs(result.log);
      return;
    }

    const nextPlayerUnits = startPlayerPhase(result.units);
    setUnits(nextPlayerUnits);
    setPhase("player");
    setTurnNumber((current) => current + 1);
    selectNextReadyAlly(nextPlayerUnits);
    pushLogs([...result.log, `Turn ${turnNumber + 1}: player phase started.`]);
  }

  function resetBattleLab() {
    setUnits(freshUnits());
    setPhase("player");
    setTurnNumber(1);
    setSelectedId("hero_plain_clothes");
    setSelectedSkillId(null);
    setPreviewTargetId(null);
    setBattleLog(["Battle reset. Player phase started."]);
  }

  function retryBattle() {
    resetBattleLab();
  }

  function runQaCheck() {
    const issues = runBattleQa(scenario, units);
    pushLogs(formatBattleQaIssues(issues));
  }

  function returnToGameFoundation() {
    const summary = battleResultSummary(battleResult);
    pushLog(`${summary} Story return hook is ready for future integration.`);
    router.back();
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.kicker}>DEV ONLY • Tactical Battle Lab</Text>
          <Text style={styles.title}>{scenario.title}</Text>
          <Text style={styles.subtitle}>{scenario.map.subtitle}</Text>
        </View>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={[styles.phaseBanner, effectivePhase === "enemy" && styles.enemyPhase, effectivePhase === "victory" && styles.victoryPhase, effectivePhase === "defeat" && styles.defeatPhase]}>
          <View>
            <Text style={styles.phaseTitle}>{phaseLabel(effectivePhase)}</Text>
            <Text style={styles.phaseSub}>Turn {turnNumber} • Allies {livingAllies} • Thugs {livingEnemies}</Text>
          </View>
          {effectivePhase === "player" ? (
            <TouchableOpacity style={styles.endTurnButton} onPress={endPlayerTurn}>
              <Text style={styles.endTurnText}>End Turn</Text>
            </TouchableOpacity>
          ) : null}
          {effectivePhase === "victory" || effectivePhase === "defeat" ? (
            <TouchableOpacity style={styles.endTurnButton} onPress={retryBattle}>
              <Text style={styles.endTurnText}>Retry Battle</Text>
            </TouchableOpacity>
          ) : null}
        </View>


        {effectivePhase === "victory" || effectivePhase === "defeat" ? (
          <View style={[styles.card, styles.resultCard]}>
            <Text style={styles.cardTitle}>{battleResult.title}</Text>
            <Text style={styles.note}>{battleResult.message}</Text>
            <Text style={styles.stat}>Defeated enemies: {battleResult.defeatedEnemies}</Text>
            <Text style={styles.stat}>Surviving allies: {battleResult.survivingAllies}</Text>
            <View style={styles.resultActions}>
              <TouchableOpacity style={styles.controlButton} onPress={retryBattle}>
                <Text style={styles.controlButtonText}>Retry Battle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.controlButton, styles.returnButton]} onPress={returnToGameFoundation}>
                <Text style={styles.controlButtonText}>Return to Game</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <View style={styles.tacticalToggles}>
          <TouchableOpacity
            style={[styles.toggleButton, showGrid && styles.toggleButtonActive]}
            onPress={() => setShowGrid((value) => !value)}
          >
            <Text style={styles.toggleButtonText}>{showGrid ? "Grid On" : "Grid Off"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, showMoveCosts && styles.toggleButtonActive]}
            onPress={() => setShowMoveCosts((value) => !value)}
          >
            <Text style={styles.toggleButtonText}>{showMoveCosts ? "Move Cost On" : "Move Cost Off"}</Text>
          </TouchableOpacity>
          <Text style={styles.overlayHelp}>Grid is optional. Green = movement. Red = normal attack or selected skill targeting. Attackable targets glow red.</Text>
        </View>

        <View style={styles.actionTray}>
          <TouchableOpacity
            style={[styles.actionButton, actionMode === "move" && !selectedSkillId && styles.actionButtonActive]}
            disabled={!canUseSelected}
            onPress={() => {
              setSelectedSkillId(null);
              setActionMode("move");
              pushLog(`${selected.name}: movement overlay selected.`);
            }}
          >
            <Text style={styles.actionButtonIcon}>🟩</Text>
            <Text style={styles.actionButtonText}>Move</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, actionMode === "attack" && !selectedSkillId && styles.actionButtonActive]}
            disabled={!canUseSelected}
            onPress={() => {
              setSelectedSkillId(null);
              setActionMode("attack");
              pushLog(`${selected.name}: normal attack overlay selected.`);
            }}
          >
            <Text style={styles.actionButtonIcon}>🟥</Text>
            <Text style={styles.actionButtonText}>Attack</Text>
          </TouchableOpacity>
          {selectedSkills.map((skill) => {
            const cooldown = getSkillCooldown(selected, skill.id);
            const disabled = effectivePhase !== "player" || selected.side !== "ally" || !selected.canAct || selected.hasAttacked || cooldown > 0;
            return (
              <TouchableOpacity
                key={`tray-${skill.id}`}
                disabled={disabled}
                style={[styles.actionButton, selectedSkillId === skill.id && styles.actionButtonActive, disabled && styles.actionButtonDisabled]}
                onPress={() => {
                  const nextSkillId = selectedSkillId === skill.id ? null : skill.id;
                  setSelectedSkillId(nextSkillId);
                  setActionMode(nextSkillId ? "attack" : "move");
                  pushLog(nextSkillId ? `${selected.name}: ${skill.name} targeting selected.` : `${selected.name}: ${skill.name} cancelled.`);
                }}
              >
                <Text style={styles.actionButtonIcon}>{cooldown > 0 ? cooldown : skill.kind === "heal" ? "✚" : "✦"}</Text>
                <Text style={styles.actionButtonText}>{skill.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

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
                          showGrid && styles.gridCellVisible,
                          terrain === "wall" && styles.blockedCell,
                          activeMovePreview.has(key) && styles.moveCell,
                          activeAttackPreview.has(key) && styles.attackCell,
                        ]}
                      >
                        {showMoveCosts && moveCostPreview.has(key) ? (
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
                onPress={() => selectUnit(unit)}
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
                  unit.actionState === "done" && styles.doneUnit,
                  attackableEnemyIds.has(unit.id) && styles.targetableUnit,
                  previewTargetId === unit.id && styles.previewTargetUnit,
                  unit.hasMoved && !unit.hasAttacked && styles.movedUnit,
                  unit.defeated && styles.defeatedUnit,
                ]}
              >
                <Text style={styles.unitEmoji}>{unit.defeated ? "☠️" : unit.side === "ally" ? "🧍" : unit.side === "enemy" ? "⚔️" : "🧒"}</Text>
                <Text style={styles.unitLabel}>{unit.name}</Text>
                <View style={styles.tokenHpTrack}><View style={[styles.tokenHpFill, { width: `${Math.max(0, Math.min(100, (unit.hp / unit.maxHp) * 100))}%` }]} /></View>
                {unit.side !== "neutral" && !unit.defeated ? <Text style={styles.actBadge}>{unitActionLabel(unit).toUpperCase()}</Text> : null}
              </TouchableOpacity>
            ))}
          </ImageBackground>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Selected Unit</Text>
            <Text style={styles.unitName}>{selected.name}</Text>
            <Text style={styles.meta}>{selected.role}</Text>
            <View style={styles.hpTrack}><View style={[styles.hpFill, { width: `${hpPct(selected)}%` }]} /></View>
            <Text style={styles.stat}>HP: {selected.hp}/{selected.maxHp}</Text>
            <Text style={styles.stat}>Move: {selected.move} • Range: {selected.range}</Text>
            <Text style={styles.stat}>ATK: {selected.attack} • DEF: {selected.defense}</Text>
            <Text style={styles.stat}>State: {unitActionLabel(selected)}</Text>
            {selected.note ? <Text style={styles.note}>{selected.note}</Text> : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Combat Preview</Text>
            {combatPreview ? (
              <View>
                <Text style={styles.unitName}>{combatPreview.actionName}</Text>
                <Text style={styles.meta}>{combatPreview.attackerName} → {combatPreview.targetName}</Text>
                <Text style={styles.stat}>Damage: {combatPreview.expectedDamage}</Text>
                <Text style={styles.stat}>Target HP after: {combatPreview.targetHpAfter}</Text>
                <Text style={styles.stat}>Counter: {combatPreview.expectedCounterDamage > 0 ? combatPreview.expectedCounterDamage : "None"}</Text>
                <Text style={styles.stat}>Target terrain: {combatPreview.targetTerrainLabel} ({combatPreview.targetTerrainDefenseBonusPct > 0 ? "+" : ""}{combatPreview.targetTerrainDefenseBonusPct}% DEF)</Text>
                {combatPreview.targetWillFall ? <Text style={styles.warningText}>This attack should defeat the target.</Text> : null}
              </View>
            ) : (
              <Text style={styles.note}>Select a ready ally, then tap an enemy in range to preview damage and counters.</Text>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Skills + Cooldowns</Text>
            <Text style={styles.note}>Select a skill, then tap a valid target. Cooldowns tick down at the start of that unit side's phase.</Text>
            {selectedSkills.map((skill) => {
              const cooldown = getSkillCooldown(selected, skill.id);
              const disabled = effectivePhase !== "player" || selected.side !== "ally" || !selected.canAct || selected.hasAttacked || cooldown > 0;
              return (
                <TouchableOpacity
                  key={skill.id}
                  disabled={disabled}
                  onPress={() => {
                    const nextSkillId = selectedSkillId === skill.id ? null : skill.id;
                    setSelectedSkillId(nextSkillId);
                    setActionMode(nextSkillId ? "attack" : "move");
                    pushLog(nextSkillId ? `${selected.name} readied ${skill.name}.` : `${selected.name} lowered ${skill.name}.`);
                  }}
                  style={[styles.skillButton, selectedSkillId === skill.id && styles.skillButtonActive, disabled && styles.skillButtonDisabled]}
                >
                  <Text style={styles.skillName}>{skill.name}</Text>
                  <Text style={styles.skillMeta}>Range {skillRangeText(skill)} • CD {skill.cooldown}{cooldown > 0 ? ` • Ready in ${cooldown}` : ""}</Text>
                  <Text style={styles.skillDesc}>{skill.description}</Text>
                </TouchableOpacity>
              );
            })}
            {selectedSkill ? <Text style={styles.note}>Readied: {selectedSkill.name}. Tap a valid {selectedSkill.target} target.</Text> : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Battle Status</Text>
            <Text style={styles.unitName}>{effectivePhase === "victory" ? "Victory" : effectivePhase === "defeat" ? "Defeat" : phaseLabel(effectivePhase)}</Text>
            <Text style={styles.note}>Player phase: move/attack with the hero, then end turn. Enemy phase: thugs attack if possible, otherwise move toward the hero.</Text>
            <Text style={styles.stat}>Enemies left: {livingEnemies}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Current Terrain</Text>
            <Text style={styles.unitName}>{selectedTerrain.label}</Text>
            <Text style={styles.stat}>Move Cost: {selectedTerrain.moveCost >= 99 ? "Blocked" : selectedTerrain.moveCost}</Text>
            <Text style={styles.stat}>DEF Modifier: {selectedTerrain.defenseBonusPct > 0 ? "+" : ""}{selectedTerrain.defenseBonusPct}%</Text>
            <Text style={styles.note}>Blue tiles are legal movement. Red tiles are normal attack or selected skill range. The base grid is hidden unless Grid On is enabled.</Text>
            <Text style={styles.note}>Terrain: {terrainBonusText(selectedTerrain)}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Battle 001 Story</Text>
            <Text style={styles.note}>A child tricks the hero, steals his money, then hides behind local thugs. The child is visible but cannot move, attack, or be targeted.</Text>
            <Text style={styles.note}>Victory: {scenario.victoryCondition}</Text>
            <Text style={styles.note}>Defeat: {scenario.defeatCondition}</Text>
          </View>
        </View>

        <View style={styles.battleControls}>
          <TouchableOpacity style={[styles.controlButton, styles.resetButton]} onPress={resetBattleLab}>
            <Text style={styles.controlButtonText}>Reset Battle Lab</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton} onPress={runQaCheck}>
            <Text style={styles.controlButtonText}>Run Battle QA Check</Text>
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
  headerText: { flex: 1 },
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
  phaseBanner: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(147,197,253,0.68)",
    backgroundColor: "rgba(37,99,235,0.32)",
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  enemyPhase: { borderColor: "rgba(252,165,165,0.75)", backgroundColor: "rgba(127,29,29,0.42)" },
  victoryPhase: { borderColor: "rgba(52,211,153,0.75)", backgroundColor: "rgba(6,95,70,0.42)" },
  defeatPhase: { borderColor: "rgba(251,113,133,0.75)", backgroundColor: "rgba(127,29,29,0.58)" },
  phaseTitle: { color: "#FFF7D6", fontSize: 20, fontWeight: "900" },
  phaseSub: { color: "#E9D5FF", fontSize: 12, fontWeight: "800", marginTop: 3 },
  endTurnButton: {
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.75)",
    backgroundColor: "rgba(120,53,15,0.46)",
  },
  endTurnText: { color: "#FFF7D6", fontSize: 13, fontWeight: "900" },
  tacticalToggles: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(245,197,95,0.32)",
    backgroundColor: "rgba(15,11,24,0.86)",
  },
  toggleButton: {
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(245,197,95,0.48)",
    backgroundColor: "rgba(0,0,0,0.28)",
  },
  toggleButtonActive: {
    borderColor: "rgba(134,239,172,0.8)",
    backgroundColor: "rgba(22,101,52,0.42)",
  },
  toggleButtonText: { color: "#FFF7D6", fontSize: 12, fontWeight: "900" },
  overlayHelp: { color: "#D6C9B3", fontSize: 11, fontWeight: "800", flex: 1, minWidth: 220 },
  actionTray: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    alignItems: "center",
    justifyContent: "flex-end",
    padding: 10,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(245,197,95,0.34)",
    backgroundColor: "rgba(15,11,24,0.9)",
  },
  actionButton: {
    minWidth: 82,
    minHeight: 58,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(245,197,95,0.45)",
    backgroundColor: "rgba(35,19,59,0.82)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonActive: {
    borderColor: "rgba(216,180,254,0.95)",
    backgroundColor: "rgba(109,40,217,0.72)",
  },
  actionButtonDisabled: { opacity: 0.42 },
  actionButtonIcon: { color: "#FFF1B8", fontSize: 18, fontWeight: "900" },
  actionButtonText: { color: "#FFF7D6", fontSize: 10, fontWeight: "900", textAlign: "center", marginTop: 3 },
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
    borderColor: "transparent",
    backgroundColor: "transparent",
  },
  gridCellVisible: {
    borderColor: "rgba(255,255,255,0.38)",
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  moveCell: { backgroundColor: "rgba(34,197,94,0.28)", borderColor: "rgba(134,239,172,0.72)" },
  moveCostText: { color: "rgba(219,234,254,0.95)", fontSize: 9, fontWeight: "900", textAlign: "center", marginTop: 2 },
  attackCell: { backgroundColor: "rgba(239,68,68,0.30)", borderColor: "rgba(252,165,165,0.78)" },
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
  targetableUnit: { borderColor: "#FCA5A5", shadowColor: "#EF4444", shadowOpacity: 0.68, shadowRadius: 12 },
  previewTargetUnit: { borderColor: "#FACC15", shadowColor: "#FACC15", shadowOpacity: 0.9, shadowRadius: 14 },
  movedUnit: { opacity: 0.82 },
  doneUnit: { opacity: 0.58 },
  defeatedUnit: { opacity: 0.42 },
  unitEmoji: { fontSize: 20 },
  unitLabel: { color: "white", fontSize: 10, fontWeight: "900", textAlign: "center" },
  actBadge: { color: "#FFF7D6", fontSize: 8, fontWeight: "900", marginTop: 2 },
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
  warningText: { color: "#86EFAC", fontSize: 12, fontWeight: "900", marginTop: 8 },
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
  skillButton: {
    marginTop: 10,
    padding: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.45)",
    backgroundColor: "rgba(120,53,15,0.28)",
  },
  skillButtonActive: { borderColor: "rgba(52,211,153,0.9)", backgroundColor: "rgba(6,95,70,0.42)" },
  skillButtonDisabled: { opacity: 0.45 },
  skillName: { color: "#FFF1B8", fontSize: 13, fontWeight: "900" },
  skillMeta: { color: "#C4B5FD", fontSize: 11, fontWeight: "900", marginTop: 3 },
  skillDesc: { color: "#D6C9B3", fontSize: 11, fontWeight: "700", lineHeight: 15, marginTop: 4 },
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
