import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Image, ImageBackground, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "expo-router";
import { api, RealmHotspot, RealmPayload, StoryCharacter, StoryScene, StorySceneChoice } from "@/src/lib/api";
import { COLORS } from "@/src/lib/theme";

const BACKEND_BASE = process.env.EXPO_PUBLIC_BACKEND_URL?.replace(/\/api$/, "") || "";

const REALM_IMAGE_SOURCES: Record<string, any> = {
  "asset:realms/bedroom.png": require("../../assets/images/realms/bedroom_clean.png"),
  "asset:realms/bedroom_clean.png": require("../../assets/images/realms/bedroom_clean.png"),
  "asset:realms/bedroom_window_day.png": require("../../assets/images/realms/bedroom_window_day.png"),
  "asset:realms/kitchen_day.png": require("../../assets/images/realms/kitchen_day.png"),
  "asset:realms/whisperwood_beacon.png": require("../../assets/images/realms/whisperwood_beacon_clean.png"),
  "asset:realms/whisperwood_beacon_clean.png": require("../../assets/images/realms/whisperwood_beacon_clean.png"),
};

const CHARACTER_IMAGE_SOURCES: Record<string, any> = {
  mom: require("../../assets/images/characters/mom_avatar.png"),
  mom_avatar: require("../../assets/images/characters/mom_avatar.png"),
};

function normalizeKey(value?: string): string {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function characterBySpeaker(characters: StoryCharacter[] | undefined, speaker?: string): StoryCharacter | undefined {
  const key = normalizeKey(speaker);
  if (!key || !Array.isArray(characters)) return undefined;
  return characters.find((c) => normalizeKey(c.id) === key || normalizeKey(c.name) === key);
}

function displaySpeaker(speaker?: string, characters?: StoryCharacter[]): string {
  const raw = String(speaker || "").trim();
  if (!raw) return "Narration";
  const c = characterBySpeaker(characters, raw);
  return c?.name || raw.replace(/^new_character_\d+$/, "Character");
}

function portraitKeyForSpeaker(speaker?: string, portrait?: string, characters?: StoryCharacter[]): string {
  const c = characterBySpeaker(characters, speaker);
  return normalizeKey(String(portrait || c?.portrait || c?.avatar || c?.name || speaker || ""));
}


type WorldMode = "scene" | "computer" | "rest";

type DialogueLine = {
  speaker?: string;
  body: string;
  portrait?: string;
  emotion?: string;
};

type ActiveDialogue = { lines: DialogueLine[]; choices?: StorySceneChoice[]; scene_id?: string; choicePrompt?: string } | null;

function imageSource(image?: string): any {
  if (!image) return REALM_IMAGE_SOURCES["asset:realms/bedroom.png"];
  if (REALM_IMAGE_SOURCES[image]) return REALM_IMAGE_SOURCES[image];
  if (image.startsWith("http")) return { uri: image };
  if (image.startsWith("asset:")) return { uri: `${BACKEND_BASE}/assets/${image.replace("asset:", "")}` };
  if (image.startsWith("/")) return { uri: `${BACKEND_BASE}${image}` };
  return REALM_IMAGE_SOURCES["asset:realms/bedroom.png"];
}

function PercentHotspot({ hotspot, onPress }: { hotspot: RealmHotspot; onPress: () => void }) {
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
        <Text style={styles.hotspotIcon}>{hotspot.icon || iconForHotspot(hotspot)}</Text>
      </View>
      <Text style={styles.hotspotLabel}>{hotspot.label || hotspot.id || "Hotspot"}</Text>
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
    speaker: line?.speaker || (line?.type === "narration" ? "Narration" : undefined),
    body: String(line?.body ?? line?.text ?? ""),
    portrait: line?.portrait,
    emotion: line?.emotion,
  };
}

function linesForStoryScene(scene?: StoryScene | null): DialogueLine[] {
  if (!scene) return [];
  const rawLines = Array.isArray(scene.lines) ? scene.lines : Array.isArray(scene.dialogue_lines) ? scene.dialogue_lines : [];
  const lines = rawLines.map(normalizeStoryLine).filter((line) => line.body.trim().length > 0);
  if (lines.length) return lines;
  return [{ speaker: "Narration", body: scene.title ? `Story scene: ${scene.title}` : "A story scene begins..." }];
}

function choicesForStoryScene(scene?: StoryScene | null): StorySceneChoice[] {
  return Array.isArray(scene?.choices) ? scene!.choices!.filter((choice) => (choice.text || "").trim().length > 0) : [];
}

function choicePromptForStoryScene(scene?: StoryScene | null): string {
  return String(scene?.choice_prompt || "What do you do?");
}

function findStoryScene(scenes: StoryScene[] | undefined, id?: string): StoryScene | undefined {
  if (!id || !Array.isArray(scenes)) return undefined;
  return scenes.find((scene) => scene.id === id || scene.title === id);
}

function firstEnterLocationScene(scenes: StoryScene[] | undefined): StoryScene | undefined {
  if (!Array.isArray(scenes)) return undefined;
  return scenes.find((scene) => (scene.trigger_type || "").toLowerCase() === "enter_location") || scenes[0];
}

function coerceHotspots(raw: any): RealmHotspot[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((h, i) => typeof h === "string" ? ({ id: h.toLowerCase().replace(/[^a-z0-9]+/g, "_"), label: h, x_pct: 20 + i * 15, y_pct: 50, width_pct: 12, height_pct: 10, action_type: "inspect" }) : h)
    .filter((h) => h && !h.archived);
}

function TransitionOverlay({ label }: { label: string }) {
  return (
    <View pointerEvents="none" style={styles.transitionOverlay}>
      <LinearGradient colors={["rgba(2,6,23,0.98)", "rgba(4,22,42,0.96)", "rgba(2,6,23,0.98)"]} style={styles.transitionPanel}>
        <View style={styles.transitionRing}>
          <View style={styles.transitionCore} />
        </View>
        <Text style={styles.transitionText}>{label}</Text>
        <View style={styles.transitionBarOuter}><View style={styles.transitionBarInner} /></View>
      </LinearGradient>
    </View>
  );
}

function DialogueBox({ lines, index, choices = [], choicePrompt = "What do you do?", characters = [], onNext, onChoice }: { lines: DialogueLine[]; index: number; choices?: StorySceneChoice[]; choicePrompt?: string; characters?: StoryCharacter[]; onNext: () => void; onChoice: (choice: StorySceneChoice) => void }) {
  const showChoices = index >= lines.length && choices.length > 0;
  const line = showChoices ? lines[Math.max(0, lines.length - 1)] : (lines[index] || lines[0]);
  const activeSpeaker = showChoices ? "Your Choice" : displaySpeaker(line?.speaker, characters);
  const portraitKey = portraitKeyForSpeaker(line?.speaker, line?.portrait, characters);
  const portraitSource = CHARACTER_IMAGE_SOURCES[portraitKey];
  return (
    <View style={styles.dialogueWrap}>
      <TouchableOpacity activeOpacity={0.9} onPress={onNext} style={styles.dialogueBox}>
        <View style={styles.dialoguePortrait}>
          {!showChoices && portraitSource ? (
            <Image source={portraitSource} style={styles.dialoguePortraitImage} />
          ) : (
            <Text style={styles.dialogueSigilText}>{showChoices ? "?" : "✦"}</Text>
          )}
        </View>
        <View style={styles.dialogueTextWrap}>
          <Text style={styles.dialogueSpeaker}>{activeSpeaker}</Text>
          <Text style={styles.dialogueBody}>{showChoices ? choicePrompt : line.body}</Text>
        </View>
        {!showChoices ? <Text style={styles.dialogueAdvance}>⌄</Text> : null}
      </TouchableOpacity>
      {showChoices ? (
        <View style={styles.choicePanel}>
          {choices.map((choice, choiceIndex) => (
            <TouchableOpacity key={`${choice.text || "choice"}-${choiceIndex}`} style={styles.choiceButton} activeOpacity={0.86} onPress={() => onChoice(choice)}>
              <Text style={styles.choiceButtonText}>{choice.text || "Continue"}</Text>
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
      <LinearGradient colors={["#06111F", "#02050C"]} style={styles.computerPanel}>
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
              <Text style={styles.browserUrl}>https://mail.mythnet.local/inbox</Text>
            </View>
            <Text style={styles.mailTitle}>ArcMail Inbox</Text>
            <View style={styles.mailLayout}>
              <View style={styles.mailList}>
                <View style={[styles.mailItem, styles.mailItemActive]}>
                  <Text style={styles.mailFrom}>Guild Headquarters</Text>
                  <Text style={styles.mailSubject}>Mission Briefing — Whisperwood</Text>
                </View>
                <View style={styles.mailItem}>
                  <Text style={styles.mailFrom}>Merchant Alliance</Text>
                  <Text style={styles.mailSubject}>New Trade Opportunities</Text>
                </View>
                <View style={styles.mailItem}>
                  <Text style={styles.mailFrom}>Explorer's Journal</Text>
                  <Text style={styles.mailSubject}>Notes from the Whisperwood</Text>
                </View>
              </View>
              <View style={styles.mailPreview}>
                <Text style={styles.previewTitle}>Mission Briefing — Whisperwood</Text>
                <Text style={styles.previewMeta}>From: Guild Headquarters</Text>
                <Text style={styles.previewBody}>
                  Adventurer,{"\n\n"}
                  We received reports of unusual interference coming from deep within Whisperwood Forest.{"\n\n"}
                  Review the attached briefing before you investigate the beacon.
                </Text>
                <View style={styles.attachment}><Text style={styles.attachmentText}>📎 whisperwood_briefing.pdf</Text></View>
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>

      <TouchableOpacity onPress={onBack} activeOpacity={0.86} style={styles.backButton}>
        <Text style={styles.backButtonText}>← BACK</Text>
      </TouchableOpacity>
    </View>
  );
}

function RestScreen({ onBack }: { onBack: () => void }) {
  return (
    <ImageBackground source={REALM_IMAGE_SOURCES["asset:realms/bedroom.png"]} style={styles.bg} resizeMode="cover">
      <LinearGradient colors={["rgba(0,0,0,0.28)", "rgba(0,0,0,0.46)"]} style={styles.overlayCenter}>
        <View style={styles.resultPanel}>
          <View style={styles.resultIcon}><Text style={styles.resultIconText}>♥</Text></View>
          <Text style={styles.resultTitle}>Rest Complete</Text>
          <Text style={styles.resultText}>You feel refreshed. HP and Mana have been restored.</Text>
          <View style={styles.statLine}><Text style={styles.statLabel}>HP</Text><View style={styles.greenBar} /></View>
          <View style={styles.statLine}><Text style={styles.statLabel}>Mana</Text><View style={styles.blueBar} /></View>
          <TouchableOpacity onPress={onBack} style={styles.panelButton}><Text style={styles.panelButtonText}>Return</Text></TouchableOpacity>
        </View>
      </LinearGradient>
    </ImageBackground>
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

  useFocusEffect(useCallback(() => { setMode("scene"); setDialogueIndex(0);
      setDialogueDismissed(false); setActiveDialogue(null); load(); }, [load]));

  useEffect(() => {
    if (!data?.current_location_id || !data.active_story_scenes?.length) return;
    const scene = firstEnterLocationScene(data.active_story_scenes);
    if (!scene?.id) return;
    setActiveDialogue({ lines: linesForStoryScene(scene), choices: choicesForStoryScene(scene), choicePrompt: choicePromptForStoryScene(scene), scene_id: scene.id });
    setDialogueIndex(0);
    setDialogueDismissed(false);
  }, [data?.current_location_id, data?.active_story_scenes]);

  const isReal = data?.current_realm !== "fantasy";
  const accent = data?.realm?.accent || (isReal ? "#38BDF8" : "#A855F7");
  const image = useMemo(() => imageSource(data?.location?.image || (isReal ? "asset:realms/bedroom.png" : "asset:realms/whisperwood_beacon.png")), [data, isReal]);

  const openMode = (nextMode: WorldMode, label: string) => {
    setTransitionLabel(label);
    Animated.sequence([
      Animated.timing(fade, { toValue: 0.25, duration: 280, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 360, useNativeDriver: true }),
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
    try { await api.restAtHome(); } catch {}
    setTimeout(() => { setMode("rest"); setTransitionLabel(""); }, 640);
  };

  const traverseToLocation = async (locationId: string, label = "Moving...") => {
    if (!data?.current_realm || !locationId) return;
    setTransitionLabel(label);
    try {
      const next = await api.traverseRealm(data.current_realm, locationId);
      setData(next);
      setMode("scene");
      setDialogueIndex(0);
      setDialogueDismissed(false);
      setActiveDialogue(null);
    } catch (e: any) {
      setError(e.message || "Could not change scene.");
    } finally {
      setTimeout(() => setTransitionLabel(""), 360);
    }
  };

  const openDialogueForHotspot = (hotspot: RealmHotspot) => {
    const label = hotspot.label || "Narration";
    const linkedSceneId = hotspot.story_scene_id || hotspot.linked_dialogue;
    const linkedScene = findStoryScene(data?.story_scenes, linkedSceneId);
    const lines = linkedScene
      ? linesForStoryScene(linkedScene)
      : label.toLowerCase().includes("mom")
        ? kitchenLines
        : [{ speaker: label, body: `You inspect ${label}.` }];
    setActiveDialogue({ lines, choices: choicesForStoryScene(linkedScene), choicePrompt: choicePromptForStoryScene(linkedScene), scene_id: linkedScene?.id });
    setDialogueIndex(0);
    setDialogueDismissed(false);
  };

  const handleHotspot = (hotspot: RealmHotspot) => {
    if (activeDialogue && !dialogueDismissed) return;
    const action = hotspot.action_type || "inspect";
    if (action === "open_computer") return openMode("computer", "Opening Computer...");
    if (action === "rest") return rest();
    if (action === "change_scene") return traverseToLocation(hotspot.linked_location || hotspot.target_id || "", `Going to ${hotspot.label || "location"}...`);
    if (action === "open_dialogue") return openDialogueForHotspot(hotspot);
    if (action === "give_item") return openDialogueForHotspot({ ...hotspot, label: hotspot.label || "Item" });
    return openDialogueForHotspot(hotspot);
  };

  const windowLines: DialogueLine[] = [
    { body: "You gaze out from the second floor. The sun shines brightly over a cozy town below, and the streets move with quiet daytime life." },
    { body: "People walk along the sidewalks, a few cars roll by, and white clouds drift lazily over the distant hills." },
  ];

  const kitchenLines: DialogueLine[] = [
    { speaker: "Narration", body: "The kitchen is warm and familiar. The smell of something home-cooked lingers in the air." },
    { speaker: "Mom", body: "Hey there. You're just in time — I was about to make something. How was your day?" },
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
    setDialogueDismissed(true);
  };

  const chooseDialogueOption = (choice: StorySceneChoice) => {
    if ((choice.action_type || "").toLowerCase() === "change_scene" && choice.linked_location) {
      setActiveDialogue(null);
      setDialogueDismissed(true);
      return traverseToLocation(choice.linked_location, `Going to ${choice.linked_location}...`);
    }
    const nextId = choice.next_id || choice.next_scene_id || choice.story_scene_id;
    const nextScene = findStoryScene(data?.story_scenes, nextId);
    if (nextScene) {
      setActiveDialogue({ lines: linesForStoryScene(nextScene), choices: choicesForStoryScene(nextScene), choicePrompt: choicePromptForStoryScene(nextScene), scene_id: nextScene.id });
      setDialogueIndex(0);
      setDialogueDismissed(false);
      return;
    }
    setDialogueDismissed(true);
  };

  const returnToScene = () => {
    setDialogueIndex(0);
    setDialogueDismissed(false);
    setMode("scene");
  };

  if (mode === "computer") return <ComputerScreen onBack={() => setMode("scene")} />;
  if (mode === "rest") return <RestScreen onBack={() => setMode("scene")} />;

  if (loading && !data) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.cyan} /><Text style={styles.muted}>Locating realm...</Text></View>;
  }

  const adminHotspots = coerceHotspots(data?.location?.hotspots);
  const dialogueToShow = activeDialogue && !dialogueDismissed ? activeDialogue.lines : null;

  return (
    <ImageBackground source={image} style={styles.bg} resizeMode="cover">
      <Animated.View style={[styles.sceneLayer, { opacity: fade }]}> 
        <LinearGradient colors={["rgba(0,0,0,0.08)", "rgba(0,0,0,0.08)", "rgba(0,0,0,0.42)"]} style={styles.overlay}>
          <View style={styles.content}>
            <View style={styles.locationBadge}>
              <Text style={styles.locationName}>{data?.location?.name || (isReal ? "Bedroom" : "Whisperwood Forest")}</Text>
              <Text style={[styles.realmName, { color: accent }]}>{data?.realm?.label || (isReal ? "Real World" : "Fantasy Realm")}</Text>
            </View>

            {!dialogueToShow ? adminHotspots.map((hotspot, idx) => (
              <PercentHotspot key={hotspot.id || `${hotspot.label}-${idx}`} hotspot={hotspot} onPress={() => handleHotspot(hotspot)} />
            )) : null}

            {error ? <View style={styles.warning}><Text style={styles.warningText}>Using local realm data. {error}</Text></View> : null}
            {dialogueToShow ? <DialogueBox lines={dialogueToShow} index={dialogueIndex} choices={activeDialogue?.choices || []} choicePrompt={activeDialogue?.choicePrompt} characters={data?.story_characters || []} onNext={() => advanceDialogue(dialogueToShow)} onChoice={chooseDialogueOption} /> : null}
          </View>
        </LinearGradient>
      </Animated.View>
      {transitionLabel ? <TransitionOverlay label={transitionLabel} /> : null}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#05070D" },
  sceneLayer: { flex: 1, backgroundColor: "transparent" },
  overlay: { flex: 1 },
  overlayCenter: { flex: 1, alignItems: "center", justifyContent: "center", padding: 18 },
  content: { flex: 1, paddingTop: 0, paddingHorizontal: 0, paddingBottom: 0 },
  center: { flex: 1, backgroundColor: "#05070D", alignItems: "center", justifyContent: "center", gap: 12 },
  muted: { color: "#A0AEC0", fontWeight: "800" },
  locationBadge: { position: "absolute", top: 78, left: 18, zIndex: 5, maxWidth: "82%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16, backgroundColor: "rgba(4,8,16,0.60)", borderWidth: 1, borderColor: "rgba(255,255,255,0.13)" },
  locationName: { color: "#fff", fontSize: 22, lineHeight: 25, fontWeight: "900", letterSpacing: 0.5, textShadowColor: "rgba(0,0,0,0.9)", textShadowRadius: 8 },
  realmName: { marginTop: 2, fontSize: 11, fontWeight: "900", letterSpacing: 1.2, textTransform: "uppercase" },
  warning: { position: "absolute", top: 138, left: 18, right: 18, zIndex: 5, borderRadius: 14, padding: 10, backgroundColor: "rgba(120,30,30,0.55)", borderWidth: 1, borderColor: "rgba(255,120,120,0.35)" },
  warningText: { color: "#FFD8D8", fontSize: 12, fontWeight: "800" },
  hotspot: { position: "absolute", width: 92, minHeight: 76, marginLeft: -46, marginTop: -38, alignItems: "center", justifyContent: "center", zIndex: 8 },
  hotspotCircle: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "rgba(255,255,255,0.94)", shadowColor: "#22D3EE", shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 9 },
  hotspotIcon: { color: "#fff", fontSize: 22, fontWeight: "900" },
  hotspotLabel: { marginTop: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: "hidden", backgroundColor: "rgba(2,6,23,0.72)", color: "#E0F7FF", fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
  transitionOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 30 },
  transitionPanel: { flex: 1, alignItems: "center", justifyContent: "center", gap: 18 },
  transitionRing: { width: 122, height: 122, borderRadius: 61, borderWidth: 2, borderColor: "rgba(56,189,248,0.55)", alignItems: "center", justifyContent: "center", shadowColor: "#22D3EE", shadowOpacity: 0.7, shadowRadius: 24 },
  transitionCore: { width: 56, height: 56, borderRadius: 16, borderWidth: 2, borderColor: "rgba(255,255,255,0.72)", backgroundColor: "rgba(14,165,233,0.12)" },
  transitionText: { color: "#E0F7FF", fontSize: 18, fontWeight: "900", letterSpacing: 0.8 },
  transitionBarOuter: { width: 210, height: 7, borderRadius: 99, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.10)" },
  transitionBarInner: { width: "72%", height: "100%", backgroundColor: "#22D3EE" },
  miniBack: { position: "absolute", top: 54, left: 18, zIndex: 5, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: "rgba(3,7,18,0.62)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  miniBackText: { color: "white", fontSize: 13, fontWeight: "900" },
  dialogueWrap: { position: "absolute", left: 16, right: 16, bottom: 22, zIndex: 18 },
  dialogueBox: { minHeight: 124, borderRadius: 20, padding: 16, flexDirection: "row", alignItems: "center", backgroundColor: "rgba(3,10,22,0.90)", borderWidth: 1, borderColor: "rgba(56,189,248,0.46)", shadowColor: "#22D3EE", shadowOpacity: 0.28, shadowRadius: 18 },
  dialoguePortrait: { width: 64, height: 64, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(56,189,248,0.5)", backgroundColor: "rgba(14,165,233,0.14)", marginRight: 14, overflow: "hidden" },
  dialoguePortraitImage: { width: "100%", height: "100%", resizeMode: "cover" },
  dialogueSigilText: { color: "#7DD3FC", fontSize: 28, fontWeight: "900" },
  dialogueTextWrap: { flex: 1 },
  dialogueSpeaker: { color: "#67E8F9", fontSize: 16, fontWeight: "900", marginBottom: 5 },
  dialogueBody: { color: "#EAF6FF", fontSize: 14, lineHeight: 20, fontWeight: "700" },
  dialogueAdvance: { color: "#67E8F9", fontSize: 28, fontWeight: "900", marginLeft: 8, alignSelf: "flex-end" },
  choicePanel: { marginTop: 8, gap: 8, padding: 10, borderRadius: 18, backgroundColor: "rgba(4,8,16,0.84)", borderWidth: 1, borderColor: "rgba(125,211,252,0.28)" },
  choiceButton: { borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: "rgba(14,165,233,0.18)", borderWidth: 1, borderColor: "rgba(125,211,252,0.42)" },
  choiceButtonText: { color: "#EAF6FF", fontSize: 14, fontWeight: "900" },
  resultPanel: { width: "92%", borderRadius: 22, padding: 20, alignItems: "center", backgroundColor: "rgba(3,10,22,0.88)", borderWidth: 1, borderColor: "rgba(52,211,153,0.45)" },
  resultIcon: { width: 70, height: 70, borderRadius: 35, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(34,197,94,0.18)", borderWidth: 1, borderColor: "rgba(74,222,128,0.55)", marginBottom: 12 },
  resultIconText: { color: "#86EFAC", fontSize: 36, fontWeight: "900" },
  resultTitle: { color: "white", fontSize: 24, fontWeight: "900" },
  resultText: { color: "#CBD5E1", fontSize: 14, fontWeight: "700", textAlign: "center", marginTop: 8, marginBottom: 16 },
  statLine: { width: "100%", flexDirection: "row", alignItems: "center", gap: 10, marginTop: 9 },
  statLabel: { width: 52, color: "#DDEBFF", fontSize: 14, fontWeight: "900" },
  greenBar: { flex: 1, height: 10, borderRadius: 99, backgroundColor: "#22C55E" },
  blueBar: { flex: 1, height: 10, borderRadius: 99, backgroundColor: "#38BDF8" },
  panelButton: { marginTop: 20, borderRadius: 14, paddingHorizontal: 28, paddingVertical: 12, backgroundColor: "rgba(14,165,233,0.22)", borderWidth: 1, borderColor: "rgba(56,189,248,0.55)" },
  panelButtonText: { color: "#E0F7FF", fontSize: 14, fontWeight: "900", letterSpacing: 1 },
  computerRoot: { flex: 1, backgroundColor: "#030712", paddingTop: 42, paddingHorizontal: 12, paddingBottom: 112 },
  computerPanel: { flex: 1, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: "rgba(56,189,248,0.22)" },
  desktopTopBar: { height: 40, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "rgba(3,12,24,0.95)", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.10)" },
  osTitle: { color: "#7DD3FC", fontSize: 13, fontWeight: "900", letterSpacing: 3 },
  osClock: { color: "#CBD5E1", fontSize: 11, fontWeight: "800" },
  desktopBody: { flex: 1, flexDirection: "row" },
  desktopSidebar: { width: 68, paddingTop: 12, alignItems: "center", gap: 12, backgroundColor: "rgba(255,255,255,0.035)", borderRightWidth: 1, borderRightColor: "rgba(255,255,255,0.09)" },
  desktopAppIcon: { alignItems: "center", gap: 3 },
  desktopEmoji: { fontSize: 20 },
  desktopLabel: { color: "#B7C5D8", fontSize: 8, fontWeight: "800" },
  mailWindow: { flex: 1, margin: 10, borderRadius: 12, backgroundColor: "rgba(6,16,31,0.92)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", overflow: "hidden" },
  browserBar: { height: 34, justifyContent: "center", paddingHorizontal: 10, backgroundColor: "rgba(255,255,255,0.08)", borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.08)" },
  browserUrl: { color: "#CBD5E1", fontSize: 10, fontWeight: "700" },
  mailTitle: { color: "white", fontSize: 18, fontWeight: "900", paddingHorizontal: 12, paddingTop: 10 },
  mailLayout: { flex: 1, flexDirection: "row", padding: 10, gap: 10 },
  mailList: { flex: 0.95, gap: 8 },
  mailItem: { borderRadius: 10, padding: 9, backgroundColor: "rgba(255,255,255,0.05)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  mailItemActive: { backgroundColor: "rgba(14,165,233,0.18)", borderColor: "rgba(56,189,248,0.42)" },
  mailFrom: { color: "#E2E8F0", fontSize: 10, fontWeight: "900" },
  mailSubject: { color: "#AFC2D8", fontSize: 9, fontWeight: "700", marginTop: 3 },
  mailPreview: { flex: 1.1, borderRadius: 10, padding: 10, backgroundColor: "rgba(0,0,0,0.18)", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
  previewTitle: { color: "#fff", fontSize: 12, fontWeight: "900" },
  previewMeta: { color: "#94A3B8", fontSize: 9, fontWeight: "700", marginTop: 5 },
  previewBody: { color: "#D8E1EF", fontSize: 10, lineHeight: 15, marginTop: 10, fontWeight: "600" },
  attachment: { marginTop: 10, padding: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.06)" },
  attachmentText: { color: "#DDEBFF", fontSize: 9, fontWeight: "800" },
  backButton: { position: "absolute", left: 20, right: 20, bottom: 28, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(14,165,233,0.20)", borderWidth: 1, borderColor: "rgba(56,189,248,0.60)" },
  backButtonText: { color: "#E0F7FF", fontSize: 16, fontWeight: "900", letterSpacing: 1.1 },
});
