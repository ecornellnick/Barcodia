import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  ImageBackground,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  api,
  RealmHotspot,
  RealmPayload,
  StoryCharacter,
  StoryScene,
  StorySceneChoice,
} from "@/src/lib/api";
import { COLORS } from "@/src/lib/theme";

const BACKEND_BASE =
  process.env.EXPO_PUBLIC_BACKEND_URL?.replace(/\/api$/, "") || "";

const REALM_IMAGE_SOURCES: Record<string, any> = {
  "asset:realms/bedroom.png": require("../../assets/images/realms/bedroom_clean.png"),
  "asset:realms/bedroom_clean.png": require("../../assets/images/realms/bedroom_clean.png"),
  "asset:realms/bedroom_window_day.png": require("../../assets/images/realms/bedroom_window_day.png"),
  "asset:realms/kitchen_day.png": require("../../assets/images/realms/kitchen_day.png"),
  "asset:realms/whisperwood_beacon.png": require("../../assets/images/realms/whisperwood_beacon_clean.png"),
  "asset:realms/whisperwood_beacon_clean.png": require("../../assets/images/realms/whisperwood_beacon_clean.png"),
};

const RUNTIME_SAVE_KEY = "barcadia.dev.runtime.v1";
const RUNTIME_SNAPSHOTS_KEY = "barcadia.dev.snapshots.v1";

const CHARACTER_IMAGE_SOURCES: Record<string, any> = {
  mom: require("../../assets/images/characters/mom_avatar.png"),
  mom_avatar: require("../../assets/images/characters/mom_avatar.png"),
};

function normalizeKey(value?: string): string {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function characterBySpeaker(
  characters: StoryCharacter[] | undefined,
  speaker?: string,
): StoryCharacter | undefined {
  const key = normalizeKey(speaker);
  if (!key || !Array.isArray(characters)) return undefined;
  return characters.find(
    (c) => normalizeKey(c.id) === key || normalizeKey(c.name) === key,
  );
}

function displaySpeaker(
  speaker?: string,
  characters?: StoryCharacter[],
): string {
  const raw = String(speaker || "").trim();
  if (!raw) return "Narration";
  const c = characterBySpeaker(characters, raw);
  return c?.name || raw.replace(/^new_character_\d+$/, "Character");
}

function portraitKeyForSpeaker(
  speaker?: string,
  portrait?: string,
  characters?: StoryCharacter[],
): string {
  const c = characterBySpeaker(characters, speaker);
  return normalizeKey(
    String(portrait || c?.portrait || c?.avatar || c?.name || speaker || ""),
  );
}

type WorldMode = "scene" | "computer" | "rest";

type DialogueLine = {
  speaker?: string;
  body: string;
  portrait?: string;
  emotion?: string;
};

type ActiveDialogue = {
  lines: DialogueLine[];
  choices?: StorySceneChoice[];
  scene_id?: string;
  choicePrompt?: string;
} | null;

function imageSource(image?: string): any {
  if (!image) return REALM_IMAGE_SOURCES["asset:realms/bedroom.png"];
  if (REALM_IMAGE_SOURCES[image]) return REALM_IMAGE_SOURCES[image];
  if (image.startsWith("http")) return { uri: image };
  if (image.startsWith("asset:"))
    return { uri: `${BACKEND_BASE}/assets/${image.replace("asset:", "")}` };
  if (image.startsWith("/")) return { uri: `${BACKEND_BASE}${image}` };
  return REALM_IMAGE_SOURCES["asset:realms/bedroom.png"];
}

function PercentHotspot({
  hotspot,
  onPress,
}: {
  hotspot: RealmHotspot;
  onPress: () => void;
}) {
  // x_pct / y_pct are treated as the CENTER of the hotspot in both Admin and Game.
  // This keeps admin drag placement aligned with what appears in the running game.
  const left = `${Number(hotspot.x_pct ?? 20)}%` as any;
  const top = `${Number(hotspot.y_pct ?? 20)}%` as any;
  const circleColor = hotspot.color || "rgba(14,165,233,0.90)";
  return (
    <TouchableOpacity
      activeOpacity={0.86}
      onPress={onPress}
      style={[styles.hotspot, { left, top }]}
    >
      <View style={[styles.hotspotCircle, { backgroundColor: circleColor }]}>
        <Text style={styles.hotspotIcon}>
          {hotspot.icon || iconForHotspot(hotspot)}
        </Text>
      </View>
      <Text style={styles.hotspotLabel}>
        {hotspot.label || hotspot.id || "Hotspot"}
      </Text>
    </TouchableOpacity>
  );
}

function iconForHotspot(hotspot: RealmHotspot): string {
  const action = hotspot.action_type || "inspect";
  if (action === "open_computer") return "▭";
  if (action === "rest") return "▰";
  if (action === "change_scene") return "➜";
  if (action === "give_item") return "✦";
  if (action === "open_dialogue") return "♡";
  return "✧";
}

function normalizeStoryLine(line: any): DialogueLine {
  return {
    speaker:
      line?.speaker || (line?.type === "narration" ? "Narration" : undefined),
    body: String(line?.body ?? line?.text ?? ""),
    portrait: line?.portrait,
    emotion: line?.emotion,
  };
}

function linesForStoryScene(scene?: StoryScene | null): DialogueLine[] {
  if (!scene) return [];
  const rawLines = Array.isArray(scene.lines)
    ? scene.lines
    : Array.isArray(scene.dialogue_lines)
      ? scene.dialogue_lines
      : [];
  const lines = rawLines
    .map(normalizeStoryLine)
    .filter((line) => line.body.trim().length > 0);
  if (lines.length) return lines;
  return [
    {
      speaker: "Narration",
      body: scene.title
        ? `Story scene: ${scene.title}`
        : "A story scene begins...",
    },
  ];
}

function choicesForStoryScene(scene?: StoryScene | null): StorySceneChoice[] {
  return Array.isArray(scene?.choices)
    ? scene!.choices!.filter((choice) => (choice.text || "").trim().length > 0)
    : [];
}

function choicePromptForStoryScene(scene?: StoryScene | null): string {
  return String(scene?.choice_prompt || "What do you do?");
}

function findStoryScene(
  scenes: StoryScene[] | undefined,
  id?: string,
): StoryScene | undefined {
  if (!id || !Array.isArray(scenes)) return undefined;
  return scenes.find((scene) => scene.id === id || scene.title === id);
}

function firstEnterLocationScene(
  scenes: StoryScene[] | undefined,
): StoryScene | undefined {
  if (!Array.isArray(scenes)) return undefined;
  return (
    scenes.find(
      (scene) => (scene.trigger_type || "").toLowerCase() === "enter_location",
    ) || scenes[0]
  );
}

function coerceHotspots(raw: any): RealmHotspot[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((h, i) =>
      typeof h === "string"
        ? {
            id: h.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
            label: h,
            x_pct: 20 + i * 15,
            y_pct: 50,
            width_pct: 12,
            height_pct: 10,
            action_type: "inspect",
          }
        : h,
    )
    .filter((h) => h && !h.archived);
}

function TransitionOverlay({ label }: { label: string }) {
  return (
    <View pointerEvents="none" style={styles.transitionOverlay}>
      <LinearGradient
        colors={[
          "rgba(2,6,23,0.98)",
          "rgba(4,22,42,0.96)",
          "rgba(2,6,23,0.98)",
        ]}
        style={styles.transitionPanel}
      >
        <View style={styles.transitionRing}>
          <View style={styles.transitionCore} />
        </View>
        <Text style={styles.transitionText}>{label}</Text>
        <View style={styles.transitionBarOuter}>
          <View style={styles.transitionBarInner} />
        </View>
      </LinearGradient>
    </View>
  );
}

function DialogueBox({
  lines,
  index,
  choices = [],
  choicePrompt = "What do you do?",
  characters = [],
  onNext,
  onChoice,
}: {
  lines: DialogueLine[];
  index: number;
  choices?: StorySceneChoice[];
  choicePrompt?: string;
  characters?: StoryCharacter[];
  onNext: () => void;
  onChoice: (choice: StorySceneChoice) => void;
}) {
  const showChoices = index >= lines.length && choices.length > 0;
  const line = showChoices
    ? lines[Math.max(0, lines.length - 1)]
    : lines[index] || lines[0];
  const activeSpeaker = showChoices
    ? "Your Choice"
    : displaySpeaker(line?.speaker, characters);
  const portraitKey = portraitKeyForSpeaker(
    line?.speaker,
    line?.portrait,
    characters,
  );
  const portraitSource = CHARACTER_IMAGE_SOURCES[portraitKey];
  return (
    <View style={styles.dialogueWrap}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onNext}
        style={styles.dialogueBox}
      >
        <View style={styles.dialoguePortrait}>
          {!showChoices && portraitSource ? (
            <Image
              source={portraitSource}
              style={styles.dialoguePortraitImage}
            />
          ) : (
            <Text style={styles.dialogueSigilText}>
              {showChoices ? "?" : "✦"}
            </Text>
          )}
        </View>
        <View style={styles.dialogueTextWrap}>
          <Text style={styles.dialogueSpeaker}>{activeSpeaker}</Text>
          <Text style={styles.dialogueBody}>
            {showChoices ? choicePrompt : line.body}
          </Text>
        </View>
        {!showChoices ? <Text style={styles.dialogueAdvance}>⌄</Text> : null}
      </TouchableOpacity>
      {showChoices ? (
        <View style={styles.choicePanel}>
          {choices.map((choice, choiceIndex) => (
            <TouchableOpacity
              key={`${choice.text || "choice"}-${choiceIndex}`}
              style={styles.choiceButton}
              activeOpacity={0.86}
              onPress={() => onChoice(choice)}
            >
              <Text style={styles.choiceButtonText}>
                {choice.text || "Continue"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ComputerScreen({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.computerRoot}>
      <LinearGradient
        colors={["#06111F", "#02050C"]}
        style={styles.computerPanel}
      >
        <View style={styles.desktopTopBar}>
          <Text style={styles.osTitle}>BARCODIA</Text>
          <Text style={styles.osClock}>10:47 AM</Text>
        </View>

        <View style={styles.desktopBody}>
          <View style={styles.desktopSidebar}>
            {[
              ["✉️", "Mail"],
              ["🌐", "Web"],
              ["📁", "Files"],
              ["📝", "Notes"],
            ].map(([icon, label]) => (
              <View key={label} style={styles.desktopAppIcon}>
                <Text style={styles.desktopEmoji}>{icon}</Text>
                <Text style={styles.desktopLabel}>{label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.mailWindow}>
            <View style={styles.browserBar}>
              <Text style={styles.browserUrl}>
                https://mail.mythnet.local/inbox
              </Text>
            </View>
            <Text style={styles.mailTitle}>ArcMail Inbox</Text>
            <View style={styles.mailLayout}>
              <View style={styles.mailList}>
                <View style={[styles.mailItem, styles.mailItemActive]}>
                  <Text style={styles.mailFrom}>Guild Headquarters</Text>
                  <Text style={styles.mailSubject}>
                    Mission Briefing — Whisperwood
                  </Text>
                </View>
                <View style={styles.mailItem}>
                  <Text style={styles.mailFrom}>Merchant Alliance</Text>
                  <Text style={styles.mailSubject}>
                    New Trade Opportunities
                  </Text>
                </View>
                <View style={styles.mailItem}>
                  <Text style={styles.mailFrom}>Explorer's Journal</Text>
                  <Text style={styles.mailSubject}>
                    Notes from the Whisperwood
                  </Text>
                </View>
              </View>
              <View style={styles.mailPreview}>
                <Text style={styles.previewTitle}>
                  Mission Briefing — Whisperwood
                </Text>
                <Text style={styles.previewMeta}>From: Guild Headquarters</Text>
                <Text style={styles.previewBody}>
                  Adventurer,{"\n\n"}
                  We received reports of unusual interference coming from deep
                  within Whisperwood Forest.{"\n\n"}
                  Review the attached briefing before you investigate the
                  beacon.
                </Text>
                <View style={styles.attachment}>
                  <Text style={styles.attachmentText}>
                    📎 whisperwood_briefing.pdf
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>

      <TouchableOpacity
        onPress={onBack}
        activeOpacity={0.86}
        style={styles.backButton}
      >
        <Text style={styles.backButtonText}>← BACK</Text>
      </TouchableOpacity>
    </View>
  );
}

function RestScreen({ onBack }: { onBack: () => void }) {
  return (
    <ImageBackground
      source={REALM_IMAGE_SOURCES["asset:realms/bedroom.png"]}
      style={styles.bg}
      resizeMode="cover"
    >
      <LinearGradient
        colors={["rgba(0,0,0,0.28)", "rgba(0,0,0,0.46)"]}
        style={styles.overlayCenter}
      >
        <View style={styles.resultPanel}>
          <View style={styles.resultIcon}>
            <Text style={styles.resultIconText}>♥</Text>
          </View>
          <Text style={styles.resultTitle}>Rest Complete</Text>
          <Text style={styles.resultText}>
            You feel refreshed. HP and Mana have been restored.
          </Text>
          <View style={styles.statLine}>
            <Text style={styles.statLabel}>HP</Text>
            <View style={styles.greenBar} />
          </View>
          <View style={styles.statLine}>
            <Text style={styles.statLabel}>Mana</Text>
            <View style={styles.blueBar} />
          </View>
          <TouchableOpacity onPress={onBack} style={styles.panelButton}>
            <Text style={styles.panelButtonText}>Return</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </ImageBackground>
  );
}

function findRealmIdForLocation(
  data: RealmPayload | null,
  locationId?: string,
): string | undefined {
  if (!data || !locationId) return undefined;
  const target = String(locationId).trim();
  const realms = Array.isArray(data.realms) ? data.realms : [];
  const found = realms.find(
    (realm) =>
      Array.isArray(realm.locations) &&
      realm.locations.some(
        (location) => location.id === target || location.name === target,
      ),
  );
  return found?.id;
}

function findLocationIdByNameOrId(
  data: RealmPayload | null,
  wanted: string,
): { realmId: string; locationId: string } | null {
  if (!data || !wanted) return null;
  const key = normalizeKey(wanted);
  const realms = Array.isArray(data.realms) ? data.realms : [];
  for (const realm of realms) {
    for (const location of realm.locations || []) {
      if (
        normalizeKey(location.id) === key ||
        normalizeKey(location.name) === key
      ) {
        return { realmId: realm.id, locationId: location.id };
      }
    }
  }
  return null;
}

type DevLocationOption = {
  realmId: string;
  realmLabel: string;
  id: string;
  name: string;
};
type DevSnapshot = {
  id: string;
  label: string;
  realmId: string;
  locationId: string;
  runtimeFlags?: Record<string, boolean | string | number>;
  runtimeInventory?: RuntimeInventoryItem[];
  runtimeQuestLog?: RuntimeQuestEntry[];
  runtimeActionLog?: RuntimeActionEntry[];
  seenEnterSceneKeys?: Record<string, boolean>;
  usedHotspotIds?: Record<string, boolean>;
};

type PersistedRuntimeState = {
  runtimeFlags: Record<string, boolean | string | number>;
  runtimeInventory: RuntimeInventoryItem[];
  runtimeQuestLog: RuntimeQuestEntry[];
  runtimeActionLog: RuntimeActionEntry[];
  seenEnterSceneKeys: Record<string, boolean>;
  usedHotspotIds: Record<string, boolean>;
};

type RuntimeInventoryItem = { id: string; label: string; count: number };
type RuntimeQuestEntry = { id: string; status: string; label?: string };
type RuntimeActionEntry = { id: string; label: string; detail?: string };
type RuntimeQaIssue = { level: "ok" | "warn" | "bad"; label: string; detail?: string };

function DevModePanel({
  visible,
  onClose,
  data,
  currentSceneId,
  snapshots,
  onJumpLocation,
  onPlayScene,
  onReplayLocationScene,
  onClearDialogue,
  onResetStart,
  onSaveSnapshot,
  onLoadSnapshot,
  onClearPersistentState,
  onResetStoryTriggers,
  runtimeFlags,
  inventory,
  questLog,
  actionLog,
  onToggleFlag,
  qaIssues,
  onRunRuntimeQA,
}: {
  visible: boolean;
  onClose: () => void;
  data: RealmPayload | null;
  currentSceneId?: string;
  snapshots: DevSnapshot[];
  runtimeFlags: Record<string, boolean | string | number>;
  inventory: RuntimeInventoryItem[];
  questLog: RuntimeQuestEntry[];
  actionLog: RuntimeActionEntry[];
  onJumpLocation: (realmId: string, locationId: string) => void;
  onPlayScene: (sceneId: string) => void;
  onReplayLocationScene: () => void;
  onClearDialogue: () => void;
  onResetStart: () => void;
  onSaveSnapshot: () => void;
  onLoadSnapshot: (snapshot: DevSnapshot) => void;
  onClearPersistentState: () => void;
  onResetStoryTriggers: () => void;
  onToggleFlag: (flagId: string) => void;
  qaIssues: RuntimeQaIssue[];
  onRunRuntimeQA: () => void;
}) {
  const [locationFilter, setLocationFilter] = useState("");
  const [storyFilter, setStoryFilter] = useState("");
  const locations: DevLocationOption[] = useMemo(() => {
    const realms = Array.isArray(data?.realms) ? data!.realms : [];
    return realms.flatMap((realm) =>
      (realm.locations || []).map((location) => ({
        realmId: realm.id,
        realmLabel: realm.label || realm.id,
        id: location.id,
        name: location.name || location.id,
      })),
    );
  }, [data]);
  const scenes = useMemo(
    () =>
      Array.isArray(data?.story_scenes)
        ? data!.story_scenes.filter(
            (scene) => scene && !(scene as any).archived,
          )
        : [],
    [data],
  );
  const filteredLocations = locations
    .filter((location) =>
      `${location.realmLabel} ${location.name} ${location.id}`
        .toLowerCase()
        .includes(locationFilter.toLowerCase()),
    )
    .slice(0, 28);
  const filteredScenes = scenes
    .filter((scene) =>
      `${scene.title || ""} ${scene.id || ""} ${scene.location_id || ""} ${scene.trigger_type || ""}`
        .toLowerCase()
        .includes(storyFilter.toLowerCase()),
    )
    .slice(0, 28);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.devModalBackdrop}>
        <View style={styles.devPanel}>
          <View style={styles.devHeader}>
            <View>
              <Text style={styles.devKicker}>Game Master Dev Mode</Text>
              <Text style={styles.devTitle}>Testing Control Panel</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.devClose}>
              <Text style={styles.devCloseText}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.devBody}
            contentContainerStyle={styles.devBodyContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.devStatusGrid}>
              <View style={styles.devStatusCard}>
                <Text style={styles.devStatusLabel}>Location</Text>
                <Text style={styles.devStatusValue}>
                  {data?.location?.name || "Unknown"}
                </Text>
              </View>
              <View style={styles.devStatusCard}>
                <Text style={styles.devStatusLabel}>Realm</Text>
                <Text style={styles.devStatusValue}>
                  {data?.realm?.label || data?.current_realm || "Unknown"}
                </Text>
              </View>
              <View style={styles.devStatusCard}>
                <Text style={styles.devStatusLabel}>Active Story</Text>
                <Text style={styles.devStatusValue}>
                  {currentSceneId || "None"}
                </Text>
              </View>
            </View>

            <View style={styles.devSection}>
              <Text style={styles.devSectionTitle}>Jump to Location</Text>
              <TextInput
                value={locationFilter}
                onChangeText={setLocationFilter}
                placeholder="Search locations..."
                placeholderTextColor="rgba(226,232,240,0.45)"
                style={styles.devInput}
              />
              <View style={styles.devList}>
                {filteredLocations.map((location) => (
                  <TouchableOpacity
                    key={`${location.realmId}:${location.id}`}
                    style={styles.devRow}
                    onPress={() =>
                      onJumpLocation(location.realmId, location.id)
                    }
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.devRowTitle}>{location.name}</Text>
                      <Text style={styles.devRowMeta}>
                        {location.realmLabel} • {location.id}
                      </Text>
                    </View>
                    <Text style={styles.devRowAction}>Go</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.devSection}>
              <Text style={styles.devSectionTitle}>Trigger Story Scene</Text>
              <TextInput
                value={storyFilter}
                onChangeText={setStoryFilter}
                placeholder="Search story scenes..."
                placeholderTextColor="rgba(226,232,240,0.45)"
                style={styles.devInput}
              />
              <View style={styles.devList}>
                {filteredScenes.map((scene) => (
                  <TouchableOpacity
                    key={scene.id}
                    style={styles.devRow}
                    onPress={() => onPlayScene(scene.id)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.devRowTitle}>
                        {scene.title || scene.id}
                      </Text>
                      <Text style={styles.devRowMeta}>
                        {scene.location_id || "Any location"} •{" "}
                        {scene.trigger_type || "manual"}
                      </Text>
                    </View>
                    <Text style={styles.devRowAction}>Play</Text>
                  </TouchableOpacity>
                ))}
                {!filteredScenes.length ? (
                  <Text style={styles.devEmpty}>No story scenes found.</Text>
                ) : null}
              </View>
            </View>

            <View style={styles.devSection}>
              <Text style={styles.devSectionTitle}>Runtime Controls</Text>
              <View style={styles.devButtonGrid}>
                <TouchableOpacity
                  style={styles.devButton}
                  onPress={onReplayLocationScene}
                >
                  <Text style={styles.devButtonText}>
                    Replay Enter-Location Story
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.devButton}
                  onPress={onClearDialogue}
                >
                  <Text style={styles.devButtonText}>
                    Clear Active Dialogue
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.devButton}
                  onPress={onResetStart}
                >
                  <Text style={styles.devButtonText}>Reset to Bedroom</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.devButton}
                  onPress={onSaveSnapshot}
                >
                  <Text style={styles.devButtonText}>Save Snapshot</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.devButton}
                  onPress={onResetStoryTriggers}
                >
                  <Text style={styles.devButtonText}>Reset Story Triggers</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.devButton, styles.devDangerButton]}
                  onPress={onClearPersistentState}
                >
                  <Text style={styles.devButtonText}>Clear Test Save</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.devHint}>
                Snapshots now include location plus dev runtime state for faster branch testing.
              </Text>
              {snapshots.map((snapshot) => (
                <TouchableOpacity
                  key={snapshot.id}
                  style={styles.devSnapshot}
                  onPress={() => onLoadSnapshot(snapshot)}
                >
                  <Text style={styles.devRowTitle}>{snapshot.label}</Text>
                  <Text style={styles.devRowMeta}>
                    {snapshot.realmId} / {snapshot.locationId}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>



            <View style={styles.devSection}>
              <View style={styles.devSectionHeaderRow}>
                <Text style={styles.devSectionTitle}>Full Game Testing Toolkit</Text>
                <Text style={styles.devQaBadge}>v50</Text>
              </View>
              <Text style={styles.devHint}>
                Use this panel when you are testing story branches without restarting the game. Save a checkpoint, run a branch, restore, then try the alternate route.
              </Text>
              <View style={styles.devTestingSteps}>
                <View style={styles.devTestingStep}>
                  <Text style={styles.devTestingStepNum}>1</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.devRowTitle}>Set your starting point</Text>
                    <Text style={styles.devRowMeta}>Jump to a location or play a story scene above, then save a checkpoint.</Text>
                  </View>
                </View>
                <View style={styles.devTestingStep}>
                  <Text style={styles.devTestingStepNum}>2</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.devRowTitle}>Test the branch/action chain</Text>
                    <Text style={styles.devRowMeta}>Use choices, hotspots, item/flag actions, quests, or battle stubs.</Text>
                  </View>
                </View>
                <View style={styles.devTestingStep}>
                  <Text style={styles.devTestingStepNum}>3</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.devRowTitle}>Restore and compare</Text>
                    <Text style={styles.devRowMeta}>Load the checkpoint and test the alternate branch without replaying from the beginning.</Text>
                  </View>
                </View>
              </View>
              <View style={styles.devButtonGrid}>
                <TouchableOpacity style={styles.devButton} onPress={onSaveSnapshot}>
                  <Text style={styles.devButtonText}>Save Checkpoint</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.devButton} onPress={onRunRuntimeQA}>
                  <Text style={styles.devButtonText}>Run Full QA</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.devButton} onPress={onReplayLocationScene}>
                  <Text style={styles.devButtonText}>Replay Current Entry Story</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.devButton} onPress={onResetStoryTriggers}>
                  <Text style={styles.devButtonText}>Reset Branch Replay State</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.devHint}>
                Soft reset tools keep your current CMS data. Clear Test Save removes local flags/items/quests/snapshots only.
              </Text>
            </View>

            <View style={styles.devSection}>
              <View style={styles.devSectionHeaderRow}>
                <Text style={styles.devSectionTitle}>Runtime Integration QA</Text>
                <TouchableOpacity style={styles.devMiniButton} onPress={onRunRuntimeQA}>
                  <Text style={styles.devMiniButtonText}>Run QA</Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.devHint}>
                Checks current CMS runtime wiring: location hooks, hotspots, story choices, missing targets, and broken branches.
              </Text>
              <View style={styles.devList}>
                {qaIssues.length ? qaIssues.slice(0, 18).map((issue, idx) => (
                  <View key={`${issue.label}-${idx}`} style={[styles.devQaRow, issue.level === "bad" ? styles.devQaBad : issue.level === "warn" ? styles.devQaWarn : styles.devQaOk]}>
                    <Text style={styles.devQaBadge}>{issue.level === "bad" ? "FIX" : issue.level === "warn" ? "WARN" : "OK"}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.devRowTitle}>{issue.label}</Text>
                      {issue.detail ? <Text style={styles.devRowMeta}>{issue.detail}</Text> : null}
                    </View>
                  </View>
                )) : <Text style={styles.devEmpty}>Run QA after loading a location/story setup.</Text>}
              </View>
            </View>

            <View style={styles.devSection}>
              <Text style={styles.devSectionTitle}>Runtime State Debug</Text>
              <Text style={styles.devHint}>
                Dev runtime state is persisted locally so testing can continue after app reloads. Clear Test Save resets it.
              </Text>
              <View style={styles.devRuntimeGrid}>
                <View style={styles.devRuntimeBox}>
                  <Text style={styles.devRuntimeTitle}>Flags</Text>
                  {Object.keys(runtimeFlags).length ? Object.entries(runtimeFlags).slice(0, 14).map(([key, value]) => (
                    <TouchableOpacity key={key} style={styles.devRuntimeRow} onPress={() => onToggleFlag(key)}>
                      <Text style={styles.devRuntimeKey}>{key}</Text>
                      <Text style={styles.devRuntimeValue}>{String(value)}</Text>
                    </TouchableOpacity>
                  )) : <Text style={styles.devEmpty}>No runtime flags set yet.</Text>}
                </View>
                <View style={styles.devRuntimeBox}>
                  <Text style={styles.devRuntimeTitle}>Inventory</Text>
                  {inventory.length ? inventory.slice(0, 12).map((item) => (
                    <View key={item.id} style={styles.devRuntimeRow}>
                      <Text style={styles.devRuntimeKey}>{item.label}</Text>
                      <Text style={styles.devRuntimeValue}>×{item.count}</Text>
                    </View>
                  )) : <Text style={styles.devEmpty}>No dev items gained yet.</Text>}
                </View>
                <View style={styles.devRuntimeBox}>
                  <Text style={styles.devRuntimeTitle}>Quests / Battles</Text>
                  {questLog.length ? questLog.slice(0, 12).map((quest) => (
                    <View key={`${quest.id}-${quest.status}`} style={styles.devRuntimeRow}>
                      <Text style={styles.devRuntimeKey}>{quest.label || quest.id}</Text>
                      <Text style={styles.devRuntimeValue}>{quest.status}</Text>
                    </View>
                  )) : <Text style={styles.devEmpty}>No quest/battle test entries yet.</Text>}
                </View>
                <View style={styles.devRuntimeBox}>
                  <Text style={styles.devRuntimeTitle}>Recent Actions</Text>
                  {actionLog.length ? actionLog.slice(0, 8).map((entry) => (
                    <View key={entry.id} style={styles.devRuntimeAction}>
                      <Text style={styles.devRuntimeKey}>{entry.label}</Text>
                      {entry.detail ? <Text style={styles.devRowMeta}>{entry.detail}</Text> : null}
                    </View>
                  )) : <Text style={styles.devEmpty}>No actions yet.</Text>}
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function WorldScreen() {
  const [data, setData] = useState<RealmPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<WorldMode>("scene");
  const [transitionLabel, setTransitionLabel] = useState("");
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const [dialogueDismissed, setDialogueDismissed] = useState(false);
  const [activeDialogue, setActiveDialogue] = useState<ActiveDialogue>(null);
  const [devOpen, setDevOpen] = useState(false);
  const [devSnapshots, setDevSnapshots] = useState<DevSnapshot[]>([]);
  const [runtimeFlags, setRuntimeFlags] = useState<Record<string, boolean | string | number>>({});
  const [runtimeInventory, setRuntimeInventory] = useState<RuntimeInventoryItem[]>([]);
  const [runtimeQuestLog, setRuntimeQuestLog] = useState<RuntimeQuestEntry[]>([]);
  const [runtimeActionLog, setRuntimeActionLog] = useState<RuntimeActionEntry[]>([]);
  const [seenEnterSceneKeys, setSeenEnterSceneKeys] = useState<Record<string, boolean>>({});
  const [usedHotspotIds, setUsedHotspotIds] = useState<Record<string, boolean>>({});
  const [runtimeHydrated, setRuntimeHydrated] = useState(false);
  const [actionToast, setActionToast] = useState("");
  const [runtimeQaIssues, setRuntimeQaIssues] = useState<RuntimeQaIssue[]>([]);
  const fade = useRef(new Animated.Value(1)).current;

  const load = useCallback(async () => {
    try {
      setError("");
      setLoading(true);
      setData(await api.realm());
    } catch (e: any) {
      setError(e.message || "Could not load current world.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    const hydrateRuntime = async () => {
      try {
        const [savedState, savedSnapshots] = await Promise.all([
          AsyncStorage.getItem(RUNTIME_SAVE_KEY),
          AsyncStorage.getItem(RUNTIME_SNAPSHOTS_KEY),
        ]);
        if (cancelled) return;
        if (savedState) {
          const parsed = JSON.parse(savedState) as Partial<PersistedRuntimeState>;
          setRuntimeFlags(parsed.runtimeFlags || {});
          setRuntimeInventory(parsed.runtimeInventory || []);
          setRuntimeQuestLog(parsed.runtimeQuestLog || []);
          setRuntimeActionLog(parsed.runtimeActionLog || []);
          setSeenEnterSceneKeys(parsed.seenEnterSceneKeys || {});
          setUsedHotspotIds(parsed.usedHotspotIds || {});
        }
        if (savedSnapshots) {
          const parsedSnapshots = JSON.parse(savedSnapshots);
          if (Array.isArray(parsedSnapshots)) setDevSnapshots(parsedSnapshots);
        }
      } catch (e) {
        console.warn("[Barcadia] Could not hydrate dev runtime state", e);
      } finally {
        if (!cancelled) setRuntimeHydrated(true);
      }
    };
    hydrateRuntime();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!runtimeHydrated) return;
    const saveRuntime = async () => {
      const payload: PersistedRuntimeState = {
        runtimeFlags,
        runtimeInventory,
        runtimeQuestLog,
        runtimeActionLog,
        seenEnterSceneKeys,
        usedHotspotIds,
      };
      try {
        await AsyncStorage.setItem(RUNTIME_SAVE_KEY, JSON.stringify(payload));
      } catch (e) {
        console.warn("[Barcadia] Could not persist dev runtime state", e);
      }
    };
    saveRuntime();
  }, [runtimeHydrated, runtimeFlags, runtimeInventory, runtimeQuestLog, runtimeActionLog, seenEnterSceneKeys, usedHotspotIds]);

  useEffect(() => {
    if (!runtimeHydrated) return;
    AsyncStorage.setItem(RUNTIME_SNAPSHOTS_KEY, JSON.stringify(devSnapshots)).catch((e) =>
      console.warn("[Barcadia] Could not persist dev snapshots", e),
    );
  }, [runtimeHydrated, devSnapshots]);

  useFocusEffect(
    useCallback(() => {
      setMode("scene");
      setDialogueIndex(0);
      setDialogueDismissed(false);
      setActiveDialogue(null);
      load();
    }, [load]),
  );

  useEffect(() => {
    if (!runtimeHydrated || !data?.current_location_id || !data.active_story_scenes?.length) return;
    const scene = firstEnterLocationScene(data.active_story_scenes);
    if (!scene?.id) return;
    const key = `${data.current_realm || "realm"}:${data.current_location_id}:${scene.id}`;
    if (seenEnterSceneKeys[key]) return;
    setSeenEnterSceneKeys((seen) => ({ ...seen, [key]: true }));
    setActiveDialogue({
      lines: linesForStoryScene(scene),
      choices: choicesForStoryScene(scene),
      choicePrompt: choicePromptForStoryScene(scene),
      scene_id: scene.id,
    });
    setDialogueIndex(0);
    setDialogueDismissed(false);
  }, [runtimeHydrated, data?.current_realm, data?.current_location_id, data?.active_story_scenes, seenEnterSceneKeys]);

  const isReal = data?.current_realm !== "fantasy";
  const accent = data?.realm?.accent || (isReal ? "#38BDF8" : "#A855F7");
  const image = useMemo(
    () =>
      imageSource(
        data?.location?.image ||
          (isReal
            ? "asset:realms/bedroom.png"
            : "asset:realms/whisperwood_beacon.png"),
      ),
    [data, isReal],
  );

  const openMode = (nextMode: WorldMode, label: string) => {
    setTransitionLabel(label);
    Animated.sequence([
      Animated.timing(fade, {
        toValue: 0.25,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: 360,
        useNativeDriver: true,
      }),
    ]).start();
    setTimeout(() => {
      setMode(nextMode);
      setDialogueIndex(0);
      setDialogueDismissed(false);
      setTransitionLabel("");
    }, 740);
  };

  const rest = async () => {
    setTransitionLabel("Resting...");
    try {
      await api.restAtHome();
    } catch {}
    setTimeout(() => {
      setMode("rest");
      setTransitionLabel("");
    }, 640);
  };

  const traverseToLocation = async (
    locationId: string,
    label = "Moving...",
  ) => {
    if (!data || !locationId) return;
    const destinationRealm =
      findRealmIdForLocation(data, locationId) || data.current_realm;
    setTransitionLabel(label);
    try {
      const next = await api.traverseRealm(destinationRealm, locationId);
      setData(next);
      setMode("scene");
      setDialogueIndex(0);
      setDialogueDismissed(false);
      setActiveDialogue(null);
      setError("");
    } catch (e: any) {
      setError(e.message || "Could not change scene.");
    } finally {
      setTimeout(() => setTransitionLabel(""), 360);
    }
  };

  const logRuntimeAction = (label: string, detail?: string) => {
    setActionToast(detail ? `${label}: ${detail}` : label);
    setRuntimeActionLog((items) => [
      { id: `action_${Date.now()}_${Math.random()}`, label, detail },
      ...items,
    ].slice(0, 20));
    setTimeout(() => setActionToast(""), 2400);
  };

  const setRuntimeFlag = (flagId?: string, value: boolean | string | number = true) => {
    if (!flagId) return;
    setRuntimeFlags((flags) => ({ ...flags, [flagId]: value }));
    logRuntimeAction("Set Flag", `${flagId} = ${String(value)}`);
  };

  const giveRuntimeItem = (itemId?: string, label?: string) => {
    if (!itemId) return;
    setRuntimeInventory((items) => {
      const existing = items.find((item) => item.id === itemId);
      if (existing) {
        return items.map((item) =>
          item.id === itemId ? { ...item, count: item.count + 1 } : item,
        );
      }
      return [{ id: itemId, label: label || itemId, count: 1 }, ...items];
    });
    logRuntimeAction("Give Item", label || itemId);
  };

  const recordQuestRuntime = (id?: string, status = "started", label?: string) => {
    if (!id) return;
    setRuntimeQuestLog((items) => [
      { id, status, label },
      ...items.filter((item) => !(item.id === id && item.status === status)),
    ].slice(0, 30));
    logRuntimeAction(status === "battle_stub" ? "Battle Stub" : "Quest Update", `${label || id} → ${status}`);
  };

  const missingTarget = (origin: string, action: string, message: string) => {
    logRuntimeAction(`${origin} Missing Target`, `${action}: ${message}`);
  };

  const hasActionTarget = (source: any, keys: string[]) =>
    keys.some((key) => String(source?.[key] || "").trim().length > 0);

  const runRuntimeQaCheck = () => {
    const issues: RuntimeQaIssue[] = [];
    if (!data) {
      issues.push({ level: "bad", label: "No runtime data loaded", detail: "The game could not load realm/story payload data." });
      setRuntimeQaIssues(issues);
      return;
    }

    const scenes = Array.isArray(data.story_scenes) ? data.story_scenes : [];
    const currentLocationId = data.current_location_id || data.location?.id;
    issues.push({
      level: currentLocationId ? "ok" : "bad",
      label: "Current location resolved",
      detail: currentLocationId || "Missing current location id.",
    });

    const activeEnterScenes = Array.isArray(data.active_story_scenes) ? data.active_story_scenes : [];
    issues.push({
      level: activeEnterScenes.length ? "ok" : "warn",
      label: "Location story triggers",
      detail: activeEnterScenes.length ? `${activeEnterScenes.length} active story scene(s) attached here.` : "No attached enter-location story for this location.",
    });

    coerceHotspots(data.location?.hotspots).forEach((hotspot) => {
      const action = String(hotspot.action_type || "inspect").toLowerCase();
      const label = hotspot.label || hotspot.id || "Hotspot";
      if (["change_scene", "travel", "move_location", "location"].includes(action) && !hasActionTarget(hotspot, ["linked_location", "location_id", "target_location_id", "target_id"])) {
        issues.push({ level: "bad", label: `Hotspot missing travel target: ${label}`, detail: "Set Linked Location / target location in the CMS." });
      }
      if (["open_dialogue", "dialogue"].includes(action) && !hasActionTarget(hotspot, ["story_scene_id", "linked_dialogue", "next_id", "next_scene_id"])) {
        issues.push({ level: "warn", label: `Hotspot has no linked story: ${label}`, detail: "It will fall back to generic inspect text." });
      }
      if (["give_item", "item"].includes(action) && !hasActionTarget(hotspot, ["item_id", "target_item_id", "target_id"])) {
        issues.push({ level: "bad", label: `Hotspot missing item target: ${label}`, detail: "Set the item id/target item in the CMS." });
      }
      if (["start_battle", "battle"].includes(action) && !hasActionTarget(hotspot, ["battle_id", "target_battle_id", "target_id"])) {
        issues.push({ level: "warn", label: `Battle hotspot uses placeholder battle: ${label}`, detail: "Create/link a battle id when Battle Builder is ready." });
      }
    });

    scenes.forEach((scene) => {
      choicesForStoryScene(scene).forEach((choice, index) => {
        const label = `${scene.title || scene.id} → choice ${index + 1}`;
        const action = String((choice as any).action_type || choice.type || (choice.next_id ? "open_dialogue" : "")).toLowerCase();
        const targetSceneId = (choice as any).story_scene_id || (choice as any).next_scene_id || choice.next_id || (choice as any).linked_dialogue;
        if (!action && !targetSceneId) {
          issues.push({ level: "bad", label: `Choice has no outcome: ${label}`, detail: choice.text || "Untitled choice" });
        } else if (targetSceneId && !findStoryScene(scenes, targetSceneId)) {
          issues.push({ level: "bad", label: `Choice links to missing story scene: ${label}`, detail: String(targetSceneId) });
        } else if (["travel", "change_scene", "location"].includes(action) && !hasActionTarget(choice, ["linked_location", "location_id", "target_location_id", "target_id"])) {
          issues.push({ level: "bad", label: `Choice travel missing destination: ${label}`, detail: choice.text });
        } else {
          issues.push({ level: "ok", label: `Choice outcome wired: ${label}`, detail: choice.text });
        }
      });
    });

    if (!issues.some((issue) => issue.level === "bad")) {
      issues.unshift({ level: "ok", label: "Runtime QA passed critical checks", detail: "No broken branch/action targets found in the current payload." });
    }
    setRuntimeQaIssues(issues);
    const bad = issues.filter((issue) => issue.level === "bad").length;
    const warn = issues.filter((issue) => issue.level === "warn").length;
    logRuntimeAction("Runtime QA", `${bad} fix / ${warn} warn`);
  };

  const runEffects = (effects?: any[]) => {
    if (!Array.isArray(effects)) return;
    effects.forEach((effect) => {
      const type = String(effect?.type || effect?.action_type || "").toLowerCase();
      const target = effect?.target_id || effect?.target || effect?.flag || effect?.flag_id || effect?.item_id || effect?.quest || effect?.quest_id || effect?.battle_id || effect?.location_id;
      if (type === "set_flag") setRuntimeFlag(target, effect?.value ?? true);
      else if (type === "give_item") giveRuntimeItem(target, effect?.label || effect?.name);
      else if (type === "start_quest") recordQuestRuntime(target, "started", effect?.label || effect?.name);
      else if (type === "advance_quest") recordQuestRuntime(target, "advanced", effect?.label || effect?.name);
      else if (type === "complete_quest") recordQuestRuntime(target, "completed", effect?.label || effect?.name);
      else if (type === "start_battle") recordQuestRuntime(target, "battle_stub", effect?.label || effect?.name);
    });
  };

  const playStoryScene = (scene: StoryScene) => {
    runEffects((scene as any).start_effects);
    setMode("scene");
    setActiveDialogue({
      lines: linesForStoryScene(scene),
      choices: choicesForStoryScene(scene),
      choicePrompt: choicePromptForStoryScene(scene),
      scene_id: scene.id,
    });
    setDialogueIndex(0);
    setDialogueDismissed(false);
    logRuntimeAction("Play Story", scene.title || scene.id);
  };

  const executeRuntimeAction = (source: any, origin = "Action") => {
    if (!source) return;
    const action = String(source.action_type || source.type || (source.next_id ? "open_dialogue" : "inspect")).toLowerCase();
    runEffects(source.effects);
    if ((source.disable_after_use || source.one_time || source.once) && source.id) {
      setUsedHotspotIds((items) => ({ ...items, [String(source.id)]: true }));
      logRuntimeAction("Disable Hotspot", source.label || source.id);
    }

    if (["open_computer", "computer"].includes(action)) {
      logRuntimeAction(origin, "Open Computer");
      return openMode("computer", "Opening Computer...");
    }
    if (["rest", "sleep"].includes(action)) {
      logRuntimeAction(origin, "Rest");
      return rest();
    }
    if (["change_scene", "travel", "move_location", "location"].includes(action)) {
      const destination = source.linked_location || source.location_id || source.target_location_id || source.target_id;
      if (destination) {
        logRuntimeAction(origin, `Travel → ${destination}`);
        return traverseToLocation(destination, `Going to ${destination}...`);
      }
      return missingTarget(origin, action, "No linked location/destination was configured.");
    }
    if (["give_item", "item"].includes(action)) {
      const itemTarget = source.item_id || source.target_item_id || source.target_id;
      if (!itemTarget) return missingTarget(origin, action, "No item target was configured.");
      giveRuntimeItem(itemTarget, source.item_label || source.label || source.text);
      if (!source.story_scene_id && !source.linked_dialogue && !source.next_id) return;
    }
    if (["set_flag", "flag"].includes(action)) {
      const flagTarget = source.flag || source.flag_id || source.target_flag_id || source.target_id;
      if (!flagTarget) return missingTarget(origin, action, "No flag target was configured.");
      setRuntimeFlag(flagTarget, source.value ?? true);
      if (!source.story_scene_id && !source.linked_dialogue && !source.next_id) return;
    }
    if (["start_quest", "advance_quest", "complete_quest", "quest"].includes(action)) {
      const status = action === "advance_quest" ? "advanced" : action === "complete_quest" ? "completed" : "started";
      const questTarget = source.quest || source.quest_id || source.target_quest_id || source.target_id;
      if (!questTarget) return missingTarget(origin, action, "No quest target was configured.");
      recordQuestRuntime(questTarget, status, source.quest_label || source.label);
      if (!source.story_scene_id && !source.linked_dialogue && !source.next_id) return;
    }
    if (["start_battle", "battle"].includes(action)) {
      const battleTarget = source.battle_id || source.target_battle_id || source.target_id;
      if (!battleTarget) return missingTarget(origin, action, "No battle id was configured yet.");
      recordQuestRuntime(battleTarget, "battle_stub", source.battle_label || source.label || source.text);
      if (!source.story_scene_id && !source.linked_dialogue && !source.next_id) return;
    }

    const linkedSceneId = source.story_scene_id || source.linked_dialogue || source.next_id || source.next_scene_id;
    const linkedScene = findStoryScene(data?.story_scenes, linkedSceneId);
    if (linkedScene) return playStoryScene(linkedScene);

    if (origin !== "Choice") {
      const label = source.label || source.text || "Narration";
      setActiveDialogue({
        lines: [{ speaker: label, body: `You inspect ${label}.` }],
        choices: [],
        scene_id: undefined,
      });
      setDialogueIndex(0);
      setDialogueDismissed(false);
    } else {
      logRuntimeAction("Choice", source.text || "Choice selected");
      setDialogueDismissed(true);
    }
  };

  const openDialogueForHotspot = (hotspot: RealmHotspot) => {
    const label = hotspot.label || "Narration";
    const linkedSceneId = hotspot.story_scene_id || hotspot.linked_dialogue;
    const linkedScene = findStoryScene(data?.story_scenes, linkedSceneId);
    if (linkedScene) return playStoryScene(linkedScene);
    const lines = label.toLowerCase().includes("mom")
      ? kitchenLines
      : [{ speaker: label, body: `You inspect ${label}.` }];
    setActiveDialogue({ lines, choices: [], scene_id: undefined });
    setDialogueIndex(0);
    setDialogueDismissed(false);
  };

  const handleHotspot = (hotspot: RealmHotspot) => {
    if (activeDialogue && !dialogueDismissed) return;
    return executeRuntimeAction(hotspot, "Hotspot");
  };

  const windowLines: DialogueLine[] = [
    {
      body: "You gaze out from the second floor. The sun shines brightly over a cozy town below, and the streets move with quiet daytime life.",
    },
    {
      body: "People walk along the sidewalks, a few cars roll by, and white clouds drift lazily over the distant hills.",
    },
  ];

  const kitchenLines: DialogueLine[] = [
    {
      speaker: "Narration",
      body: "The kitchen is warm and familiar. The smell of something home-cooked lingers in the air.",
    },
    {
      speaker: "Mom",
      body: "Hey there. You're just in time — I was about to make something. How was your day?",
    },
  ];

  const advanceDialogue = (lines: DialogueLine[]) => {
    if (dialogueIndex < lines.length - 1) {
      setDialogueIndex(dialogueIndex + 1);
      return;
    }
    if (activeDialogue?.choices?.length && dialogueIndex < lines.length) {
      setDialogueIndex(lines.length);
      return;
    }
    if (activeDialogue?.choices?.length) return;
    const finishedScene = findStoryScene(data?.story_scenes, activeDialogue?.scene_id);
    runEffects((finishedScene as any)?.effects);
    setDialogueDismissed(true);
  };

  const chooseDialogueOption = (choice: StorySceneChoice) => {
    executeRuntimeAction(choice, "Choice");
  };

  const playStorySceneById = (sceneId: string) => {
    const scene = findStoryScene(data?.story_scenes, sceneId);
    if (!scene) return;
    playStoryScene(scene);
    setDevOpen(false);
  };

  const replayEnterLocationStory = () => {
    const scene = firstEnterLocationScene(data?.active_story_scenes);
    if (!scene) return;
    setMode("scene");
    setActiveDialogue({
      lines: linesForStoryScene(scene),
      choices: choicesForStoryScene(scene),
      choicePrompt: choicePromptForStoryScene(scene),
      scene_id: scene.id,
    });
    setDialogueIndex(0);
    setDialogueDismissed(false);
    setDevOpen(false);
  };

  const clearActiveDialogueForDev = () => {
    setActiveDialogue(null);
    setDialogueIndex(0);
    setDialogueDismissed(true);
    setDevOpen(false);
  };

  const resetToBedroomForDev = () => {
    const bedroom = findLocationIdByNameOrId(data, "bedroom") || {
      realmId: "real",
      locationId: "bedroom",
    };
    setActiveDialogue(null);
    setDialogueDismissed(true);
    setDialogueIndex(0);
    setDevOpen(false);
    jumpLocationForDev(bedroom.realmId, bedroom.locationId);
  };

  const jumpLocationForDev = (realmId: string, locationId: string) => {
    setActiveDialogue(null);
    setDialogueDismissed(true);
    setDialogueIndex(0);
    setDevOpen(false);
    setTransitionLabel(`Dev jump to ${locationId}...`);
    api
      .traverseRealm(realmId, locationId)
      .then((next) => {
        setData(next);
        setMode("scene");
        setDialogueDismissed(false);
        setError("");
      })
      .catch((e: any) =>
        setError(
          e.message || `Could not dev-jump to ${realmId}/${locationId}.`,
        ),
      )
      .finally(() => setTimeout(() => setTransitionLabel(""), 360));
  };

  const saveDevSnapshot = () => {
    if (!data?.current_realm || !data?.current_location_id) return;
    const snapshot: DevSnapshot = {
      id: `snapshot_${Date.now()}`,
      label: `${data.location?.name || data.current_location_id} @ ${new Date().toLocaleTimeString()}`,
      realmId: data.current_realm,
      locationId: data.current_location_id,
      runtimeFlags,
      runtimeInventory,
      runtimeQuestLog,
      runtimeActionLog,
      seenEnterSceneKeys,
      usedHotspotIds,
    };
    setDevSnapshots((items) => [snapshot, ...items].slice(0, 8));
    logRuntimeAction("Save Snapshot", snapshot.label);
  };

  const loadDevSnapshot = (snapshot: DevSnapshot) => {
    setRuntimeFlags(snapshot.runtimeFlags || {});
    setRuntimeInventory(snapshot.runtimeInventory || []);
    setRuntimeQuestLog(snapshot.runtimeQuestLog || []);
    setRuntimeActionLog(snapshot.runtimeActionLog || []);
    setSeenEnterSceneKeys(snapshot.seenEnterSceneKeys || {});
    setUsedHotspotIds(snapshot.usedHotspotIds || {});
    logRuntimeAction("Load Snapshot", snapshot.label);
    jumpLocationForDev(snapshot.realmId, snapshot.locationId);
  };

  const clearPersistentRuntimeState = async () => {
    setRuntimeFlags({});
    setRuntimeInventory([]);
    setRuntimeQuestLog([]);
    setRuntimeActionLog([]);
    setSeenEnterSceneKeys({});
    setUsedHotspotIds({});
    setDevSnapshots([]);
    setActiveDialogue(null);
    setDialogueIndex(0);
    setDialogueDismissed(true);
    await Promise.all([
      AsyncStorage.removeItem(RUNTIME_SAVE_KEY),
      AsyncStorage.removeItem(RUNTIME_SNAPSHOTS_KEY),
    ]).catch((e) => console.warn("[Barcadia] Could not clear dev save", e));
    setActionToast("Dev test save cleared");
    setTimeout(() => setActionToast(""), 2200);
  };

  const resetStoryTriggersForDev = () => {
    setSeenEnterSceneKeys({});
    setUsedHotspotIds({});
    setActiveDialogue(null);
    setDialogueIndex(0);
    setDialogueDismissed(true);
    logRuntimeAction("Reset Story Triggers", "Enter-location scenes and one-time hotspots can replay.");
  };

  const returnToScene = () => {
    setDialogueIndex(0);
    setDialogueDismissed(false);
    setMode("scene");
  };

  if (mode === "computer")
    return <ComputerScreen onBack={() => setMode("scene")} />;
  if (mode === "rest") return <RestScreen onBack={() => setMode("scene")} />;

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.cyan} />
        <Text style={styles.muted}>Locating realm...</Text>
      </View>
    );
  }

  const isHotspotAvailable = (hotspot: RealmHotspot) => {
    const hotspotId = String(hotspot.id || "");
    if (hotspotId && usedHotspotIds[hotspotId]) return false;
    const requiredFlag = (hotspot as any).condition_flag || (hotspot as any).required_flag;
    if (!requiredFlag) return true;
    const expected = (hotspot as any).condition_value ?? true;
    return runtimeFlags[requiredFlag] === expected;
  };

  const adminHotspots = coerceHotspots(data?.location?.hotspots).filter(isHotspotAvailable);
  const dialogueToShow =
    activeDialogue && !dialogueDismissed ? activeDialogue.lines : null;

  return (
    <ImageBackground source={image} style={styles.bg} resizeMode="cover">
      <Animated.View style={[styles.sceneLayer, { opacity: fade }]}>
        <LinearGradient
          colors={["rgba(0,0,0,0.08)", "rgba(0,0,0,0.08)", "rgba(0,0,0,0.42)"]}
          style={styles.overlay}
        >
          <View style={styles.content}>
            <View style={styles.locationBadge}>
              <Text style={styles.locationName}>
                {data?.location?.name ||
                  (isReal ? "Bedroom" : "Whisperwood Forest")}
              </Text>
              <Text style={[styles.realmName, { color: accent }]}>
                {data?.realm?.label ||
                  (isReal ? "Real World" : "Fantasy Realm")}
              </Text>
            </View>

            {!dialogueToShow
              ? adminHotspots.map((hotspot, idx) => (
                  <PercentHotspot
                    key={hotspot.id || `${hotspot.label}-${idx}`}
                    hotspot={hotspot}
                    onPress={() => handleHotspot(hotspot)}
                  />
                ))
              : null}

            {error ? (
              <View style={styles.warning}>
                <Text style={styles.warningText}>
                  Using local realm data. {error}
                </Text>
              </View>
            ) : null}
            {dialogueToShow ? (
              <DialogueBox
                lines={dialogueToShow}
                index={dialogueIndex}
                choices={activeDialogue?.choices || []}
                choicePrompt={activeDialogue?.choicePrompt}
                characters={data?.story_characters || []}
                onNext={() => advanceDialogue(dialogueToShow)}
                onChoice={chooseDialogueOption}
              />
            ) : null}
          </View>
        </LinearGradient>
      </Animated.View>
      {__DEV__ ? (
        <TouchableOpacity
          activeOpacity={0.86}
          style={styles.devFab}
          onPress={() => setDevOpen(true)}
        >
          <Text style={styles.devFabText}>DEV</Text>
        </TouchableOpacity>
      ) : null}
      {__DEV__ ? (
        <DevModePanel
          visible={devOpen}
          onClose={() => setDevOpen(false)}
          data={data}
          currentSceneId={activeDialogue?.scene_id}
          snapshots={devSnapshots}
          onJumpLocation={jumpLocationForDev}
          onPlayScene={playStorySceneById}
          onReplayLocationScene={replayEnterLocationStory}
          onClearDialogue={clearActiveDialogueForDev}
          onResetStart={resetToBedroomForDev}
          onSaveSnapshot={saveDevSnapshot}
          onLoadSnapshot={loadDevSnapshot}
          onClearPersistentState={clearPersistentRuntimeState}
          onResetStoryTriggers={resetStoryTriggersForDev}
          runtimeFlags={runtimeFlags}
          inventory={runtimeInventory}
          questLog={runtimeQuestLog}
          actionLog={runtimeActionLog}
          onToggleFlag={(flagId) =>
            setRuntimeFlags((flags) => ({ ...flags, [flagId]: !Boolean(flags[flagId]) }))
          }
          qaIssues={runtimeQaIssues}
          onRunRuntimeQA={runRuntimeQaCheck}
        />
      ) : null}
      {actionToast ? (
        <View style={styles.actionToast} pointerEvents="none">
          <Text style={styles.actionToastText}>{actionToast}</Text>
        </View>
      ) : null}
      {transitionLabel ? <TransitionOverlay label={transitionLabel} /> : null}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#05070D" },
  sceneLayer: { flex: 1, backgroundColor: "transparent" },
  overlay: { flex: 1 },
  overlayCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  content: { flex: 1, paddingTop: 0, paddingHorizontal: 0, paddingBottom: 0 },
  center: {
    flex: 1,
    backgroundColor: "#05070D",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  muted: { color: "#A0AEC0", fontWeight: "800" },
  locationBadge: {
    position: "absolute",
    top: 78,
    left: 18,
    zIndex: 5,
    maxWidth: "82%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "rgba(4,8,16,0.60)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
  },
  locationName: {
    color: "#fff",
    fontSize: 22,
    lineHeight: 25,
    fontWeight: "900",
    letterSpacing: 0.5,
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowRadius: 8,
  },
  realmName: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  warning: {
    position: "absolute",
    top: 138,
    left: 18,
    right: 18,
    zIndex: 5,
    borderRadius: 14,
    padding: 10,
    backgroundColor: "rgba(120,30,30,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,120,120,0.35)",
  },
  warningText: { color: "#FFD8D8", fontSize: 12, fontWeight: "800" },
  devFab: {
    position: "absolute",
    right: 18,
    top: 76,
    zIndex: 40,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "rgba(126,34,206,0.88)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.72)",
    shadowColor: "#A855F7",
    shadowOpacity: 0.7,
    shadowRadius: 16,
    elevation: 12,
  },
  devFabText: {
    color: "#FEF3C7",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
  devModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
  },
  devPanel: {
    width: "96%",
    maxHeight: "90%",
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "rgba(8,5,18,0.98)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.42)",
  },
  devHeader: {
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(61,13,94,0.55)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(250,204,21,0.22)",
  },
  devKicker: {
    color: "#C4B5FD",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  devTitle: { color: "#FEF3C7", fontSize: 22, fontWeight: "900", marginTop: 2 },
  devClose: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: "rgba(15,23,42,0.78)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.35)",
  },
  devCloseText: { color: "#FEF3C7", fontSize: 13, fontWeight: "900" },
  devBody: { maxHeight: "100%" },
  devBodyContent: { padding: 14, gap: 12, paddingBottom: 24 },
  devStatusGrid: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  devStatusCard: {
    flexGrow: 1,
    minWidth: "30%",
    borderRadius: 14,
    padding: 11,
    backgroundColor: "rgba(255,255,255,0.045)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.18)",
  },
  devStatusLabel: {
    color: "#C4B5FD",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  devStatusValue: {
    color: "#FDE68A",
    fontSize: 13,
    fontWeight: "900",
    marginTop: 4,
  },
  devSection: {
    borderRadius: 16,
    padding: 12,
    backgroundColor: "rgba(2,6,23,0.62)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.18)",
    gap: 8,
  },
  devSectionTitle: { color: "#FEF3C7", fontSize: 16, fontWeight: "900" },
  devInput: {
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 12,
    color: "#E5E7EB",
    backgroundColor: "rgba(2,6,23,0.92)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.24)",
    fontWeight: "800",
  },
  devList: { gap: 7 },
  devRow: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 13,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  devRowTitle: { color: "#F8FAFC", fontSize: 13, fontWeight: "900" },
  devRowMeta: {
    color: "#A7B3C7",
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2,
  },
  devRowAction: { color: "#86EFAC", fontSize: 12, fontWeight: "900" },
  devEmpty: {
    color: "#A7B3C7",
    fontSize: 12,
    fontWeight: "800",
    paddingVertical: 8,
  },
  devButtonGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  devButton: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(88,28,135,0.65)",
    borderWidth: 1,
    borderColor: "rgba(216,180,254,0.38)",
  },
  devDangerButton: {
    backgroundColor: "rgba(127,29,29,0.58)",
    borderColor: "rgba(248,113,113,0.42)",
  },
  devButtonText: { color: "#FEF3C7", fontSize: 12, fontWeight: "900" },
  devHint: {
    color: "#A7B3C7",
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 15,
  },
  devSnapshot: {
    borderRadius: 12,
    padding: 10,
    backgroundColor: "rgba(20,83,45,0.24)",
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.24)",
  },

  devSectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  devMiniButton: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(14,165,233,0.18)",
    borderWidth: 1,
    borderColor: "rgba(125,211,252,0.42)",
  },
  devMiniButtonText: { color: "#BAE6FD", fontSize: 11, fontWeight: "900" },
  devQaRow: {
    minHeight: 42,
    borderRadius: 12,
    padding: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    borderWidth: 1,
  },
  devQaOk: {
    backgroundColor: "rgba(20,83,45,0.22)",
    borderColor: "rgba(74,222,128,0.24)",
  },
  devQaWarn: {
    backgroundColor: "rgba(120,53,15,0.24)",
    borderColor: "rgba(251,191,36,0.26)",
  },
  devQaBad: {
    backgroundColor: "rgba(127,29,29,0.30)",
    borderColor: "rgba(248,113,113,0.34)",
  },
  devQaBadge: {
    width: 42,
    textAlign: "center",
    color: "#FEF3C7",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 0.8,
  },

  devTestingSteps: {
    gap: 8,
    marginBottom: 10,
  },
  devTestingStep: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    borderWidth: 1,
    borderColor: "rgba(251,191,36,0.18)",
    backgroundColor: "rgba(15,23,42,0.56)",
    borderRadius: 14,
    padding: 10,
  },
  devTestingStepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: "center",
    textAlignVertical: "center",
    color: "#2A1608",
    backgroundColor: "#FBBF24",
    fontWeight: "900",
    overflow: "hidden",
  },

  devRuntimeGrid: { gap: 10 },
  devRuntimeBox: {
    borderRadius: 14,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.16)",
    gap: 6,
  },
  devRuntimeTitle: {
    color: "#FDE68A",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  devRuntimeRow: {
    minHeight: 32,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: "rgba(2,6,23,0.58)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  devRuntimeAction: {
    borderRadius: 10,
    padding: 8,
    backgroundColor: "rgba(2,6,23,0.58)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  devRuntimeKey: { color: "#E5E7EB", fontSize: 11, fontWeight: "900", flex: 1 },
  devRuntimeValue: { color: "#86EFAC", fontSize: 11, fontWeight: "900" },
  actionToast: {
    position: "absolute",
    left: 18,
    right: 18,
    top: 128,
    zIndex: 50,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: "rgba(8,5,18,0.92)",
    borderWidth: 1,
    borderColor: "rgba(250,204,21,0.46)",
    shadowColor: "#A855F7",
    shadowOpacity: 0.55,
    shadowRadius: 18,
  },
  actionToastText: { color: "#FEF3C7", fontSize: 12, fontWeight: "900", textAlign: "center" },
  hotspot: {
    position: "absolute",
    width: 92,
    minHeight: 76,
    marginLeft: -46,
    marginTop: -38,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 8,
  },
  hotspotCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.94)",
    shadowColor: "#22D3EE",
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 9,
  },
  hotspotIcon: { color: "#fff", fontSize: 22, fontWeight: "900" },
  hotspotLabel: {
    marginTop: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: "rgba(2,6,23,0.72)",
    color: "#E0F7FF",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  transitionOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 30 },
  transitionPanel: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  transitionRing: {
    width: 122,
    height: 122,
    borderRadius: 61,
    borderWidth: 2,
    borderColor: "rgba(56,189,248,0.55)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#22D3EE",
    shadowOpacity: 0.7,
    shadowRadius: 24,
  },
  transitionCore: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.72)",
    backgroundColor: "rgba(14,165,233,0.12)",
  },
  transitionText: {
    color: "#E0F7FF",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  transitionBarOuter: {
    width: 210,
    height: 7,
    borderRadius: 99,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.10)",
  },
  transitionBarInner: {
    width: "72%",
    height: "100%",
    backgroundColor: "#22D3EE",
  },
  miniBack: {
    position: "absolute",
    top: 54,
    left: 18,
    zIndex: 5,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: "rgba(3,7,18,0.62)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  miniBackText: { color: "white", fontSize: 13, fontWeight: "900" },
  dialogueWrap: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 22,
    zIndex: 18,
  },
  dialogueBox: {
    minHeight: 124,
    borderRadius: 20,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(3,10,22,0.90)",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.46)",
    shadowColor: "#22D3EE",
    shadowOpacity: 0.28,
    shadowRadius: 18,
  },
  dialoguePortrait: {
    width: 64,
    height: 64,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.5)",
    backgroundColor: "rgba(14,165,233,0.14)",
    marginRight: 14,
    overflow: "hidden",
  },
  dialoguePortraitImage: { width: "100%", height: "100%", resizeMode: "cover" },
  dialogueSigilText: { color: "#7DD3FC", fontSize: 28, fontWeight: "900" },
  dialogueTextWrap: { flex: 1 },
  dialogueSpeaker: {
    color: "#67E8F9",
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 5,
  },
  dialogueBody: {
    color: "#EAF6FF",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },
  dialogueAdvance: {
    color: "#67E8F9",
    fontSize: 28,
    fontWeight: "900",
    marginLeft: 8,
    alignSelf: "flex-end",
  },
  choicePanel: {
    marginTop: 8,
    gap: 8,
    padding: 10,
    borderRadius: 18,
    backgroundColor: "rgba(4,8,16,0.84)",
    borderWidth: 1,
    borderColor: "rgba(125,211,252,0.28)",
  },
  choiceButton: {
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: "rgba(14,165,233,0.18)",
    borderWidth: 1,
    borderColor: "rgba(125,211,252,0.42)",
  },
  choiceButtonText: { color: "#EAF6FF", fontSize: 14, fontWeight: "900" },
  resultPanel: {
    width: "92%",
    borderRadius: 22,
    padding: 20,
    alignItems: "center",
    backgroundColor: "rgba(3,10,22,0.88)",
    borderWidth: 1,
    borderColor: "rgba(52,211,153,0.45)",
  },
  resultIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(34,197,94,0.18)",
    borderWidth: 1,
    borderColor: "rgba(74,222,128,0.55)",
    marginBottom: 12,
  },
  resultIconText: { color: "#86EFAC", fontSize: 36, fontWeight: "900" },
  resultTitle: { color: "white", fontSize: 24, fontWeight: "900" },
  resultText: {
    color: "#CBD5E1",
    fontSize: 14,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  statLine: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 9,
  },
  statLabel: { width: 52, color: "#DDEBFF", fontSize: 14, fontWeight: "900" },
  greenBar: {
    flex: 1,
    height: 10,
    borderRadius: 99,
    backgroundColor: "#22C55E",
  },
  blueBar: {
    flex: 1,
    height: 10,
    borderRadius: 99,
    backgroundColor: "#38BDF8",
  },
  panelButton: {
    marginTop: 20,
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 12,
    backgroundColor: "rgba(14,165,233,0.22)",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.55)",
  },
  panelButtonText: {
    color: "#E0F7FF",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1,
  },
  computerRoot: {
    flex: 1,
    backgroundColor: "#030712",
    paddingTop: 42,
    paddingHorizontal: 12,
    paddingBottom: 112,
  },
  computerPanel: {
    flex: 1,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.22)",
  },
  desktopTopBar: {
    height: 40,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(3,12,24,0.95)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.10)",
  },
  osTitle: {
    color: "#7DD3FC",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 3,
  },
  osClock: { color: "#CBD5E1", fontSize: 11, fontWeight: "800" },
  desktopBody: { flex: 1, flexDirection: "row" },
  desktopSidebar: {
    width: 68,
    paddingTop: 12,
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.035)",
    borderRightWidth: 1,
    borderRightColor: "rgba(255,255,255,0.09)",
  },
  desktopAppIcon: { alignItems: "center", gap: 3 },
  desktopEmoji: { fontSize: 20 },
  desktopLabel: { color: "#B7C5D8", fontSize: 8, fontWeight: "800" },
  mailWindow: {
    flex: 1,
    margin: 10,
    borderRadius: 12,
    backgroundColor: "rgba(6,16,31,0.92)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    overflow: "hidden",
  },
  browserBar: {
    height: 34,
    justifyContent: "center",
    paddingHorizontal: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  browserUrl: { color: "#CBD5E1", fontSize: 10, fontWeight: "700" },
  mailTitle: {
    color: "white",
    fontSize: 18,
    fontWeight: "900",
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  mailLayout: { flex: 1, flexDirection: "row", padding: 10, gap: 10 },
  mailList: { flex: 0.95, gap: 8 },
  mailItem: {
    borderRadius: 10,
    padding: 9,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  mailItemActive: {
    backgroundColor: "rgba(14,165,233,0.18)",
    borderColor: "rgba(56,189,248,0.42)",
  },
  mailFrom: { color: "#E2E8F0", fontSize: 10, fontWeight: "900" },
  mailSubject: {
    color: "#AFC2D8",
    fontSize: 9,
    fontWeight: "700",
    marginTop: 3,
  },
  mailPreview: {
    flex: 1.1,
    borderRadius: 10,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  previewTitle: { color: "#fff", fontSize: 12, fontWeight: "900" },
  previewMeta: {
    color: "#94A3B8",
    fontSize: 9,
    fontWeight: "700",
    marginTop: 5,
  },
  previewBody: {
    color: "#D8E1EF",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 10,
    fontWeight: "600",
  },
  attachment: {
    marginTop: 10,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  attachmentText: { color: "#DDEBFF", fontSize: 9, fontWeight: "800" },
  backButton: {
    position: "absolute",
    left: 20,
    right: 20,
    bottom: 28,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(14,165,233,0.20)",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.60)",
  },
  backButtonText: {
    color: "#E0F7FF",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: 1.1,
  },
});
