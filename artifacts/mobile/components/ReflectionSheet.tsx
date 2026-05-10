import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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

import { useColors } from "@/hooks/useColors";
import { useVoiceRecorder, type RecordedClip } from "@/hooks/useVoiceRecorder";
import {
  customFetch,
  useAtlasAnalyzeReflectionImage,
  type ReflectionEntry,
} from "@workspace/api-client-react";

type ReasonOption = {
  value: NonNullable<ReflectionEntry["reasonTag"]>;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
};

const COMPLETED_TAGS: ReasonOption[] = [
  { value: "easy", label: "Easy", icon: "smile" },
  { value: "just_right", label: "Just right", icon: "check-circle" },
  { value: "tough", label: "Tough", icon: "alert-triangle" },
  { value: "energized", label: "Energized", icon: "zap" },
  { value: "focused", label: "Focused", icon: "target" },
  { value: "tired", label: "Tired", icon: "moon" },
];

const SKIPPED_TAGS: ReasonOption[] = [
  { value: "no_time", label: "No time", icon: "clock" },
  { value: "tired", label: "Too tired", icon: "moon" },
  { value: "distracted", label: "Distracted", icon: "shuffle" },
  { value: "blocked", label: "Blocked", icon: "x-octagon" },
  { value: "skipped", label: "Skipped on purpose", icon: "skip-forward" },
  { value: "tough", label: "Too hard", icon: "alert-triangle" },
];

type Props = {
  visible: boolean;
  taskId: string;
  taskTitle: string;
  date: string;
  completed: boolean;
  initialReasonTag?: ReflectionEntry["reasonTag"];
  initialNote?: string;
  onClose: () => void;
  onSubmit: (entry: ReflectionEntry) => void;
};

type PendingImage = {
  base64: string;
  mimeType: string;
  previewUri: string;
};

// Whisper round-trip. Mirrors the helper in app/(tabs)/coach.tsx but kept
// inline here so reflections don't depend on the coach module.
async function transcribeClip(clip: RecordedClip): Promise<string> {
  const form = new FormData();
  if (clip.kind === "web-blob") {
    form.append("audio", clip.blob, clip.filename);
  } else {
    form.append(
      "audio",
      {
        uri: clip.uri,
        name: clip.filename,
        type: clip.mimeType,
      } as unknown as Blob,
    );
  }
  const data = await customFetch<{ text?: string }>("/api/atlas/transcribe", {
    method: "POST",
    body: form,
    responseType: "json",
  });
  return (data.text ?? "").trim();
}

export function ReflectionSheet({
  visible,
  taskId,
  taskTitle,
  date,
  completed,
  initialReasonTag,
  initialNote,
  onClose,
  onSubmit,
}: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [reasonTag, setReasonTag] = useState<ReflectionEntry["reasonTag"]>(initialReasonTag);
  const [note, setNote] = useState(initialNote ?? "");
  const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState<string>("");
  const [transcribing, setTranscribing] = useState(false);
  const recorder = useVoiceRecorder();
  const mountedRef = useRef(true);

  const analyzeImage = useAtlasAnalyzeReflectionImage();

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Reset state when the sheet is reopened for a different task / day.
  useEffect(() => {
    if (visible) {
      setReasonTag(initialReasonTag);
      setNote(initialNote ?? "");
      setPendingImage(null);
      setVoiceTranscript("");
      setTranscribing(false);
    }
  }, [visible, taskId, date, initialReasonTag, initialNote]);

  const tags = useMemo(() => (completed ? COMPLETED_TAGS : SKIPPED_TAGS), [completed]);

  const handlePickedAsset = useCallback(
    (asset: ImagePicker.ImagePickerAsset) => {
      if (!asset.base64) return;
      setPendingImage({
        base64: asset.base64,
        mimeType: asset.mimeType || "image/jpeg",
        previewUri: asset.uri,
      });
    },
    [],
  );

  const pickFromLibrary = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        if (Platform.OS !== "web") {
          Alert.alert("Photos", "Allow photo access to attach an image.");
        }
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.6,
        allowsMultipleSelection: false,
        base64: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      handlePickedAsset(res.assets[0]);
    } catch {
      // ignore — picker errors are usually permission cancellations
    }
  }, [handlePickedAsset]);

  const pickFromCamera = useCallback(async () => {
    if (Platform.OS === "web") {
      await pickFromLibrary();
      return;
    }
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Camera", "Allow camera access to snap a photo.");
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.6,
        allowsEditing: false,
        base64: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      handlePickedAsset(res.assets[0]);
    } catch {
      // ignore
    }
  }, [handlePickedAsset, pickFromLibrary]);

  const onAttachImagePress = useCallback(() => {
    if (Platform.OS === "web") {
      void pickFromLibrary();
      return;
    }
    Alert.alert(
      "Attach a photo",
      "Snap a photo or pick one from your library.",
      [
        { text: "Camera", onPress: () => void pickFromCamera() },
        { text: "Photo Library", onPress: () => void pickFromLibrary() },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true },
    );
  }, [pickFromCamera, pickFromLibrary]);

  const onMicPress = useCallback(async () => {
    if (recorder.state === "recording") {
      try {
        const clip = await recorder.stop();
        if (!clip || !mountedRef.current) return;
        setTranscribing(true);
        const text = await transcribeClip(clip);
        if (!mountedRef.current) return;
        if (text.length > 0) {
          setVoiceTranscript((prev) =>
            prev ? `${prev.trim()} ${text}`.trim() : text,
          );
        }
      } catch (err) {
        if (!mountedRef.current) return;
        const message =
          err instanceof Error ? err.message : "Couldn't transcribe that clip.";
        if (Platform.OS === "web") {
          // eslint-disable-next-line no-alert
          window.alert(message);
        } else {
          Alert.alert("Voice", message);
        }
      } finally {
        if (mountedRef.current) setTranscribing(false);
      }
      return;
    }
    if (recorder.state === "processing" || transcribing) return;
    await recorder.start();
  }, [recorder, transcribing]);

  const isRecording = recorder.state === "recording";
  const recordingSeconds = Math.floor(recorder.durationMs / 1000);
  const isAnalyzingImage = analyzeImage.isPending;

  const handleSave = async () => {
    let noteImageAnalysis: string | undefined;
    let analysisFailed = false;
    if (pendingImage) {
      try {
        const res = await analyzeImage.mutateAsync({
          data: {
            imageBase64: pendingImage.base64,
            imageMimeType: pendingImage.mimeType,
            taskTitle,
            completed,
            ...(reasonTag ? { reasonTag } : {}),
            ...(note.trim().length > 0 ? { note: note.trim() } : {}),
          },
        });
        if (!mountedRef.current) return;
        noteImageAnalysis = res.analysis.trim();
      } catch {
        // Best-effort: image analysis failures must NOT block saving the
        // reflection. Reason tag / text note / voice transcript are still
        // valuable on their own. We surface a non-blocking warning and save
        // without the noteImageAnalysis field.
        if (!mountedRef.current) return;
        analysisFailed = true;
      }
    }

    const entry: ReflectionEntry = {
      taskId,
      taskTitle,
      date,
      completed,
      reflectedAt: new Date().toISOString(),
      ...(reasonTag ? { reasonTag } : {}),
      ...(note.trim().length > 0 ? { note: note.trim() } : {}),
      ...(voiceTranscript.trim().length > 0
        ? { noteAudioTranscript: voiceTranscript.trim() }
        : {}),
      ...(noteImageAnalysis && noteImageAnalysis.length > 0
        ? { noteImageAnalysis }
        : {}),
    };
    onSubmit(entry);
    onClose();
    if (analysisFailed) {
      const msg =
        "Saved your reflection, but couldn't analyse the photo this time.";
      if (Platform.OS === "web") {
        // eslint-disable-next-line no-alert
        window.alert(msg);
      } else {
        Alert.alert("Photo", msg);
      }
    }
  };

  const isBusy = isAnalyzingImage || transcribing || isRecording;
  const canSave =
    !isBusy &&
    (Boolean(reasonTag) ||
      note.trim().length > 0 ||
      voiceTranscript.trim().length > 0 ||
      pendingImage !== null);

  // Block close paths while async media work is in flight so the user
  // doesn't get a stale "saved" or a half-transcribed note dropped on the
  // floor. Recorder must be explicitly stopped first.
  const safeClose = useCallback(() => {
    if (isBusy) return;
    onClose();
  }, [isBusy, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={safeClose}
    >
      <Pressable style={styles.backdrop} onPress={safeClose}>
        <KeyboardAvoidingView
          behavior="padding"
          keyboardVerticalOffset={0}
          style={[styles.kbWrap, { pointerEvents: "box-none" }]}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.sheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
                marginBottom: 12 + insets.bottom,
              },
            ]}
          >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
            bounces={false}
          >
            <View style={styles.headerRow}>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: completed
                      ? colors.primary + "1A"
                      : colors.muted,
                  },
                ]}
              >
                <Feather
                  name={completed ? "check-circle" : "x-circle"}
                  size={12}
                  color={completed ? colors.primary : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.statusText,
                    {
                      color: completed ? colors.primary : colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {completed ? "Marked done" : "Not done"}
                </Text>
              </View>
              <Pressable onPress={safeClose} hitSlop={10} disabled={isBusy}>
                <Feather
                  name="x"
                  size={20}
                  color={isBusy ? colors.muted : colors.mutedForeground}
                />
              </Pressable>
            </View>

            <Text
              style={[
                styles.title,
                { color: colors.foreground, fontFamily: "Inter_700Bold" },
              ]}
            >
              {completed ? "How did this go?" : "Why didn't this happen?"}
            </Text>
            <Text
              style={[
                styles.subtitle,
                { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
              ]}
              numberOfLines={2}
            >
              {taskTitle}
            </Text>

            <View style={styles.chipWrap}>
              {tags.map((opt) => {
                const selected = reasonTag === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setReasonTag(selected ? undefined : opt.value)}
                    style={[
                      styles.chip,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected
                          ? colors.primary + "1A"
                          : "transparent",
                      },
                    ]}
                  >
                    <Feather
                      name={opt.icon}
                      size={12}
                      color={selected ? colors.primary : colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: selected ? colors.primary : colors.foreground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={note}
              onChangeText={setNote}
              multiline
              placeholder={
                completed
                  ? "Optional note — what helped, what made it click?"
                  : "Optional note — what got in the way?"
              }
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.textArea,
                {
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  color: colors.foreground,
                  backgroundColor: colors.background,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            />

            {/* Media row: photo + voice. Both attachments feed AI directly. */}
            <View style={styles.mediaRow}>
              <Pressable
                onPress={onAttachImagePress}
                disabled={isAnalyzingImage}
                style={({ pressed }) => [
                  styles.mediaBtn,
                  {
                    borderColor: pendingImage ? colors.primary : colors.border,
                    backgroundColor: pendingImage
                      ? colors.primary + "1A"
                      : colors.background,
                    opacity: pressed || isAnalyzingImage ? 0.7 : 1,
                  },
                ]}
                testID="reflection-attach-image"
              >
                <Feather
                  name="image"
                  size={14}
                  color={pendingImage ? colors.primary : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.mediaBtnText,
                    {
                      color: pendingImage ? colors.primary : colors.foreground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  {pendingImage ? "Photo attached" : "Add photo"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => void onMicPress()}
                disabled={transcribing}
                style={({ pressed }) => [
                  styles.mediaBtn,
                  {
                    borderColor: isRecording ? colors.destructive : colors.border,
                    backgroundColor: isRecording
                      ? colors.destructive + "1A"
                      : colors.background,
                    opacity: pressed || transcribing ? 0.7 : 1,
                  },
                ]}
                testID="reflection-record-voice"
              >
                {transcribing ? (
                  <ActivityIndicator size="small" color={colors.mutedForeground} />
                ) : (
                  <Feather
                    name={isRecording ? "square" : "mic"}
                    size={14}
                    color={isRecording ? colors.destructive : colors.mutedForeground}
                  />
                )}
                <Text
                  style={[
                    styles.mediaBtnText,
                    {
                      color: isRecording
                        ? colors.destructive
                        : colors.foreground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  {isRecording
                    ? `Recording ${recordingSeconds}s — tap to stop`
                    : transcribing
                    ? "Transcribing…"
                    : voiceTranscript
                    ? "Add more voice"
                    : "Voice note"}
                </Text>
              </Pressable>
            </View>

            {pendingImage ? (
              <View
                style={[
                  styles.imagePreview,
                  {
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <Image
                  source={{ uri: pendingImage.previewUri }}
                  style={styles.imageThumb}
                  resizeMode="cover"
                />
                <View style={styles.imagePreviewBody}>
                  <Text
                    style={[
                      styles.imagePreviewCaption,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    rubai will analyse this photo when you save.
                  </Text>
                </View>
                <Pressable
                  onPress={() => setPendingImage(null)}
                  hitSlop={10}
                  style={styles.imageRemove}
                >
                  <Feather name="x" size={16} color={colors.mutedForeground} />
                </Pressable>
              </View>
            ) : null}

            {voiceTranscript ? (
              <View
                style={[
                  styles.transcriptBox,
                  {
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <View style={styles.transcriptHeader}>
                  <Feather
                    name="mic"
                    size={12}
                    color={colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.transcriptLabel,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    VOICE NOTE
                  </Text>
                  <Pressable
                    onPress={() => setVoiceTranscript("")}
                    hitSlop={10}
                    style={styles.transcriptClear}
                  >
                    <Feather name="x" size={14} color={colors.mutedForeground} />
                  </Pressable>
                </View>
                <TextInput
                  value={voiceTranscript}
                  onChangeText={setVoiceTranscript}
                  multiline
                  style={[
                    styles.transcriptText,
                    {
                      color: colors.foreground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                />
              </View>
            ) : null}

            <View style={styles.actionRow}>
              <Pressable
                onPress={safeClose}
                disabled={isBusy}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  {
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.secondaryText,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  Skip
                </Text>
              </Pressable>
              <Pressable
                onPress={() => void handleSave()}
                disabled={!canSave}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  {
                    backgroundColor: canSave ? colors.primary : colors.muted,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                {isAnalyzingImage ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text
                    style={[
                      styles.primaryText,
                      {
                        color: canSave ? colors.primaryForeground : colors.mutedForeground,
                        fontFamily: "Inter_700Bold",
                      },
                    ]}
                  >
                    {pendingImage ? "Analyse & save" : "Save reflection"}
                  </Text>
                )}
              </Pressable>
            </View>
          </ScrollView>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  kbWrap: {
    width: "100%",
  },
  sheet: {
    marginHorizontal: 12,
    marginTop: 12,
    borderWidth: 1,
    overflow: "hidden",
    maxHeight: "92%",
  },
  scrollContent: {
    padding: 20,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 18,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: -6,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 12.5,
  },
  textArea: {
    minHeight: 80,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    textAlignVertical: "top",
    marginTop: 4,
  },
  mediaRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2,
  },
  mediaBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 999,
  },
  mediaBtnText: {
    fontSize: 12.5,
  },
  imagePreview: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    padding: 8,
    gap: 10,
  },
  imageThumb: {
    width: 56,
    height: 56,
    borderRadius: 8,
  },
  imagePreviewBody: {
    flex: 1,
  },
  imagePreviewCaption: {
    fontSize: 12,
    lineHeight: 16,
  },
  imageRemove: {
    padding: 4,
  },
  transcriptBox: {
    borderWidth: 1,
    padding: 10,
    gap: 6,
  },
  transcriptHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  transcriptLabel: {
    fontSize: 10.5,
    letterSpacing: 0.6,
    flex: 1,
  },
  transcriptClear: {
    padding: 2,
  },
  transcriptText: {
    fontSize: 13.5,
    lineHeight: 19,
    minHeight: 40,
    textAlignVertical: "top",
    padding: 0,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  secondaryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    fontSize: 14,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    fontSize: 14.5,
    letterSpacing: 0.2,
  },
});
