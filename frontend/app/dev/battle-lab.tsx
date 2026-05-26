import { useMemo, useRef, useState } from "react";
import {
  Image,
  ImageBackground,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { router } from "expo-router";
import {
  calculateAttackTiles,
  calculateLegalMoveTiles,
  canMoveUnitTo,
  cityStreetAmbushScenario,
  getBattleOutcome,
  getTerrain,
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
  buildEnemyThreatTiles,
  runBattleQa,
  formatBattleQaIssues,
  clampBattleCamera,
  resetBattleCamera,
  zoomBattleCamera,
  cityStreetAmbushGridMapping,
  getBattleTileRectStyle,
  getBattleUnitPositionStyle,
  battleMapCalibrationStatus,
  battleMapArtStatus,
} from "../../src/battle";
import type { BattlePhase, BattleUnit } from "../../src/battle";
import { getBattleUnitSprite } from "../../src/battle/unitAssets";

const scenario = cityStreetAmbushScenario;
const GRID_COLS = scenario.map.cols;
const GRID_ROWS = scenario.map.rows;
const MAP_IMAGE_WIDTH = 1536;
const MAP_IMAGE_HEIGHT = 1024;
const MAP_ASPECT = MAP_IMAGE_WIDTH / MAP_IMAGE_HEIGHT;
const GRID_MAPPING = cityStreetAmbushGridMapping;

function getUnitSprite(unit: BattleUnit) {
  return getBattleUnitSprite(unit);
}


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
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const [units, setUnits] = useState<BattleUnit[]>(freshUnits);
  const [phase, setPhase] = useState<BattlePhase>("player");
  const [turnNumber, setTurnNumber] = useState(1);
  const [selectedId, setSelectedId] = useState("hero_plain_clothes");
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [previewTargetId, setPreviewTargetId] = useState<string | null>(null);
  const [battleLog, setBattleLog] = useState<string[]>([
    "Battle Lab v77: dynamic actor sprites are separate from map art; final maps must contain environment only.",
  ]);
  const [showGrid, setShowGrid] = useState(false);
  const [showMoveCosts, setShowMoveCosts] = useState(false);
  const [showDangerZone, setShowDangerZone] = useState(false);
  const [hudCompact, setHudCompact] = useState(false);
  const [showBattleHelp, setShowBattleHelp] = useState(false);
  const [showCalibration, setShowCalibration] = useState(false);
  const [actionMode, setActionMode] = useState<"move" | "attack">("move");
  const [camera, setCamera] = useState(resetBattleCamera());
  const dragStart = useRef(resetBattleCamera());

  const mapSize = useMemo(() => {
    const coverWidth = Math.max(width, height * MAP_ASPECT);
    const coverHeight = coverWidth / MAP_ASPECT;
    return {
      width: coverWidth,
      height: coverHeight,
      left: (width - coverWidth) / 2,
      top: (height - coverHeight) / 2,
    };
  }, [width, height]);

  const cameraBounds = useMemo(
    () => ({ viewportWidth: width, viewportHeight: height, contentWidth: mapSize.width, contentHeight: mapSize.height }),
    [width, height, mapSize.width, mapSize.height],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6,
        onPanResponderGrant: () => {
          dragStart.current = camera;
        },
        onPanResponderMove: (_event, gesture) => {
          setCamera(
            clampBattleCamera(
              {
                x: dragStart.current.x + gesture.dx,
                y: dragStart.current.y + gesture.dy,
                zoom: dragStart.current.zoom,
              },
              { ...cameraBounds, zoom: dragStart.current.zoom },
            ),
          );
        },
      }),
    [camera, cameraBounds],
  );

  const outcome = getBattleOutcome(units);
  const battleResult = buildBattleResult(units);
  const effectivePhase: BattlePhase = outcome === "victory" ? "victory" : outcome === "defeat" ? "defeat" : phase;
  const selected = units.find((unit) => unit.id === selectedId && !unit.defeated) || units.find((unit) => !unit.defeated) || units[0];
  const canUseSelected = effectivePhase === "player" && selected?.side === "ally" && selected?.canAct && !selected?.hasAttacked;
  const isChoosingMovement = canUseSelected && actionMode === "move" && !selected?.hasMoved;
  const isChoosingAction = canUseSelected && Boolean(selected?.hasMoved) && !selected?.hasAttacked;

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
  const activeAttackPreview = isChoosingAction ? (selectedSkill ? skillTargetPreview : actionMode === "attack" ? normalAttackPreview : new Set<string>()) : new Set<string>();
  const activeMovePreview = isChoosingMovement && !selectedSkill ? movePreview : new Set<string>();
  const enemyThreatPreview = useMemo(
    () => (showDangerZone ? buildEnemyThreatTiles(scenario.map, units).threatTiles : new Set<string>()),
    [showDangerZone, units],
  );

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
    setBattleLog((items) => [message, ...items].slice(0, 8));
  }

  function pushLogs(messages: string[]) {
    setBattleLog((items) => [...messages.slice().reverse(), ...items].slice(0, 8));
  }

  function selectUnit(unit: BattleUnit) {
    if (unit.defeated) return;
    if (unit.side === "neutral") {
      pushLog(`${unit.name} is a non-combatant and cannot be controlled.`);
      return;
    }
    setSelectedId(unit.id);
    setSelectedSkillId(null);
    setPreviewTargetId(null);
    setActionMode(unit.side === "ally" && unit.canAct && !unit.hasMoved ? "move" : "attack");
    pushLog(unit.side === "ally" && unit.canAct && !unit.hasMoved ? `Selected ${unit.name}. Tap a blue tile to move.` : `Selected ${unit.name}.`);
  }

  function selectNextReadyAlly(nextUnits: BattleUnit[]) {
    const ready = nextUnits.find((unit) => unit.side === "ally" && !unit.defeated && unit.canAct && !unit.hasAttacked);
    if (ready) setSelectedId(ready.id);
  }

  function maybeAutoEndPlayerPhase(nextUnits: BattleUnit[]) {
    if (nextUnits.every((unit) => unit.side !== "ally" || unit.defeated || !unit.canAct) && getBattleOutcome(nextUnits) === "active") {
      pushLog("All allies are done. Tap End Round to let the thugs move.");
    }
  }

  function standSelectedUnit() {
    if (!selected || effectivePhase !== "player" || selected.side !== "ally" || !selected.canAct || !selected.hasMoved) return;
    const nextUnits = units.map((unit) =>
      unit.id === selected.id
        ? { ...unit, canAct: false, hasMoved: true, hasAttacked: true, actionState: "done" as const }
        : unit,
    );
    setUnits(nextUnits);
    setSelectedSkillId(null);
    setPreviewTargetId(null);
    pushLog(`${selected.name} stood by and ended the action.`);
    maybeAutoEndPlayerPhase(nextUnits);
    selectNextReadyAlly(nextUnits);
  }

  function handleTilePress(x: number, y: number) {
    const occupant = getUnitAt(units, x, y);
    if (occupant) {
      if (occupant.defeated) return;

      if (effectivePhase === "player" && selected?.side === "ally" && isChoosingAction && selectedSkillId) {
        const selectedSkillDefinition = selectedSkills.find((skill) => skill.id === selectedSkillId);
        const targetKey = `${occupant.x},${occupant.y}`;
        const targetTypeMatches = selectedSkillDefinition?.target === "self"
          ? occupant.id === selected.id
          : selectedSkillDefinition?.target === "ally"
            ? occupant.side === "ally"
            : occupant.side === "enemy";
        if (selectedSkillDefinition && activeAttackPreview.has(targetKey) && targetTypeMatches) {
          setPreviewTargetId(occupant.id);
          const result = resolveSkillUse(scenario.map, units, selected.id, occupant.id, selectedSkillId);
          setUnits(result.units);
          pushLogs(result.log);
          if (result.ok) {
            setSelectedSkillId(null);
            setPreviewTargetId(null);
            setActionMode("move");
            maybeAutoEndPlayerPhase(result.units);
            selectNextReadyAlly(result.units);
          }
          return;
        }
        pushLog(`${occupant.name} is not a valid target for ${selectedSkillDefinition?.name ?? "that skill"}.`);
        return;
      }

      if (effectivePhase === "player" && selected?.side === "ally" && occupant.side === "enemy") {
        setPreviewTargetId(occupant.id);
        if (actionMode === "attack" && attackableEnemyIds.has(occupant.id)) {
          const result = resolveAttack(scenario.map, units, selected.id, occupant.id);
          setUnits(result.units);
          pushLogs(result.log);
          setPreviewTargetId(null);
          setActionMode("move");
          maybeAutoEndPlayerPhase(result.units);
          selectNextReadyAlly(result.units);
          return;
        }
        pushLog(`${occupant.name} is out of range for the selected action.`);
        return;
      }
      selectUnit(occupant);
      return;
    }

    if (!selected || effectivePhase !== "player") return;
    if (isChoosingMovement && canMoveUnitTo(scenario.map, selected, units, { x, y })) {
      const nextUnits = moveUnit(units, selected.id, { x, y });
      setUnits(nextUnits);
      setSelectedSkillId(null);
      setPreviewTargetId(null);
      setActionMode("attack");
      pushLog(`${selected.name} moved. Choose Attack, a skill, or Stand from the HUD.`);
      return;
    }

    pushLog(isChoosingMovement ? `${selected.name} cannot move there.` : "Choose Attack or a skill, then tap a highlighted target.");
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
    setActionMode("move");
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
    setActionMode("move");
    setCamera(resetBattleCamera());
    setBattleLog(["Battle reset. Tap Hero, choose a blue tile, then use Attack, Skills, or Stand from the action tray. Actors are runtime sprites, not part of the map image."]);
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

  function runBattleUxQa() {
    const messages = [
      isLandscape ? "UX QA: landscape layout active." : "UX QA: rotate device before battle testing.",
      showGrid ? "UX QA: runtime grid is visible by toggle." : "UX QA: runtime grid is hidden; movement/attack overlays still appear when relevant.",
      showDangerZone ? "UX QA: enemy danger zone overlay is visible." : "UX QA: enemy danger zone overlay is hidden.",
      `UX QA: camera zoom ${Math.round(camera.zoom * 100)}%, pan (${Math.round(camera.x)}, ${Math.round(camera.y)}).`,
      hudCompact ? "UX QA: compact HUD mode active." : "UX QA: full HUD mode active.",
      battleMapArtStatus(GRID_MAPPING),
    ];
    pushLogs(messages);
  }

  const mapScale = camera.zoom;
  const actionInstruction = !selected || selected.side !== "ally"
    ? "Select an ally to act."
    : !selected.canAct || selected.hasAttacked
      ? `${selected.name} has finished acting.`
      : !selected.hasMoved
        ? "Tap a blue movement tile."
        : selectedSkill
          ? `${selectedSkill.name}: tap a highlighted target.`
          : actionMode === "attack"
            ? "Attack selected: tap a red enemy target."
            : "Choose Attack, Skill, or Stand.";

  if (!isLandscape) {
    return (
      <View style={styles.rotateOnlyScreen}>
        <Text style={styles.rotateOnlyTitle}>Rotate for Tactical Battle</Text>
        <Text style={styles.rotateOnlyText}>Battle Lab is landscape-first so the map, tactical camera, and Langrisser-style HUD have room to work.</Text>
        <TouchableOpacity style={styles.resultButton} onPress={() => router.back()}>
          <Text style={styles.resultButtonText}>Back to Game</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {!isLandscape ? (
        <View style={styles.rotateNotice}>
          <Text style={styles.rotateText}>Rotate to landscape for the intended tactical battle layout.</Text>
        </View>
      ) : null}

      <View style={styles.battlefield} {...panResponder.panHandlers}>
        <View
          style={[
            styles.cameraLayer,
            {
              width: mapSize.width,
              height: mapSize.height,
              left: mapSize.left,
              top: mapSize.top,
              transform: [{ translateX: camera.x }, { translateY: camera.y }, { scale: mapScale }],
            },
          ]}
        >
          <ImageBackground
            source={require("../../assets/images/battle/first_battle_map.png")}
            style={styles.mapImageLayer}
            imageStyle={styles.battlefieldImage}
            resizeMode="cover"
          >
          <View style={styles.gridLayer}>
            {Array.from({ length: GRID_ROWS }).flatMap((_, y) =>
              Array.from({ length: GRID_COLS }).map((__, x) => {
                const key = `${x},${y}`;
                return (
                  <TouchableOpacity
                    key={key}
                    activeOpacity={0.85}
                    onPress={() => handleTilePress(x, y)}
                    style={[
                      styles.gridCell,
                      getBattleTileRectStyle(GRID_MAPPING, x, y),
                      showGrid && styles.gridCellVisible,
                      showDangerZone && enemyThreatPreview.has(key) && styles.dangerCell,
                      activeMovePreview.has(key) && styles.moveCell,
                      activeAttackPreview.has(key) && styles.attackCell,
                    ]}
                  >
                    {showCalibration ? (
                      <Text style={styles.moveCostText}>{x},{y}</Text>
                    ) : showMoveCosts && moveCostPreview.has(key) ? (
                      <Text style={styles.moveCostText}>{moveCostPreview.get(key)}</Text>
                    ) : null}
                  </TouchableOpacity>
                );
              }),
            )}
          </View>

          {units.map((unit) => (
            <TouchableOpacity
              key={unit.id}
              activeOpacity={0.9}
              onPress={() => selectUnit(unit)}
              style={[
                styles.unitToken,
                getBattleUnitPositionStyle(GRID_MAPPING, unit.x, unit.y),
                unit.side === "ally" && styles.allyUnit,
                unit.side === "enemy" && styles.enemyUnit,
                unit.side === "neutral" && styles.neutralUnit,
                selectedId === unit.id && styles.selectedUnit,
                unit.actionState === "done" && styles.doneUnit,
                attackableEnemyIds.has(unit.id) && styles.targetableUnit,
                previewTargetId === unit.id && styles.previewTargetUnit,
                unit.defeated && styles.defeatedUnit,
              ]}
            >
              {unit.defeated ? (
                <Text style={styles.unitDefeatedIcon}>☠️</Text>
              ) : (
                <Image source={getUnitSprite(unit)} style={styles.unitSpriteImage} resizeMode="contain" />
              )}
              <Text style={styles.unitLabel}>{unit.name}</Text>
              <View style={styles.tokenHpTrack}><View style={[styles.tokenHpFill, { width: `${Math.max(0, Math.min(100, (unit.hp / unit.maxHp) * 100))}%` }]} /></View>
            </TouchableOpacity>
          ))}

          </ImageBackground>
        </View>
      </View>

      <View style={[styles.topLeftHud, hudCompact && styles.topLeftHudCompact]}>
        <Text style={styles.kicker}>DEV ONLY • Battle 001</Text>
        <Text style={styles.unitName}>{selected.name}</Text>
        <Text style={styles.meta}>{selected.role}</Text>
        <View style={styles.hpTrack}><View style={[styles.hpFill, { width: `${hpPct(selected)}%` }]} /></View>
        <Text style={styles.stat}>HP {selected.hp}/{selected.maxHp} • ATK {selected.attack} • DEF {selected.defense}</Text>
        {!hudCompact ? (
          <>
            <Text style={styles.stat}>Terrain: {selectedTerrain.label} ({terrainBonusText(selectedTerrain)})</Text>
            <Text style={styles.flowHint}>{selected.side !== "ally" ? "Enemy selected" : selected.hasAttacked || !selected.canAct ? "Action finished" : selected.hasMoved ? "Choose Attack, Skill, or Stand" : "Tap a blue tile to move"}</Text>
          </>
        ) : null}
      </View>

      <View style={styles.topRightHud}>
        <TouchableOpacity style={styles.smallButton} onPress={() => setShowGrid((value) => !value)}>
          <Text style={styles.smallButtonText}>{showGrid ? "Grid On" : "Grid Off"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.smallButton, showDangerZone && styles.smallButtonActive]} onPress={() => setShowDangerZone((value) => !value)}>
          <Text style={styles.smallButtonText}>{showDangerZone ? "Danger On" : "Danger Off"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.smallButton} onPress={() => setCamera(resetBattleCamera())}>
          <Text style={styles.smallButtonText}>Fit View</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.smallButton} onPress={() => setCamera((current) => zoomBattleCamera(current, 0.15, cameraBounds))}>
          <Text style={styles.smallButtonText}>Zoom +</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.smallButton} onPress={() => setCamera((current) => zoomBattleCamera(current, -0.15, cameraBounds))}>
          <Text style={styles.smallButtonText}>Zoom -</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.smallButton} onPress={() => setHudCompact((value) => !value)}>
          <Text style={styles.smallButtonText}>{hudCompact ? "HUD Full" : "HUD Compact"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.smallButton} onPress={() => setShowBattleHelp((value) => !value)}>
          <Text style={styles.smallButtonText}>Help</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.smallButton} onPress={runBattleUxQa}>
          <Text style={styles.smallButtonText}>UX QA</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.smallButton} onPress={runQaCheck}>
          <Text style={styles.smallButtonText}>Data QA</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomLeftHud}>
        <TouchableOpacity style={styles.roundButton} onPress={endPlayerTurn}>
          <Text style={styles.roundButtonText}>End Round</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.roundButton} onPress={() => setShowMoveCosts((value) => !value)}>
          <Text style={styles.roundButtonText}>{showMoveCosts ? "Cost On" : "Cost Off"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.roundButton} onPress={() => setShowCalibration((value) => !value)}>
          <Text style={styles.roundButtonText}>{showCalibration ? "XY On" : "XY Off"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.roundButton} onPress={resetBattleLab}>
          <Text style={styles.roundButtonText}>Retry</Text>
        </TouchableOpacity>
      </View>

      {isChoosingAction ? (
        <View style={[styles.actionDock, hudCompact && styles.actionDockCompact]}>
          {!hudCompact ? (
            <View style={styles.actionDockHeader}>
              <Text style={styles.actionDockTitle}>Actions</Text>
              <Text style={styles.actionDockHint}>{actionInstruction}</Text>
            </View>
          ) : null}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionButton, styles.attackButton, actionMode === "attack" && !selectedSkillId && styles.actionButtonActive]}
              disabled={!isChoosingAction}
              onPress={() => {
                setSelectedSkillId(null);
                setActionMode("attack");
                pushLog(`${selected.name}: normal attack selected. Tap a red target.`);
              }}
            >
              <Text style={styles.actionIcon}>⚔️</Text>
              <Text style={styles.actionText}>Attack</Text>
            </TouchableOpacity>
            {selectedSkills.slice(0, 3).map((skill) => {
              const cooldown = getSkillCooldown(selected, skill.id);
              const disabled = !isChoosingAction || cooldown > 0;
              return (
                <TouchableOpacity
                  key={`dock-${skill.id}`}
                  disabled={disabled}
                  style={[styles.actionButton, selectedSkillId === skill.id && styles.actionButtonActive, disabled && styles.actionButtonDisabled]}
                  onPress={() => {
                    const nextSkillId = selectedSkillId === skill.id ? null : skill.id;
                    setSelectedSkillId(nextSkillId);
                    setActionMode("attack");
                    pushLog(nextSkillId ? `${selected.name}: ${skill.name} selected. Tap a highlighted target.` : `${selected.name}: ${skill.name} cancelled.`);
                  }}
                >
                  {cooldown > 0 ? <Text style={styles.cooldownPip}>{cooldown}</Text> : null}
                  <Text style={styles.actionIcon}>{skill.kind === "heal" ? "✚" : "✦"}</Text>
                  <Text style={styles.actionText}>{skill.name}</Text>
                  <Text style={styles.actionSubText}>Rng {skillRangeText(skill)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <View style={styles.actionRowBottom}>
            <TouchableOpacity style={[styles.standButton]} disabled={!isChoosingAction} onPress={standSelectedUnit}>
              <Text style={styles.standButtonText}>Stand</Text>
            </TouchableOpacity>
            {(selectedSkillId || actionMode === "attack") ? (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setSelectedSkillId(null);
                  setPreviewTargetId(null);
                  setActionMode("attack");
                  pushLog(`${selected.name}: targeting reset.`);
                }}
              >
                <Text style={styles.cancelButtonText}>Clear Target</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      ) : null}

      {showBattleHelp ? (
        <View style={styles.helpHud}>
          <Text style={styles.helpTitle}>Battle Lab Controls</Text>
          <Text style={styles.helpText}>Tap an ally → blue tiles show valid movement.</Text>
          <Text style={styles.helpText}>Tap a blue tile → unit moves and the action tray opens.</Text>
          <Text style={styles.helpText}>Choose Attack/Skill → red targets show who can be hit.</Text>
          <Text style={styles.helpText}>Swipe one finger to pan. Use Fit View to reset the camera.</Text>
          <Text style={styles.helpText}>Current map art is reference-only; final maps must not contain dynamic actors, baked grids, labels, or unit bases.</Text>
        </View>
      ) : null}

      {combatPreview ? (
        <View style={styles.previewHud}>
          <Text style={styles.previewTitle}>{combatPreview.actionName}</Text>
          <Text style={styles.previewText}>{combatPreview.attackerName} → {combatPreview.targetName}</Text>
          <Text style={styles.previewText}>Damage {combatPreview.expectedDamage} • Counter {combatPreview.expectedCounterDamage > 0 ? combatPreview.expectedCounterDamage : "None"}</Text>
        </View>
      ) : null}

      <View style={styles.logHud}>
        <Text style={styles.phaseText}>{phaseLabel(effectivePhase)} • Turn {turnNumber} • Allies {livingAllies} • Thugs {livingEnemies}</Text>
        <Text style={styles.logText}>{battleLog[0]}</Text>
        <Text style={styles.cameraText}>Camera {Math.round(camera.zoom * 100)}% • tap unit → blue move → action HUD</Text>
        <Text style={styles.cameraText}>{battleMapCalibrationStatus(GRID_MAPPING)}</Text>
        <Text style={styles.cameraText}>{battleMapArtStatus(GRID_MAPPING)}</Text>
      </View>

      {effectivePhase === "victory" || effectivePhase === "defeat" ? (
        <View style={styles.resultOverlay}>
          <Text style={styles.resultTitle}>{battleResult.title}</Text>
          <Text style={styles.resultText}>{battleResult.message}</Text>
          <TouchableOpacity style={styles.resultButton} onPress={resetBattleLab}><Text style={styles.resultButtonText}>Retry Battle</Text></TouchableOpacity>
          <TouchableOpacity style={styles.resultButton} onPress={returnToGameFoundation}><Text style={styles.resultButtonText}>Return to Game</Text></TouchableOpacity>
        </View>
      ) : null}

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>Back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#05030A" },
  battlefield: { ...StyleSheet.absoluteFillObject, overflow: "hidden", backgroundColor: "#05030A" },
  battlefieldImage: { opacity: 1 },
  cameraLayer: { position: "absolute", overflow: "hidden" },
  mapImageLayer: { ...StyleSheet.absoluteFillObject },
  gridLayer: { ...StyleSheet.absoluteFillObject },
  gridRow: { flex: 1, flexDirection: "row" },
  gridCell: { position: "absolute", borderWidth: 0.6, borderColor: "transparent", backgroundColor: "transparent" },
  gridCellVisible: { borderColor: "rgba(255,255,255,0.38)", backgroundColor: "rgba(255,255,255,0.02)" },
  moveCell: { backgroundColor: "rgba(59,130,246,0.34)", borderColor: "rgba(147,197,253,0.88)" },
  dangerCell: { backgroundColor: "rgba(251,146,60,0.22)", borderColor: "rgba(251,146,60,0.55)" },
  attackCell: { backgroundColor: "rgba(239,68,68,0.35)", borderColor: "rgba(252,165,165,0.82)" },
  moveCostText: { color: "white", fontSize: 9, fontWeight: "900", textAlign: "center", marginTop: 2 },
  unitToken: {
    position: "absolute",
    transform: [{ translateX: -35 }, { translateY: -38 }],
    minWidth: 70,
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderWidth: 2,
  },
  allyUnit: { backgroundColor: "rgba(37,99,235,0.35)", borderColor: "rgba(147,197,253,0.98)" },
  enemyUnit: { backgroundColor: "rgba(220,38,38,0.38)", borderColor: "rgba(252,165,165,0.98)" },
  neutralUnit: { backgroundColor: "rgba(245,158,11,0.38)", borderColor: "rgba(253,230,138,0.98)" },
  selectedUnit: { borderColor: "#FFF1B8", shadowColor: "#FACC15", shadowOpacity: 0.8, shadowRadius: 12 },
  targetableUnit: { borderColor: "#FF6262", shadowColor: "#EF4444", shadowOpacity: 0.9, shadowRadius: 14 },
  previewTargetUnit: { borderColor: "#FACC15", shadowColor: "#FACC15", shadowOpacity: 0.9, shadowRadius: 14 },
  doneUnit: { opacity: 0.52 },
  defeatedUnit: { opacity: 0.32 },
  unitSpriteImage: { width: 50, height: 50 },
  unitDefeatedIcon: { fontSize: 24 },
  unitLabel: { color: "white", fontSize: 10, fontWeight: "900", textAlign: "center", textShadowColor: "black", textShadowRadius: 3 },
  tokenHpTrack: { width: 54, height: 5, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(0,0,0,0.55)", marginTop: 3 },
  tokenHpFill: { height: "100%", backgroundColor: "#22C55E" },
  topLeftHud: {
    position: "absolute", left: 14, top: 12, width: 250, padding: 12,
    borderRadius: 18, borderWidth: 1, borderColor: "rgba(245,197,95,0.58)", backgroundColor: "rgba(7,5,12,0.72)",
  },
  topLeftHudCompact: { width: 210, padding: 9 },
  kicker: { color: "#C4B5FD", fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  unitName: { color: "#FFFFFF", fontSize: 20, fontWeight: "900", marginTop: 3 },
  meta: { color: "#C4B5FD", fontSize: 11, fontWeight: "800", marginTop: 2 },
  hpTrack: { height: 8, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(0,0,0,0.52)", marginTop: 8 },
  hpFill: { height: "100%", backgroundColor: "#22C55E" },
  stat: { color: "#F5E6C8", fontSize: 11, fontWeight: "800", marginTop: 5 },
  flowHint: { color: "#A7F3D0", fontSize: 11, fontWeight: "900", marginTop: 6 },
  topRightHud: { position: "absolute", right: 12, top: 12, gap: 8 },
  smallButton: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: "rgba(245,197,95,0.6)", backgroundColor: "rgba(7,5,12,0.78)", alignItems: "center" },
  smallButtonActive: { borderColor: "rgba(251,146,60,0.92)", backgroundColor: "rgba(124,45,18,0.86)" },
  smallButtonText: { color: "#FFF7D6", fontSize: 11, fontWeight: "900" },
  bottomLeftHud: { position: "absolute", left: 12, bottom: 12, flexDirection: "row", gap: 8 },
  roundButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: "rgba(147,197,253,0.75)", backgroundColor: "rgba(14,116,144,0.68)" },
  roundButtonText: { color: "#F0FDFA", fontSize: 12, fontWeight: "900" },
  actionDock: {
    position: "absolute",
    right: 14,
    bottom: 14,
    width: 320,
    padding: 10,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(245,197,95,0.7)",
    backgroundColor: "rgba(7,5,12,0.83)",
  },
  actionDockCompact: { width: 292, padding: 8 },
  actionDockHeader: { marginBottom: 7 },
  actionDockTitle: { color: "#FFF1B8", fontSize: 14, fontWeight: "900", letterSpacing: 0.8 },
  actionDockHint: { color: "#C4B5FD", fontSize: 10, fontWeight: "800", marginTop: 2 },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionButton: {
    width: 72,
    minHeight: 76,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "rgba(245,197,95,0.52)",
    backgroundColor: "rgba(35,19,59,0.9)",
    alignItems: "center",
    justifyContent: "center",
    padding: 5,
  },
  attackButton: { backgroundColor: "rgba(80,22,32,0.9)" },
  actionButtonActive: { borderColor: "rgba(216,180,254,1)", backgroundColor: "rgba(109,40,217,0.9)", shadowColor: "#C084FC", shadowOpacity: 0.55, shadowRadius: 10 },
  actionButtonDisabled: { opacity: 0.38 },
  actionIcon: { color: "#FFF1B8", fontSize: 19, fontWeight: "900" },
  actionText: { color: "#FFF7D6", fontSize: 9, fontWeight: "900", textAlign: "center", marginTop: 2 },
  actionSubText: { color: "#A7F3D0", fontSize: 8, fontWeight: "900", marginTop: 2 },
  cooldownPip: { position: "absolute", top: 4, right: 7, color: "#FCA5A5", fontSize: 14, fontWeight: "900" },
  actionRowBottom: { flexDirection: "row", gap: 8, marginTop: 8 },
  standButton: { flex: 1, paddingVertical: 13, borderRadius: 18, borderWidth: 2, borderColor: "rgba(147,197,253,0.75)", backgroundColor: "rgba(14,116,144,0.88)", alignItems: "center" },
  standButtonText: { color: "#F0FDFA", fontSize: 16, fontWeight: "900" },
  cancelButton: { paddingHorizontal: 13, paddingVertical: 13, borderRadius: 18, borderWidth: 1, borderColor: "rgba(252,165,165,0.65)", backgroundColor: "rgba(69,10,10,0.7)", alignItems: "center" },
  cancelButtonText: { color: "#FEE2E2", fontSize: 11, fontWeight: "900" },
  previewHud: { position: "absolute", left: 280, top: 12, width: 260, padding: 10, borderRadius: 15, borderWidth: 1, borderColor: "rgba(252,165,165,0.72)", backgroundColor: "rgba(30,10,18,0.78)" },
  previewTitle: { color: "#FFF1B8", fontSize: 14, fontWeight: "900" },
  previewText: { color: "#F5E6C8", fontSize: 11, fontWeight: "800", marginTop: 4 },
  logHud: { position: "absolute", left: 280, bottom: 12, right: 350, padding: 10, borderRadius: 14, backgroundColor: "rgba(7,5,12,0.72)", borderWidth: 1, borderColor: "rgba(245,197,95,0.45)" },
  helpHud: { position: "absolute", left: 280, top: 112, width: 310, padding: 12, borderRadius: 16, backgroundColor: "rgba(7,5,12,0.82)", borderWidth: 1, borderColor: "rgba(216,180,254,0.66)" },
  helpTitle: { color: "#FFF1B8", fontSize: 14, fontWeight: "900", marginBottom: 6 },
  helpText: { color: "#E9D5FF", fontSize: 11, fontWeight: "800", marginTop: 3 },
  phaseText: { color: "#FFF1B8", fontSize: 12, fontWeight: "900" },
  logText: { color: "#E9D5FF", fontSize: 11, fontWeight: "800", marginTop: 4 },
  cameraText: { color: "#A7F3D0", fontSize: 10, fontWeight: "800", marginTop: 4 },
  resultOverlay: { position: "absolute", left: "28%", right: "28%", top: "25%", padding: 22, borderRadius: 22, borderWidth: 1, borderColor: "rgba(245,197,95,0.78)", backgroundColor: "rgba(7,5,12,0.92)", alignItems: "center" },
  resultTitle: { color: "#FFF1B8", fontSize: 26, fontWeight: "900" },
  resultText: { color: "#F5E6C8", fontSize: 13, fontWeight: "800", marginVertical: 12, textAlign: "center" },
  resultButton: { marginTop: 8, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 14, borderWidth: 1, borderColor: "rgba(216,180,254,0.75)", backgroundColor: "rgba(109,40,217,0.75)" },
  resultButtonText: { color: "#FFF7D6", fontSize: 13, fontWeight: "900" },
  backButton: { position: "absolute", right: 12, top: 112, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: "rgba(7,5,12,0.78)", borderWidth: 1, borderColor: "rgba(216,180,254,0.65)" },
  backButtonText: { color: "#FFF7D6", fontSize: 11, fontWeight: "900" },
  rotateOnlyScreen: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: "#05030A" },
  rotateOnlyTitle: { color: "#FFF1B8", fontSize: 26, fontWeight: "900", textAlign: "center" },
  rotateOnlyText: { color: "#E9D5FF", fontSize: 14, fontWeight: "800", textAlign: "center", marginTop: 10, marginBottom: 18, maxWidth: 520 },
  rotateNotice: { position: "absolute", zIndex: 20, top: 48, left: 12, right: 12, padding: 10, borderRadius: 12, backgroundColor: "rgba(127,29,29,0.86)", borderWidth: 1, borderColor: "rgba(252,165,165,0.8)" },
  rotateText: { color: "#FEE2E2", fontSize: 12, fontWeight: "900", textAlign: "center" },
});
