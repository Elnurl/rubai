import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GOAL_META, TEMPLATE_GOAL_TYPES } from "@/constants/atlas";
import { useColors } from "@/hooks/useColors";
import { useVoiceRecorder, type RecordedClip } from "@/hooks/useVoiceRecorder";
import { useAtlas } from "@/providers/AtlasProvider";
import { customFetch, useAtlasGenerateTitle, type GoalType } from "@workspace/api-client-react";

const EXAMPLE_PROMPTS = [
  "Get promoted in 9 months",
  "Run a half marathon by June",
  "Save $15,000 this year",
  "Ship a side project in 60 days",
];

const PLACEHOLDER_HINTS = [
  "e.g. Get promoted to senior engineer in 9 months",
  "e.g. Run my first half marathon by June",
  "e.g. Save $15,000 for a down payment this year",
  "e.g. Launch my freelance studio by October",
  "e.g. Read 30 books and journal weekly",
  "e.g. Move to Berlin and find a job by June",
  "e.g. Ship a side project in 60 days",
  "e.g. Learn Spanish to conversational level",
];

// ── Transcribe a recorded clip via Whisper ──────────────────────────────────
async function transcribeClip(clip: RecordedClip): Promise<string> {
  const form = new FormData();
  if (clip.kind === "web-blob") {
    form.append("audio", clip.blob, clip.filename);
  } else {
    form.append("audio", { uri: clip.uri, name: clip.filename, type: clip.mimeType } as unknown as Blob);
  }
  const data = await customFetch<{ text?: string }>("/api/atlas/transcribe", {
    method: "POST",
    body: form,
    responseType: "json",
  });
  return (data.text ?? "").trim();
}

export default function NewGoalScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setPendingDraft, canAddMoreGoals, goalLimit } = useAtlas();
  const generateTitle = useAtlasGenerateTitle();
  const recorder = useVoiceRecorder();

  const [selected, setSelected] = useState<GoalType | null>(null);
  const [customGoal, setCustomGoal] = useState("");
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const plusBtnRef = useRef<View>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number; w: number; h: number } | null>(null);

  const openAttachMenu = useCallback(() => {
    if (!canAddMoreGoals) return;
    plusBtnRef.current?.measureInWindow((x, y, w, h) => {
      setMenuAnchor({ x, y, w, h });
      setAttachMenuOpen(true);
    });
  }, [canAddMoreGoals]);

  // Typewriter animated placeholder
  const [typedHint, setTypedHint] = useState("");
  const [showCursor, setShowCursor] = useState(true);
  const hintIndexRef = useRef(0);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const clearAll = () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
    };

    const schedule = (fn: () => void, ms: number) => {
      const id = setTimeout(fn, ms);
      timeoutsRef.current.push(id);
    };

    const runCycle = () => {
      const hint = PLACEHOLDER_HINTS[hintIndexRef.current];
      // Type characters one by one
      for (let i = 0; i <= hint.length; i++) {
        const charDelay = i * 38;
        schedule(() => setTypedHint(hint.slice(0, i)), charDelay);
      }
      // Pause after fully typed, then erase
      const pauseStart = hint.length * 38 + 1800;
      for (let i = hint.length; i >= 0; i--) {
        const eraseDelay = pauseStart + (hint.length - i) * 22;
        schedule(() => setTypedHint(hint.slice(0, i)), eraseDelay);
      }
      // Move to next hint and repeat
      const nextStart = pauseStart + hint.length * 22 + 400;
      schedule(() => {
        hintIndexRef.current = (hintIndexRef.current + 1) % PLACEHOLDER_HINTS.length;
        runCycle();
      }, nextStart);
    };

    // Blinking cursor
    const cursorInterval = setInterval(() => setShowCursor((v) => !v), 530);

    runCycle();
    return () => {
      clearAll();
      clearInterval(cursorInterval);
    };
  }, []);

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 12 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom + 8;

  const customTrimmed = customGoal.trim();
  const hasCustom = customTrimmed.length > 0;
  const canSend = (hasCustom || selected !== null) && canAddMoreGoals;

  const isRecording = recorder.state === "recording";
  const isProcessing = recorder.state === "processing" || transcribing;

  // ── Continue / submit ───────────────────────────────────────────────────
  const onContinue = async () => {
    if (!canAddMoreGoals) return;
    if (hasCustom) {
      setIsGeneratingTitle(true);
      let aiTitle = customTrimmed.split(/\s+/).slice(0, 4).join(" ") || customTrimmed;
      try {
        const res = await generateTitle.mutateAsync({
          data: { goalType: "custom", userInput: customTrimmed },
        });
        if (res.title?.trim()) aiTitle = res.title.trim();
      } catch {
        // silent fallback
      } finally {
        setIsGeneratingTitle(false);
      }
      await setPendingDraft({
        goalType: "custom",
        goalTitle: customTrimmed,
        customGoalTitle: aiTitle,
        questions: [],
        answers: [],
        stage: "loading_questions",
      });
    } else if (selected) {
      await setPendingDraft({
        goalType: selected,
        goalTitle: GOAL_META[selected].label,
        questions: [],
        answers: [],
        stage: "loading_questions",
      });
    } else return;
    router.push("/intake");
  };

  // ── Template chip ────────────────────────────────────────────────────────
  const onPickTemplate = (g: GoalType) => {
    if (!canAddMoreGoals) return;
    setCustomGoal("");
    setSelected(g === selected ? null : g);
    inputRef.current?.blur();
  };

  const onExamplePress = (text: string) => {
    if (!canAddMoreGoals) return;
    setCustomGoal(text);
    setSelected(null);
    inputRef.current?.focus();
  };

  // ── Mic: record → transcribe → fill input ───────────────────────────────
  const onMicPress = useCallback(async () => {
    if (isProcessing) return;

    if (isRecording) {
      const clip = await recorder.stop();
      if (!clip) return;
      try {
        setTranscribing(true);
        const text = await transcribeClip(clip);
        if (text.length > 0) {
          setCustomGoal((prev) => (prev.trim() ? prev.trim() + " " + text : text));
          setSelected(null);
        }
      } catch {
        if (Platform.OS === "web") {
          window.alert(t("newGoal.transcribeFailed", "Could not transcribe audio."));
        } else {
          Alert.alert(t("newGoal.voice", "Voice"), t("newGoal.transcribeFailed", "Could not transcribe audio."));
        }
      } finally {
        setTranscribing(false);
      }
      return;
    }

    await recorder.start();
  }, [isProcessing, isRecording, recorder, t]);

  // ── Attach: camera ───────────────────────────────────────────────────────
  const pickFromCamera = useCallback(async () => {
    setAttachMenuOpen(false);
    if (Platform.OS === "web") {
      // Web: fallback to library
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6 });
      if (!res.canceled && res.assets?.[0]) {
        const name = res.assets[0].fileName ?? "photo";
        setCustomGoal((prev) => (prev.trim() ? prev : "") + (prev.trim() ? "\n" : "") + `[Photo: ${name}]`);
      }
      return;
    }
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t("newGoal.camera", "Camera"), t("newGoal.cameraPermission", "Allow camera access to take a photo."));
        return;
      }
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.6, allowsEditing: false });
      if (!res.canceled && res.assets?.[0]) {
        const name = res.assets[0].fileName ?? "photo.jpg";
        setCustomGoal((prev) => (prev.trim() ? prev.trim() + "\n" : "") + `[Photo: ${name}]`);
        setSelected(null);
      }
    } catch {
      // ignore
    }
  }, [t]);

  // ── Attach: gallery ──────────────────────────────────────────────────────
  const pickFromLibrary = useCallback(async () => {
    setAttachMenuOpen(false);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        if (Platform.OS !== "web") {
          Alert.alert(t("newGoal.photos", "Photos"), t("newGoal.photoPermission", "Allow photo access to attach an image."));
        }
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.6, allowsMultipleSelection: false });
      if (!res.canceled && res.assets?.[0]) {
        const name = res.assets[0].fileName ?? "image";
        setCustomGoal((prev) => (prev.trim() ? prev.trim() + "\n" : "") + `[Photo: ${name}]`);
        setSelected(null);
      }
    } catch {
      // ignore
    }
  }, [t]);

  // ── Attach: file ─────────────────────────────────────────────────────────
  const pickDocument = useCallback(async () => {
    setAttachMenuOpen(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "*/*", copyToCacheDirectory: false, multiple: false });
      if (result.canceled || !result.assets?.[0]) return;
      const { name } = result.assets[0];
      setCustomGoal((prev) => (prev.trim() ? prev.trim() + "\n" : "") + `[File: ${name}]`);
      setSelected(null);
    } catch {
      // ignore
    }
  }, []);

  // ── Mic button appearance ────────────────────────────────────────────────
  const micBg = isRecording ? colors.destructive : isProcessing ? colors.border : colors.card;
  const micIcon = isProcessing ? undefined : isRecording ? "mic-off" : "mic";

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          {t("newGoal.headerTitle", "Add a new goal")}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Limit banner */}
        {!canAddMoreGoals && (
          <View style={[styles.limitBanner, { backgroundColor: colors.destructive + "1A", borderColor: colors.destructive, borderRadius: colors.radius }]}>
            <Feather name="alert-triangle" size={16} color={colors.destructive} />
            <Text style={[styles.limitText, { color: colors.destructive, fontFamily: "Inter_500Medium" }]}>
              {goalLimit === 1
                ? t("newGoal.limitBannerOne", "You're at your plan limit of {{count}} active goal. Upgrade in Account or remove a goal first.", { count: goalLimit })
                : t("newGoal.limitBannerMany", "You're at your plan limit of {{count}} active goals. Upgrade in Account or remove a goal first.", { count: goalLimit })}
            </Text>
          </View>
        )}

        {/* Recording indicator */}
        {isRecording && (
          <View style={[styles.recordingBanner, { backgroundColor: colors.destructive + "18", borderColor: colors.destructive, borderRadius: colors.radius }]}>
            <View style={[styles.recordingDot, { backgroundColor: colors.destructive }]} />
            <Text style={[styles.recordingText, { color: colors.destructive, fontFamily: "Inter_600SemiBold" }]}>
              {t("newGoal.recording", "Recording… tap mic to stop")}
            </Text>
          </View>
        )}

        {/* ── HEADING ── */}
        <View style={styles.heroBlock}>
          <Text style={[styles.heroTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {t("newGoal.heroTitle", "Describe your new goal.")}
          </Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {t("newGoal.heroSub", "Tell rubai what you want to achieve and it will build a real plan around you.")}
          </Text>
        </View>

        {/* ── MAIN INPUT BOX ── */}
        <View
          style={[
            styles.inputBox,
            {
              backgroundColor: colors.card,
              borderColor: isRecording ? colors.destructive : inputFocused ? colors.primary : colors.border,
              borderRadius: colors.radius,
              opacity: canAddMoreGoals ? 1 : 0.5,
            },
          ]}
        >
          <View style={styles.inputInner}>
            {/* Typewriter placeholder — shown only when empty & not focused */}
            {customGoal.length === 0 && !inputFocused && (
              <Text
                style={[
                  styles.animatedPlaceholder,
                  { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
                ]}
                pointerEvents="none"
              >
                {typedHint}
                <Text style={{ opacity: showCursor ? 1 : 0, color: colors.primary }}>|</Text>
              </Text>
            )}
            <TextInput
              ref={inputRef}
              value={customGoal}
              onChangeText={(text) => {
                setCustomGoal(text);
                if (text.trim().length > 0) setSelected(null);
              }}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              multiline
              editable={canAddMoreGoals}
              style={[styles.textInput, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
            />
          </View>

          {/* Action bar */}
          <View style={[styles.actionBar, { borderTopColor: colors.border }]}>
            {/* + attach */}
            <Pressable
              ref={plusBtnRef as React.RefObject<View>}
              onPress={openAttachMenu}
              style={[styles.actionBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
              hitSlop={6}
              disabled={!canAddMoreGoals}
            >
              <Feather name="plus" size={18} color={colors.mutedForeground} />
            </Pressable>

            <View style={{ flex: 1 }} />

            {/* Mic */}
            <Pressable
              onPress={onMicPress}
              style={[styles.actionBtn, { backgroundColor: micBg, borderColor: isRecording ? colors.destructive : colors.border }]}
              hitSlop={6}
              disabled={!canAddMoreGoals}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color={colors.mutedForeground} />
              ) : (
                <Feather name={micIcon!} size={16} color={isRecording ? "#fff" : colors.mutedForeground} />
              )}
            </Pressable>

            {/* Send ↑ */}
            <Pressable
              onPress={onContinue}
              disabled={!canSend || isGeneratingTitle}
              style={[styles.sendBtn, { backgroundColor: canSend ? colors.primary : colors.border, borderRadius: 8 }]}
              hitSlop={6}
            >
              {isGeneratingTitle ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Feather name="arrow-up" size={16} color={canSend ? colors.primaryForeground : colors.mutedForeground} />
              )}
            </Pressable>
          </View>
        </View>

        {/* ── CATEGORY CHIPS — centered wrap grid ── */}
        <View style={styles.chipsGrid}>
          {TEMPLATE_GOAL_TYPES.map((g) => {
            const meta = GOAL_META[g];
            const isSelected = selected === g;
            return (
              <Pressable
                key={g}
                onPress={() => onPickTemplate(g)}
                style={[styles.chip, { backgroundColor: isSelected ? colors.primary + "18" : colors.card, borderColor: isSelected ? colors.primary : colors.border, borderRadius: 99, opacity: canAddMoreGoals ? 1 : 0.5 }]}
              >
                <Ionicons name={meta.icon as React.ComponentProps<typeof Ionicons>["name"]} size={18} color={isSelected ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.chipLabel, { color: isSelected ? colors.primary : colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {meta.label.split(" ")[0]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* ── EXAMPLE PROMPTS ── */}
        {canAddMoreGoals && (
          <View style={styles.exampleSection}>
            <View style={styles.exampleChips}>
              {EXAMPLE_PROMPTS.map((ex) => (
                <Pressable
                  key={ex}
                  onPress={() => onExamplePress(ex)}
                  style={[styles.exampleChip, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 99 }]}
                >
                  <Text style={[styles.exampleChipText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{ex}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── ATTACH FLOATING POPOVER ── */}
      <Modal visible={attachMenuOpen} transparent animationType="fade" onRequestClose={() => setAttachMenuOpen(false)}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setAttachMenuOpen(false)} />
        {menuAnchor && (() => {
          const sw = Dimensions.get("window").width;
          const menuW = 230;
          const left = Math.min(menuAnchor.x, sw - menuW - 12);
          const bottom = Dimensions.get("window").height - menuAnchor.y + 8;
          return (
            <View
              style={[
                styles.floatingMenu,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  left,
                  bottom,
                  width: menuW,
                  shadowColor: "#000",
                  shadowOpacity: 0.18,
                  shadowRadius: 16,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 12,
                },
              ]}
            >
              {/* Section header */}
              <Text style={[styles.floatingHeader, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                {t("newGoal.addAttachments", "Add attachments")}
              </Text>

              {/* Camera */}
              <Pressable
                style={({ pressed }) => [styles.floatingItem, pressed && { opacity: 0.7 }]}
                onPress={() => void pickFromCamera()}
              >
                <View style={[styles.floatingIcon, { backgroundColor: colors.primary + "18" }]}>
                  <Feather name="camera" size={16} color={colors.primary} />
                </View>
                <View style={styles.floatingText}>
                  <Text style={[styles.floatingLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    {t("newGoal.camera", "Camera")}
                  </Text>
                  <Text style={[styles.floatingSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {t("newGoal.cameraSub", "Take a photo right now")}
                  </Text>
                </View>
              </Pressable>

              <View style={[styles.floatingDivider, { backgroundColor: colors.border }]} />

              {/* Photos */}
              <Pressable
                style={({ pressed }) => [styles.floatingItem, pressed && { opacity: 0.7 }]}
                onPress={() => void pickFromLibrary()}
              >
                <View style={[styles.floatingIcon, { backgroundColor: colors.primary + "18" }]}>
                  <Feather name="image" size={16} color={colors.primary} />
                </View>
                <View style={styles.floatingText}>
                  <Text style={[styles.floatingLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    {t("newGoal.photos", "Photos")}
                  </Text>
                  <Text style={[styles.floatingSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {t("newGoal.photosSub", "Pick from your library")}
                  </Text>
                </View>
              </Pressable>

              <View style={[styles.floatingDivider, { backgroundColor: colors.border }]} />

              {/* Files */}
              <Pressable
                style={({ pressed }) => [styles.floatingItem, pressed && { opacity: 0.7 }]}
                onPress={() => void pickDocument()}
              >
                <View style={[styles.floatingIcon, { backgroundColor: colors.primary + "18" }]}>
                  <Feather name="paperclip" size={16} color={colors.primary} />
                </View>
                <View style={styles.floatingText}>
                  <Text style={[styles.floatingLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    {t("newGoal.files", "Files")}
                  </Text>
                  <Text style={[styles.floatingSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {t("newGoal.filesSub", "PDF, Word, text, CSV…")}
                  </Text>
                </View>
              </Pressable>
            </View>
          );
        })()}
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, letterSpacing: -0.2 },

  scroll: {
    paddingHorizontal: 16,
    paddingTop: 48,
    gap: 16,
  },

  heroBlock: {
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 8,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.6,
    textAlign: "center",
  },
  heroSub: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  limitBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderWidth: 1,
  },
  limitText: { flex: 1, fontSize: 13, lineHeight: 18 },

  recordingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recordingText: { fontSize: 13 },

  inputBox: { borderWidth: 1.5, overflow: "hidden" },
  inputInner: {
    position: "relative",
    minHeight: 80,
  },
  animatedPlaceholder: {
    position: "absolute",
    top: 14,
    left: 16,
    right: 16,
    fontSize: 15,
    lineHeight: 22,
    zIndex: 1,
    pointerEvents: "none",
  },
  textInput: {
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
    maxHeight: 180,
    textAlignVertical: "top",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    zIndex: 2,
  },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },

  chipsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    gap: 6,
  },
  chipLabel: { fontSize: 13, letterSpacing: 0.1 },

  exampleSection: { gap: 0 },
  exampleChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
  exampleChip: { paddingVertical: 7, paddingHorizontal: 14, borderWidth: 1 },
  exampleChipText: { fontSize: 12 },

  floatingMenu: {
    position: "absolute",
    borderWidth: 1,
    overflow: "hidden",
  },
  floatingHeader: {
    fontSize: 11,
    letterSpacing: 0.2,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  floatingItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  floatingIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  floatingText: { flex: 1 },
  floatingLabel: { fontSize: 13, marginBottom: 1 },
  floatingSub: { fontSize: 11 },
  floatingDivider: { height: StyleSheet.hairlineWidth, marginLeft: 56 },
});
