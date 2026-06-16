import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
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
          <TextInput
            ref={inputRef}
            value={customGoal}
            onChangeText={(text) => {
              setCustomGoal(text);
              if (text.trim().length > 0) setSelected(null);
            }}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder={t("newGoal.placeholder", "e.g. Get promoted to senior engineer in 9 months")}
            placeholderTextColor={colors.mutedForeground}
            multiline
            editable={canAddMoreGoals}
            style={[styles.textInput, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
          />

          {/* Action bar */}
          <View style={[styles.actionBar, { borderTopColor: colors.border }]}>
            {/* + attach */}
            <Pressable
              onPress={() => { if (canAddMoreGoals) setAttachMenuOpen(true); }}
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

        {/* ── CATEGORY CHIPS ── */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
          {TEMPLATE_GOAL_TYPES.map((g) => {
            const meta = GOAL_META[g];
            const isSelected = selected === g;
            return (
              <Pressable
                key={g}
                onPress={() => onPickTemplate(g)}
                style={[styles.chip, { backgroundColor: isSelected ? colors.primary + "18" : colors.card, borderColor: isSelected ? colors.primary : colors.border, borderRadius: 10, opacity: canAddMoreGoals ? 1 : 0.5 }]}
              >
                <Ionicons name={meta.icon as React.ComponentProps<typeof Ionicons>["name"]} size={20} color={isSelected ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.chipLabel, { color: isSelected ? colors.primary : colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                  {meta.label.split(" ")[0]}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* ── EXAMPLE PROMPTS ── */}
        {canAddMoreGoals && (
          <View style={styles.exampleSection}>
            <Text style={[styles.exampleLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              {t("newGoal.exampleLabel", "Try an example prompt")}
            </Text>
            <View style={styles.exampleChips}>
              {EXAMPLE_PROMPTS.map((ex) => (
                <Pressable
                  key={ex}
                  onPress={() => onExamplePress(ex)}
                  style={[styles.exampleChip, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 8 }]}
                >
                  <Text style={[styles.exampleChipText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{ex}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* ── ATTACH BOTTOM SHEET ── */}
      <Modal visible={attachMenuOpen} transparent animationType="slide" onRequestClose={() => setAttachMenuOpen(false)}>
        <Pressable style={styles.attachOverlay} onPress={() => setAttachMenuOpen(false)} />
        <View style={[styles.attachSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>

          {/* Camera */}
          <Pressable style={styles.attachRow} onPress={() => void pickFromCamera()}>
            <View style={[styles.attachIcon, { backgroundColor: colors.primary + "18" }]}>
              <Feather name="camera" size={20} color={colors.primary} />
            </View>
            <View style={styles.attachText}>
              <Text style={[styles.attachLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {t("newGoal.camera", "Camera")}
              </Text>
              <Text style={[styles.attachSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {t("newGoal.cameraSub", "Take a photo right now")}
              </Text>
            </View>
          </Pressable>

          <View style={[styles.attachDivider, { backgroundColor: colors.border }]} />

          {/* Photos */}
          <Pressable style={styles.attachRow} onPress={() => void pickFromLibrary()}>
            <View style={[styles.attachIcon, { backgroundColor: colors.primary + "18" }]}>
              <Feather name="image" size={20} color={colors.primary} />
            </View>
            <View style={styles.attachText}>
              <Text style={[styles.attachLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {t("newGoal.photos", "Photos")}
              </Text>
              <Text style={[styles.attachSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {t("newGoal.photosSub", "Pick from your library")}
              </Text>
            </View>
          </Pressable>

          <View style={[styles.attachDivider, { backgroundColor: colors.border }]} />

          {/* Files */}
          <Pressable style={styles.attachRow} onPress={() => void pickDocument()}>
            <View style={[styles.attachIcon, { backgroundColor: colors.primary + "18" }]}>
              <Feather name="paperclip" size={20} color={colors.primary} />
            </View>
            <View style={styles.attachText}>
              <Text style={[styles.attachLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {t("newGoal.files", "Files")}
              </Text>
              <Text style={[styles.attachSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {t("newGoal.filesSub", "PDF, Word, text, CSV…")}
              </Text>
            </View>
          </Pressable>

          {/* Cancel */}
          <Pressable
            style={[styles.attachCancel, { borderTopColor: colors.border }]}
            onPress={() => setAttachMenuOpen(false)}
          >
            <Text style={[styles.attachCancelText, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              {t("common.cancel", "Cancel")}
            </Text>
          </Pressable>
        </View>
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
    paddingTop: 100,
    gap: 16,
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
  textInput: {
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
    maxHeight: 180,
    textAlignVertical: "top",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
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

  chipsRow: { gap: 8, flexDirection: "row", paddingHorizontal: 2 },
  chip: {
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    gap: 5,
  },
  chipLabel: { fontSize: 11, letterSpacing: 0.2 },

  exampleSection: { gap: 10 },
  exampleLabel: { fontSize: 12 },
  exampleChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  exampleChip: { paddingVertical: 6, paddingHorizontal: 12, borderWidth: 1 },
  exampleChipText: { fontSize: 12 },

  attachOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  attachSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingTop: 8,
    overflow: "hidden",
  },
  attachRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  attachIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  attachText: { flex: 1 },
  attachLabel: { fontSize: 15, marginBottom: 2 },
  attachSub: { fontSize: 12 },
  attachDivider: { height: StyleSheet.hairlineWidth, marginLeft: 78 },
  attachCancel: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    alignItems: "center",
  },
  attachCancelText: { fontSize: 15 },
});
