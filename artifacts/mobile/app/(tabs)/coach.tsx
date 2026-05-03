import { Feather, Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActiveGoalChip } from "@/components/ActiveGoalChip";
import { AtlasLogo } from "@/components/AtlasLogo";
import { BrandDot } from "@/components/BrandDot";
import { ChatBubble } from "@/components/ChatBubble";
import { EmptyState } from "@/components/EmptyState";
import { ProposedActionCard } from "@/components/ProposedActionCard";
import { useColors } from "@/hooks/useColors";
import { useEvolveRoadmap } from "@/hooks/useEvolveRoadmap";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { useVoiceRecorder, type RecordedClip } from "@/hooks/useVoiceRecorder";
import { useAtlas } from "@/providers/AtlasProvider";
import { loadCalendarContextIfEnabled } from "@/lib/calendar";
import {
  customFetch,
  useAtlasCoach,
  type ChatMessage,
  type CoachActionSuggestion,
  type ProposedCoachAction,
} from "@workspace/api-client-react";

const COLD_START_SUGGESTIONS = [
  "I'm feeling stuck today",
  "Make today's plan easier",
  "Push me harder this week",
  "What should I focus on?",
];

type ModelChoice = "smart" | "fast";

type PendingAttachment = {
  filename: string;
  /** A short label we show in the input (e.g. "photo · 1.2MB"). */
  label: string;
  /** Base64-encoded image bytes (no data URL prefix). Set when the user
   *  picks an image so the server can run vision on this turn. */
  base64?: string;
  /** MIME type of the picked image, e.g. "image/jpeg" or "image/png".
   *  Combined with `base64` to build a data URL for the vision model. */
  mimeType?: string;
};

export default function CoachScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 8;
  const bottomPad = isWeb ? 100 : insets.bottom + 90;

  const {
    activeProfile,
    activeRoadmap,
    activeDailyPlan,
    activeBehavioral,
    activeBehavioralProfile,
    activeReflections,
    activeRoadmapEvolutions,
    activeCurrentWeek,
    activeCurrentPhase,
    activeCoachHistory,
    activeCoachMemory,
    setActiveCoachHistory,
    appendActiveCoachMessage,
    setActiveCoachMemory,
    applyCoachMemoryUpdate,
    setActiveDailyPlan,
    updateActiveGoal,
    account,
  } = useAtlas();

  const coach = useAtlasCoach();
  const { evolve, isEvolving } = useEvolveRoadmap();
  const recorder = useVoiceRecorder();
  const tts = useTextToSpeech();
  const [draft, setDraft] = useState("");
  const [lastSuggestedReplies, setLastSuggestedReplies] = useState<string[]>([]);
  const [lastAction, setLastAction] = useState<CoachActionSuggestion | null>(null);
  const [lastProposedAction, setLastProposedAction] =
    useState<ProposedCoachAction | null>(null);
  const [applyingAction, setApplyingAction] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [modelChoice, setModelChoice] = useState<ModelChoice>("smart");
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [pendingAttachment, setPendingAttachment] =
    useState<PendingAttachment | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const lastSpokenIndexRef = useRef<number>(-1);

  useEffect(() => {
    if (activeCoachHistory.length === 0 && activeProfile && activeRoadmap) {
      const opener: ChatMessage = {
        role: "assistant",
        content: `I'm here. We're working on ${activeRoadmap.headline.toLowerCase()}. Tell me what's on your mind, what got in the way, or what you want to push on.`,
      };
      void setActiveCoachHistory([opener]);
    }
  }, [activeCoachHistory.length, activeProfile, activeRoadmap, setActiveCoachHistory]);

  // When TTS state flips off (utterance ended), clear the active speaker.
  useEffect(() => {
    if (!tts.isSpeaking) setSpeakingIndex(null);
  }, [tts.isSpeaking]);

  // Surface recorder failures (mic permission denied, MediaRecorder
  // unsupported, etc.) so the user knows why nothing happened.
  useEffect(() => {
    if (recorder.state !== "error" || !recorder.errorMessage) return;
    const msg = recorder.errorMessage;
    if (Platform.OS === "web") {
      // eslint-disable-next-line no-alert
      window.alert(msg);
    } else {
      Alert.alert("Voice", msg);
    }
  }, [recorder.state, recorder.errorMessage]);

  const speakMessage = useCallback(
    async (text: string, index: number) => {
      if (speakingIndex === index && tts.isSpeaking) {
        await tts.stop();
        setSpeakingIndex(null);
        return;
      }
      setSpeakingIndex(index);
      await tts.speak(text);
    },
    [tts, speakingIndex],
  );

  const send = useCallback(
    async (text: string, opts?: { attachment?: PendingAttachment | null }) => {
      const message = text.trim();
      if (!message || !activeProfile || !activeRoadmap || coach.isPending) return;
      const attachment = opts?.attachment ?? pendingAttachment;
      setDraft("");
      setPendingAttachment(null);
      // Clear ephemeral per-turn UI as soon as the next turn starts.
      setLastSuggestedReplies([]);
      setLastAction(null);
      setLastProposedAction(null);

      const visibleContent = attachment
        ? `${message}\n📎 ${attachment.label}`
        : message;
      const userMsg: ChatMessage = { role: "user", content: visibleContent };
      await appendActiveCoachMessage(userMsg);

      try {
        const calendarContext = await loadCalendarContextIfEnabled(
          account.calendarSync,
        );
        const res = await coach.mutateAsync({
          data: {
            profile: activeProfile,
            roadmap: activeRoadmap,
            todayPlan: activeDailyPlan?.plan,
            behavioral: activeBehavioral,
            history: activeCoachHistory.slice(-10),
            message,
            modelChoice,
            ...(calendarContext ? { calendarContext } : {}),
            currentWeek: activeCurrentWeek,
            recentReflections: activeReflections.slice(-5),
            recentEvolutions: activeRoadmapEvolutions.slice(0, 2),
            ...(activeBehavioralProfile
              ? { learnedProfile: activeBehavioralProfile }
              : {}),
            ...(activeCurrentPhase ? { currentPhase: activeCurrentPhase } : {}),
            ...(activeCoachMemory ? { coachMemory: activeCoachMemory } : {}),
            ...(attachment ? { attachmentNote: attachment.filename } : {}),
            ...(attachment?.base64 && attachment.mimeType
              ? {
                  attachmentImage: {
                    base64Data: attachment.base64,
                    mimeType: attachment.mimeType,
                  },
                }
              : {}),
          },
        });
        const assistantMsg: ChatMessage = { role: "assistant", content: res.reply };
        await appendActiveCoachMessage(assistantMsg);
        setLastSuggestedReplies(res.suggestedReplies ?? []);
        const action = res.actionSuggestion;
        setLastAction(action && action.kind !== "none" ? action : null);
        setLastProposedAction(res.proposedAction ?? null);
        if (res.memoryUpdate) {
          await applyCoachMemoryUpdate({
            summary: res.memoryUpdate.summary,
            newFacts: res.memoryUpdate.newFacts ?? [],
          });
        }
        if (autoSpeak) {
          // The new assistant message will be at history.length (after append).
          const nextIndex = activeCoachHistory.length + 1;
          if (lastSpokenIndexRef.current !== nextIndex) {
            lastSpokenIndexRef.current = nextIndex;
            void tts.speak(res.reply).then(() => {
              setSpeakingIndex(nextIndex);
            });
            setSpeakingIndex(nextIndex);
          }
        }
      } catch {
        const errMsg: ChatMessage = {
          role: "assistant",
          content:
            "Lost the line for a moment. Send that again and we'll pick it back up.",
        };
        await appendActiveCoachMessage(errMsg);
      }
    },
    [
      activeProfile,
      activeRoadmap,
      coach,
      activeDailyPlan,
      activeBehavioral,
      activeCoachHistory,
      activeBehavioralProfile,
      activeCurrentWeek,
      activeCurrentPhase,
      activeCoachMemory,
      activeReflections,
      activeRoadmapEvolutions,
      appendActiveCoachMessage,
      applyCoachMemoryUpdate,
      modelChoice,
      pendingAttachment,
      autoSpeak,
      tts,
    ],
  );

  const onActionPress = async () => {
    if (!lastAction) return;
    const kind = lastAction.kind;
    setLastAction(null);
    if (kind === "evolve_roadmap") {
      await evolve("manual");
    } else if (kind === "refresh_insights") {
      router.push("/account");
    } else if (kind === "reflect_on_task") {
      router.push("/");
    }
  };

  // Confirm = apply the proposed plan/goal mutation locally, then drop a tiny
  // assistant follow-up so the chat reflects what just happened.
  // Cancel = silently dismiss the card.
  const onConfirmProposed = useCallback(async () => {
    const action = lastProposedAction;
    if (!action || applyingAction) return;
    setApplyingAction(true);
    try {
      let confirmation = "Done.";
      if (action.kind === "addTaskToday" && action.task) {
        const currentPlan = activeDailyPlan?.plan;
        if (currentPlan) {
          await setActiveDailyPlan({
            ...currentPlan,
            tasks: [...currentPlan.tasks, action.task],
          });
          confirmation = `Added "${action.task.title}" to today.`;
        }
      } else if (action.kind === "removeTaskToday" && action.taskId) {
        const currentPlan = activeDailyPlan?.plan;
        if (currentPlan) {
          const removed = currentPlan.tasks.find((t) => t.id === action.taskId);
          await setActiveDailyPlan({
            ...currentPlan,
            tasks: currentPlan.tasks.filter((t) => t.id !== action.taskId),
          });
          confirmation = removed
            ? `Removed "${removed.title}" from today.`
            : "Removed that task.";
        }
      } else if (action.kind === "renameGoal" && action.newTitle) {
        const newTitle = action.newTitle;
        await updateActiveGoal((g) => ({
          ...g,
          profile: { ...g.profile, customGoalTitle: newTitle },
        }));
        confirmation = `Renamed your goal to "${newTitle}".`;
      } else if (action.kind === "lightenToday") {
        const ids = action.removeTaskIds ?? [];
        const currentPlan = activeDailyPlan?.plan;
        if (ids.length > 0 && currentPlan) {
          const drop = new Set(ids);
          await setActiveDailyPlan({
            ...currentPlan,
            tasks: currentPlan.tasks.filter((t) => !drop.has(t.id)),
          });
          confirmation = `Lightened today by ${ids.length} task${
            ids.length === 1 ? "" : "s"
          }.`;
        }
      }
      setLastProposedAction(null);
      await appendActiveCoachMessage({ role: "assistant", content: confirmation });
    } catch {
      // Soft-fail: leave the card up so the user can retry.
    } finally {
      setApplyingAction(false);
    }
  }, [
    lastProposedAction,
    applyingAction,
    activeDailyPlan,
    setActiveDailyPlan,
    updateActiveGoal,
    appendActiveCoachMessage,
  ]);

  const onCancelProposed = useCallback(() => {
    setLastProposedAction(null);
  }, []);

  const onForgetMemory = async () => {
    await setActiveCoachMemory(null);
    setMemoryOpen(false);
  };

  // ---- Voice input flow ----
  const onMicPress = useCallback(async () => {
    if (recorder.state === "recording") {
      // Stop + transcribe + autosend.
      const clip = await recorder.stop();
      if (!clip) return;
      try {
        setTranscribing(true);
        const text = await transcribeClip(clip);
        if (text && text.trim().length > 0) {
          await send(text.trim());
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Couldn't transcribe that clip.";
        if (Platform.OS === "web") {
          // eslint-disable-next-line no-alert
          window.alert(message);
        } else {
          Alert.alert("Voice", message);
        }
      } finally {
        setTranscribing(false);
      }
      return;
    }
    if (recorder.state === "processing" || transcribing) return;
    await recorder.start();
  }, [recorder, send, transcribing]);

  const onAttachmentPress = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        if (Platform.OS !== "web") {
          Alert.alert("Photos", "Allow photo access to attach an image.");
        }
        return;
      }
      const res = await ImagePicker.launchImageLibraryAsync({
        // SDK 54+: pass the array form. The legacy MediaTypeOptions enum
        // is deprecated and prints a warning at runtime.
        mediaTypes: ["images"],
        quality: 0.6,
        allowsMultipleSelection: false,
        // Request base64 so we can ship the bytes straight to the coach
        // endpoint for vision without setting up object storage.
        base64: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      const filename = asset.fileName || "image";
      const sizeKb = asset.fileSize ? Math.round(asset.fileSize / 1024) : null;
      const label = sizeKb ? `${filename} · ${formatSize(sizeKb)}` : filename;
      // Heuristic mime type: ImagePicker's mimeType field is reliable on
      // iOS/Android; fall back to JPEG since that's what the picker emits
      // by default after compression.
      const mimeType = asset.mimeType || "image/jpeg";
      setPendingAttachment({
        filename,
        label,
        base64: asset.base64 ?? undefined,
        mimeType,
      });
    } catch {
      // ignore — picker errors are usually permission cancellations
    }
  }, []);

  // Footer below the chat list: typing indicator, then per-turn suggestions
  // and action card so they always appear right under the latest assistant
  // message regardless of how the FlatList grows.
  const footer = useMemo(() => {
    if (coach.isPending) {
      return (
        <View style={styles.typing}>
          <View style={styles.typingDotSlot}>
            <BrandDot size="md" mode="thinking" />
          </View>
        </View>
      );
    }
    return (
      <View style={styles.footerStack}>
        {lastProposedAction ? (
          <ProposedActionCard
            action={lastProposedAction}
            pending={applyingAction}
            onConfirm={onConfirmProposed}
            onCancel={onCancelProposed}
          />
        ) : null}
        {lastAction ? (
          <Pressable
            onPress={onActionPress}
            disabled={isEvolving}
            style={[
              styles.actionCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.primary,
                opacity: isEvolving ? 0.6 : 1,
              },
            ]}
          >
            <View style={styles.actionTextWrap}>
              <Text
                style={[
                  styles.actionLabel,
                  { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {lastAction.label}
              </Text>
              <Text
                style={[
                  styles.actionRationale,
                  { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
                ]}
              >
                {lastAction.rationale}
              </Text>
            </View>
            {isEvolving ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Feather name="arrow-right" size={18} color={colors.primary} />
            )}
          </Pressable>
        ) : null}
        {lastSuggestedReplies.length > 0 ? (
          <View style={styles.suggestedRepliesRow}>
            {lastSuggestedReplies.map((s) => (
              <Pressable
                key={s}
                onPress={() => send(s)}
                style={[
                  styles.suggestedReply,
                  { borderColor: colors.primary, backgroundColor: colors.background },
                ]}
                testID={`suggested-reply-${s}`}
              >
                <Text
                  style={[
                    styles.suggestedReplyText,
                    { color: colors.primary, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    );
    // onActionPress / send change identity every render but are safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    coach.isPending,
    lastAction,
    lastProposedAction,
    applyingAction,
    lastSuggestedReplies,
    isEvolving,
    colors,
  ]);

  if (!activeProfile || !activeRoadmap) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <EmptyState
          icon="message-circle"
          title="Coach unlocks after intake"
          description="Add a goal and finish the intake form first."
        />
      </View>
    );
  }

  const memoryFacts = activeCoachMemory?.facts ?? [];
  const isRecording = recorder.state === "recording";
  const recordingSeconds = Math.floor(recorder.durationMs / 1000);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={0}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View style={[styles.header, { paddingTop: topPad }]}>
        <View style={styles.headerInner}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text
              style={[
                styles.headerEyebrow,
                { color: colors.primary, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              COACH
            </Text>
            <AtlasLogo size="lg" />
            <Text
              style={[
                styles.headerSubtitle,
                { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
              ]}
            >
              Working on:{" "}
              <Text style={{ color: colors.foreground, fontFamily: "Inter_500Medium" }}>
                {activeRoadmap.headline}
              </Text>
            </Text>
          </View>
          <ActiveGoalChip />
        </View>

        {activeCoachMemory ? (
          <Pressable
            onPress={() => setMemoryOpen((v) => !v)}
            style={[
              styles.memoryBanner,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            testID="memory-banner"
          >
            <View style={styles.memoryBannerHeader}>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.memoryEyebrow,
                    { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  WHAT RUBAI REMEMBERS
                </Text>
                <Text
                  numberOfLines={memoryOpen ? undefined : 2}
                  style={[
                    styles.memorySummary,
                    { color: colors.foreground, fontFamily: "Inter_500Medium" },
                  ]}
                >
                  {activeCoachMemory.summary}
                </Text>
              </View>
              <Feather
                name={memoryOpen ? "chevron-up" : "chevron-down"}
                size={18}
                color={colors.mutedForeground}
              />
            </View>
            {memoryOpen ? (
              <View style={styles.memoryExpanded}>
                {memoryFacts.length > 0 ? (
                  <View style={styles.factsRow}>
                    {memoryFacts.map((f) => (
                      <View
                        key={f}
                        style={[
                          styles.factPill,
                          { backgroundColor: colors.background, borderColor: colors.border },
                        ]}
                      >
                        <Text
                          style={[
                            styles.factText,
                            { color: colors.foreground, fontFamily: "Inter_500Medium" },
                          ]}
                        >
                          {f}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text
                    style={[
                      styles.factText,
                      { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
                    ]}
                  >
                    No specific facts saved yet.
                  </Text>
                )}
                <Pressable
                  onPress={onForgetMemory}
                  style={styles.forgetButton}
                  testID="forget-memory"
                >
                  <Feather name="trash-2" size={14} color={colors.destructive} />
                  <Text
                    style={[
                      styles.forgetText,
                      { color: colors.destructive, fontFamily: "Inter_600SemiBold" },
                    ]}
                  >
                    Forget everything
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </Pressable>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        data={activeCoachHistory}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 }}
        renderItem={({ item, index }) => (
          <ChatBubble
            role={item.role}
            content={item.content}
            onSpeak={
              item.role === "assistant"
                ? () => void speakMessage(item.content, index)
                : undefined
            }
            isSpeaking={speakingIndex === index && tts.isSpeaking}
          />
        )}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        ListFooterComponent={footer}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      />

      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: bottomPad,
          },
        ]}
      >
        {activeCoachHistory.length <= 1 && lastSuggestedReplies.length === 0 && (
          <View style={styles.suggestions}>
            {COLD_START_SUGGESTIONS.map((s) => (
              <Pressable
                key={s}
                onPress={() => send(s)}
                style={[
                  styles.suggestion,
                  {
                    backgroundColor: colors.muted,
                    borderRadius: 999,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.suggestionText,
                    { color: colors.foreground, fontFamily: "Inter_500Medium" },
                  ]}
                >
                  {s}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Status caption: tappable inline toggles for model + voice mode.
            Replaces the earlier pill row; matches the screenshot's
            "SMART MODE · VOICE OFF" caption. */}
        <View style={styles.statusCaption}>
          <Pressable
            onPress={() =>
              setModelChoice((v) => (v === "smart" ? "fast" : "smart"))
            }
            hitSlop={8}
            testID="model-toggle"
          >
            <Text
              style={[
                styles.statusCaptionText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              {modelChoice === "fast" ? "FAST MODE" : "SMART MODE"}
            </Text>
          </Pressable>
          <Text
            style={[
              styles.statusCaptionSep,
              { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
            ]}
          >
            ·
          </Text>
          <Pressable
            onPress={() => setAutoSpeak((v) => !v)}
            hitSlop={8}
            testID="autospeak-toggle"
          >
            <Text
              style={[
                styles.statusCaptionText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              {autoSpeak ? "VOICE ON" : "VOICE OFF"}
            </Text>
          </Pressable>
          {transcribing ? (
            <>
              <Text
                style={[
                  styles.statusCaptionSep,
                  { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
                ]}
              >
                ·
              </Text>
              <ActivityIndicator size="small" color={colors.mutedForeground} />
              <Text
                style={[
                  styles.statusCaptionText,
                  { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                TRANSCRIBING…
              </Text>
            </>
          ) : null}
        </View>

        {pendingAttachment ? (
          <View
            style={[
              styles.attachmentRow,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
          >
            <Feather name="paperclip" size={13} color={colors.mutedForeground} />
            <Text
              numberOfLines={1}
              style={[
                styles.attachmentText,
                { color: colors.foreground, fontFamily: "Inter_500Medium" },
              ]}
            >
              {pendingAttachment.label}
            </Text>
            <Pressable
              onPress={() => setPendingAttachment(null)}
              hitSlop={6}
              testID="remove-attachment"
            >
              <Feather name="x" size={14} color={colors.mutedForeground} />
            </Pressable>
          </View>
        ) : null}

        <View
          style={[
            styles.inputWrap,
            {
              backgroundColor: colors.card,
              borderColor: isRecording ? colors.primary : colors.border,
              borderRadius: 28,
            },
          ]}
        >
          <Pressable
            onPress={onAttachmentPress}
            hitSlop={6}
            disabled={coach.isPending || isRecording}
            style={[
              styles.sparkBadge,
              { backgroundColor: colors.primary + "22" },
            ]}
            testID="attach-button"
          >
            <Feather name="plus" size={18} color={colors.primary} />
          </Pressable>

          {isRecording ? (
            <View style={styles.recordingIndicator}>
              <View style={[styles.recordingDot, { backgroundColor: colors.primary }]} />
              <Text
                style={[
                  styles.recordingText,
                  { color: colors.foreground, fontFamily: "Inter_500Medium" },
                ]}
              >
                Recording {formatTime(recordingSeconds)}
              </Text>
            </View>
          ) : (
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Talk to your coach..."
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[
                styles.input,
                { color: colors.foreground, fontFamily: "Inter_400Regular" },
              ]}
              editable={!coach.isPending && !transcribing}
            />
          )}

          <Pressable
            onPress={onMicPress}
            disabled={coach.isPending || transcribing}
            style={[
              styles.micButton,
              {
                backgroundColor: isRecording ? colors.primary : "transparent",
              },
            ]}
            hitSlop={6}
            testID="mic-button"
          >
            <Feather
              name={isRecording ? "square" : "mic"}
              size={18}
              color={
                isRecording ? colors.primaryForeground : colors.mutedForeground
              }
            />
          </Pressable>

          <Pressable
            onPress={() => send(draft)}
            disabled={!draft.trim() || coach.isPending || isRecording}
            style={[
              styles.sendButton,
              {
                backgroundColor:
                  draft.trim() && !isRecording ? colors.primary : colors.muted,
              },
            ]}
            hitSlop={6}
          >
            <Feather
              name="arrow-up"
              size={18}
              color={
                draft.trim() && !isRecording
                  ? colors.primaryForeground
                  : colors.mutedForeground
              }
            />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Voice transcription helper. Uploads the recorded clip to /api/atlas/transcribe
// and returns the recognised text. We go through `customFetch` so the
// request inherits the same base URL and bearer-token auth as the rest of
// the generated client — the generated react-query hook can't be used
// directly because it's JSON-only and doesn't support multipart bodies.
// ---------------------------------------------------------------------------

async function transcribeClip(clip: RecordedClip): Promise<string> {
  const form = new FormData();
  if (clip.kind === "web-blob") {
    form.append("audio", clip.blob, clip.filename);
  } else {
    // React Native FormData accepts a {uri,name,type} object — TS doesn't
    // know about it, so cast through unknown.
    form.append(
      "audio",
      {
        uri: clip.uri,
        name: clip.filename,
        type: clip.mimeType,
      } as unknown as Blob,
    );
  }

  // Route through customFetch so the request inherits the configured base
  // URL (set in _layout.tsx) and the bearer token from Clerk. Without this
  // the /atlas/* requireAuth middleware returns 401 on native.
  const data = await customFetch<{ text?: string }>("/api/atlas/transcribe", {
    method: "POST",
    body: form,
    responseType: "json",
  });
  return (data.text ?? "").trim();
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatSize(kb: number): string {
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)}MB`;
  return `${kb}KB`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: 22,
    paddingBottom: 12,
  },
  headerInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  memoryBanner: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 14,
  },
  memoryBannerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  memoryEyebrow: {
    fontSize: 10.5,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  memorySummary: {
    fontSize: 13,
    lineHeight: 18,
  },
  memoryExpanded: {
    marginTop: 10,
    gap: 10,
  },
  factsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  factPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  factText: {
    fontSize: 12,
  },
  forgetButton: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingVertical: 4,
  },
  forgetText: {
    fontSize: 12.5,
  },
  typing: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 6,
  },
  typingDotSlot: {
    paddingLeft: 4,
  },
  headerEyebrow: {
    fontSize: 11,
    letterSpacing: 1.6,
    textTransform: "uppercase",
  },
  headerSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 2,
  },
  statusCaption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: 4,
  },
  statusCaptionText: {
    fontSize: 10.5,
    letterSpacing: 1.2,
  },
  statusCaptionSep: {
    fontSize: 11,
  },
  footerStack: {
    paddingHorizontal: 6,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 10,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  actionTextWrap: {
    flex: 1,
    gap: 2,
  },
  actionLabel: {
    fontSize: 14,
  },
  actionRationale: {
    fontSize: 12,
    lineHeight: 16,
  },
  suggestedRepliesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  suggestedReply: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  suggestedReplyText: {
    fontSize: 12.5,
  },
  inputBar: {
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    gap: 10,
  },
  suggestions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingHorizontal: 4,
  },
  suggestion: {
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  suggestionText: {
    fontSize: 12.5,
    letterSpacing: 0.2,
  },
  attachmentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginHorizontal: 4,
  },
  attachmentText: {
    flex: 1,
    fontSize: 12.5,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    paddingLeft: 6,
    paddingRight: 6,
    paddingVertical: 4,
    gap: 6,
    minHeight: 44,
  },
  iconButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  sparkBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  recordingIndicator: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  recordingText: {
    fontSize: 13,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingTop: 13,
    paddingBottom: 0,
    maxHeight: 120,
  },
  micButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
