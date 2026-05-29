import { Feather } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import {
  loadCalendarContextIfEnabled,
  writePlanToCalendarOnDemand,
} from "@/lib/calendar";
import {
  customFetch,
  useAtlasCoach,
  useAtlasGenerateTitle,
  type ChatMessage,
  type CoachActionSuggestion,
  type ProposedCoachAction,
} from "@workspace/api-client-react";
import { streamCoachReply, type CoachStreamFinal } from "@/lib/coachStream";
import { useTypewriter } from "@/lib/useTypewriter";
import type { CoachMemory } from "@workspace/api-client-react";
import type { ChatSession } from "@/types/atlas";

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
    activeCoachSessions,
    activeCoachSessionId,
    createCoachSession,
    switchCoachSession,
    deleteCoachSession,
    renameCoachSession,
    setActiveCoachHistory,
    appendActiveCoachMessage,
    appendCoachMessageToSession,
    setActiveCoachMemory,
    applyCoachMemoryUpdate,
    setActiveDailyPlan,
    updateActiveGoal,
    activeGoal,
    account,
  } = useAtlas();

  const coach = useAtlasCoach();
  const generateTitle = useAtlasGenerateTitle();
  const { evolve, isEvolving } = useEvolveRoadmap();
  const recorder = useVoiceRecorder();
  const tts = useTextToSpeech();
  const [draft, setDraft] = useState("");
  const [lastSuggestedReplies, setLastSuggestedReplies] = useState<string[]>([]);
  const [lastAction, setLastAction] = useState<CoachActionSuggestion | null>(null);
  const [lastProposedAction, setLastProposedAction] =
    useState<ProposedCoachAction | null>(null);
  const [applyingAction, setApplyingAction] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modelChoice, setModelChoice] = useState<ModelChoice>("smart");
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [pendingAttachment, setPendingAttachment] =
    useState<PendingAttachment | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  // Streaming state. `isStreaming` is true from request start until the
  // `final` SSE event lands, even before the first delta — so the typing
  // indicator shows immediately. The typewriter smooths the bursty SSE
  // deltas into a steady word-by-word reveal (a fronting proxy can buffer
  // the stream and deliver big chunks, which would otherwise make the
  // reply pop in all at once). `typer.displayed` is what we render.
  const typer = useTypewriter();
  const [isStreaming, setIsStreaming] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const lastSpokenIndexRef = useRef<number>(-1);
  // Cancels any in-flight streaming request when the user starts a new
  // turn or unmounts the screen, so server-side OpenAI tokens stop
  // being charged and we don't write state to an unmounted component.
  const streamAbortRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => {
      streamAbortRef.current?.abort();
      streamAbortRef.current = null;
    };
  }, []);

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
      if (
        !message ||
        !activeProfile ||
        !activeRoadmap ||
        coach.isPending ||
        isStreaming
      )
        return;
      const attachment = opts?.attachment ?? pendingAttachment;
      setDraft("");
      setPendingAttachment(null);
      // Clear ephemeral per-turn UI as soon as the next turn starts.
      setLastSuggestedReplies([]);
      setLastAction(null);
      setLastProposedAction(null);

      // Pin (goalId, sessionId) AT SEND TIME so a late stream completion or
      // image-turn response can't land in whichever session happens to be
      // active by the time the network call returns. The provider's
      // `appendCoachMessageToSession` is a no-op if the pinned session was
      // deleted while the request was in flight.
      const pinnedGoalId = activeGoal?.id ?? null;
      const pinnedSessionId = activeCoachSessionId;
      if (!pinnedGoalId || !pinnedSessionId) return;

      const visibleContent = attachment
        ? `${message}\n📎 ${attachment.label}`
        : message;
      const userMsg: ChatMessage = { role: "user", content: visibleContent };
      await appendCoachMessageToSession(pinnedGoalId, pinnedSessionId, userMsg);

      // Fire-and-forget: when the user sends the FIRST real message in a
      // session that still has the placeholder "New chat" title, ask the AI
      // for a short 2-5 word title. The provider's CAS rename guards against
      // (a) double-fires if state hasn't repainted yet, and (b) clobbering a
      // user-renamed session with a late title response.
      const session = activeCoachSessions.find((s) => s.id === pinnedSessionId);
      const isFirstUserMessage =
        !!session &&
        (session.title === "New chat" || session.title.trim().length === 0) &&
        session.messages.filter((m) => m.role === "user").length === 0;
      if (isFirstUserMessage && activeProfile) {
        void generateTitle
          .mutateAsync({
            data: {
              goalType: activeProfile.goalType,
              userInput: message.slice(0, 240),
            },
          })
          .then((res) => {
            const title = (res?.title ?? "").trim();
            if (title.length > 0) {
              void renameCoachSession(pinnedSessionId, title, {
                goalId: pinnedGoalId,
                onlyIfPlaceholder: true,
              });
            }
          })
          .catch(() => {
            // Title is cosmetic — silent failure leaves "New chat" in place.
          });
      }

      const calendarContext = await loadCalendarContextIfEnabled(
        account.calendarSync,
      );
      const requestData = {
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
      };

      // Shared post-processing for both streaming and fallback paths.
      const commitFinal = async (res: {
        reply: string;
        suggestedReplies: string[];
        actionSuggestion: CoachActionSuggestion | null;
        memoryUpdate: { summary: string; newFacts: string[] } | null;
        proposedAction: ProposedCoachAction | null;
      }) => {
        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: res.reply,
        };
        // Pinned commit — see capture above.
        await appendCoachMessageToSession(
          pinnedGoalId,
          pinnedSessionId,
          assistantMsg,
        );
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
          const nextIndex = activeCoachHistory.length + 1;
          if (lastSpokenIndexRef.current !== nextIndex) {
            lastSpokenIndexRef.current = nextIndex;
            void tts.speak(res.reply).then(() => {
              setSpeakingIndex(nextIndex);
            });
            setSpeakingIndex(nextIndex);
          }
        }
      };

      // Vision turns keep the non-streaming endpoint: the legacy
      // `/coach` route already handles image input and there's little
      // streaming UX win for short image-grounded replies.
      const useStreaming = !attachment?.base64;

      // Hoisted so the shared catch below can tell a user-initiated cancel
      // (session switch / new-chat / unmount aborts the controller) from a
      // genuine connection error, even though the controller itself is
      // block-scoped to the streaming branch.
      let activeController: AbortController | null = null;

      try {
        if (useStreaming) {
          // Cancel any leftover in-flight stream from a prior turn
          // (shouldn't happen because of the isStreaming guard above,
          // but be defensive against double-tap races).
          streamAbortRef.current?.abort();
          const controller = new AbortController();
          activeController = controller;
          streamAbortRef.current = controller;
          setIsStreaming(true);
          typer.reset();
          let finalRes: CoachStreamFinal | null = null;
          let accumulated = "";
          try {
            await streamCoachReply(
              { data: requestData },
              {
                onDelta: (chunk) => {
                  // Feed the full accumulated reply to the typewriter; it
                  // reveals it at a steady cadence regardless of how the
                  // SSE bytes were chunked over the wire.
                  accumulated += chunk;
                  typer.push(accumulated);
                },
                onFinal: (res) => {
                  finalRes = res;
                },
              },
              controller.signal,
            );
            if (!finalRes) {
              throw new Error("Coach stream ended without a final reply.");
            }
            // Point the typewriter at the canonical final reply and let it
            // finish typing out before we swap the live bubble for the
            // committed history message — both show identical text, so the
            // hand-off is seamless with no pop-in.
            const final: CoachStreamFinal = finalRes;
            typer.push(final.reply || accumulated);
            await typer.flush();
            // The network finished before flush, so abort() no longer
            // cancels anything. If the user switched session / started a
            // new chat during the type-out window, skip the commit so we
            // don't append a late reply to a session they navigated away
            // from.
            if (controller.signal.aborted) return;
            await commitFinal(final);
          } finally {
            typer.reset();
            setIsStreaming(false);
            if (streamAbortRef.current === controller) {
              streamAbortRef.current = null;
            }
          }
        } else {
          const res = await coach.mutateAsync({ data: requestData });
          await commitFinal({
            reply: res.reply,
            suggestedReplies: res.suggestedReplies ?? [],
            actionSuggestion: res.actionSuggestion ?? null,
            memoryUpdate: res.memoryUpdate ?? null,
            proposedAction: res.proposedAction ?? null,
          });
        }
      } catch (err) {
        typer.reset();
        setIsStreaming(false);
        // Silent cancel: a deliberate session switch / new-chat / unmount
        // aborts the in-flight stream; surfacing a "connection interrupted"
        // bubble would be wrong UX. We treat any AbortError (or a
        // signal that's now aborted) as user-initiated cancellation.
        const aborted =
          (err instanceof Error && err.name === "AbortError") ||
          // streamCoachReply may wrap the AbortError in a different shape,
          // so also trust the controller signal. The controller is only
          // allocated on the streaming path; for the image-turn path
          // activeController stays null and we DO show the error message.
          !!activeController?.signal.aborted;
        if (aborted) return;
        const errMsg: ChatMessage = {
          role: "assistant",
          content:
            "Bağlantı bir anlığa kəsildi. Mesajını yenidən göndər — davam edək.",
        };
        await appendCoachMessageToSession(pinnedGoalId, pinnedSessionId, errMsg);
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
      appendCoachMessageToSession,
      applyCoachMemoryUpdate,
      modelChoice,
      pendingAttachment,
      autoSpeak,
      tts,
      isStreaming,
      account.calendarSync,
      activeGoal,
      activeCoachSessionId,
      activeCoachSessions,
      generateTitle,
      renameCoachSession,
    ],
  );

  const onNewChat = useCallback(async () => {
    setSidebarOpen(false);
    setLastSuggestedReplies([]);
    setLastAction(null);
    setLastProposedAction(null);
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    await createCoachSession();
  }, [createCoachSession]);

  const onPickSession = useCallback(
    async (sessionId: string) => {
      setSidebarOpen(false);
      if (sessionId === activeCoachSessionId) return;
      setLastSuggestedReplies([]);
      setLastAction(null);
      setLastProposedAction(null);
      streamAbortRef.current?.abort();
      streamAbortRef.current = null;
      await switchCoachSession(sessionId);
    },
    [activeCoachSessionId, switchCoachSession],
  );

  const onDeleteSession = useCallback(
    (sessionId: string, title: string) => {
      const goAhead = () => void deleteCoachSession(sessionId);
      if (Platform.OS === "web") {
        // eslint-disable-next-line no-alert
        if (window.confirm(`Delete "${title}"?`)) goAhead();
        return;
      }
      Alert.alert(
        "Delete chat",
        `Delete "${title}"? This cannot be undone.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: goAhead },
        ],
      );
    },
    [deleteCoachSession],
  );

  const onActionPress = async () => {
    if (!lastAction) return;
    const kind = lastAction.kind;
    setLastAction(null);
    if (kind === "evolve_roadmap") {
      await evolve("manual");
    } else if (kind === "refresh_insights") {
      // Route to the actual Behavioral Insights screen and ask it to
      // immediately recompute the profile so the user sees a real result
      // instead of landing on Account with nothing happening.
      router.push("/behavioral-insights?autoRefresh=1");
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
      } else if (action.kind === "syncToCalendar") {
        const currentPlan = activeDailyPlan?.plan;
        const outcome = await writePlanToCalendarOnDemand(
          account.calendarSync,
          currentPlan,
        );
        if (outcome.ok) {
          confirmation = `Added ${outcome.written} task${
            outcome.written === 1 ? "" : "s"
          } to ${account.calendarSync.calendarTitle ?? "your calendar"}.`;
        } else if (outcome.reason === "no-permission") {
          confirmation =
            "I need calendar permission first. Open Account → Calendar sync to grant access.";
        } else if (outcome.reason === "no-calendar") {
          confirmation =
            "Pick a calendar in Account → Calendar sync, then ask me again.";
        } else if (outcome.reason === "web") {
          confirmation =
            "Calendar sync is mobile-only — try this from the iOS or Android app.";
        } else {
          confirmation = "No tasks to sync yet.";
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
    account.calendarSync,
  ]);

  const onCancelProposed = useCallback(() => {
    setLastProposedAction(null);
  }, []);

  const onForgetMemory = async () => {
    await setActiveCoachMemory(null);
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

  // Shared post-pick handler — both the camera and the library funnel into
  // here so the coach receives a uniform PendingAttachment.
  const handlePickedAsset = useCallback(
    (asset: ImagePicker.ImagePickerAsset, fallbackName: string) => {
      const filename = asset.fileName || fallbackName;
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
      handlePickedAsset(res.assets[0], "image");
    } catch {
      // ignore — picker errors are usually permission cancellations
    }
  }, [handlePickedAsset]);

  const pickFromCamera = useCallback(async () => {
    // Web has no native camera UI via ImagePicker — fall back to the library
    // picker which on web also accepts capture-from-camera input.
    if (Platform.OS === "web") {
      await pickFromLibrary();
      return;
    }
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Camera",
          "Allow camera access to snap what you're working on.",
        );
        return;
      }
      const res = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        quality: 0.6,
        // Skip the in-OS edit step — for "show the coach what I'm doing
        // right now" the friction of cropping every shot kills the flow.
        allowsEditing: false,
        base64: true,
      });
      if (res.canceled || !res.assets?.[0]) return;
      handlePickedAsset(res.assets[0], "snapshot.jpg");
    } catch {
      // ignore — picker errors are usually permission cancellations
    }
  }, [handlePickedAsset, pickFromLibrary]);

  // Tapping "+" opens a tiny chooser. On iOS/Android we use the native
  // Alert sheet (cheapest cross-platform action sheet) so the user picks
  // Camera vs Library; on web we go straight to the file picker since
  // there's no native camera UI to invoke.
  const onAttachmentPress = useCallback(() => {
    if (Platform.OS === "web") {
      void pickFromLibrary();
      return;
    }
    Alert.alert(
      "Attach an image",
      "Snap a photo of what you're working on, or pick one from your library.",
      [
        { text: "Camera", onPress: () => void pickFromCamera() },
        { text: "Photo Library", onPress: () => void pickFromLibrary() },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true },
    );
  }, [pickFromCamera, pickFromLibrary]);

  // Footer below the chat list: typing indicator, then per-turn suggestions
  // and action card so they always appear right under the latest assistant
  // message regardless of how the FlatList grows.
  const footer = useMemo(() => {
    // While a stream is open, show the in-progress assistant reply as
    // a live ChatBubble that updates with each delta. If we haven't
    // received the first delta yet (or this is a non-streaming vision
    // turn via coach.isPending), fall back to the thinking indicator.
    if (isStreaming && typer.displayed.length > 0) {
      return (
        <ChatBubble role="assistant" content={typer.displayed} />
      );
    }
    if (coach.isPending || isStreaming) {
      return (
        <View style={styles.typing}>
          <View style={styles.typingDotSlot}>
            <BrandDot size="sm" mode="thinking" />
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.suggestedRepliesRow}
          >
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
                  numberOfLines={1}
                  style={[
                    styles.suggestedReplyText,
                    { color: colors.primary, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  {s}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
      </View>
    );
    // onActionPress / send change identity every render but are safe to omit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    coach.isPending,
    isStreaming,
    typer.displayed,
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
          <Pressable
            onPress={() => setSidebarOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Open chat history"
            testID="open-sidebar"
            style={({ pressed }) => [
              styles.hamburgerBtn,
              {
                borderColor: colors.border,
                backgroundColor: colors.muted,
                opacity: pressed ? 0.7 : 1,
              },
            ]}
          >
            <Feather name="menu" size={16} color={colors.foreground} />
          </Pressable>
          <View style={{ flex: 1 }}>
            <AtlasLogo size="lg" />
          </View>
          <View style={styles.headerChipRow}>
            <ActiveGoalChip />
            <WorkingOnInfoButton
              headline={activeRoadmap.headline}
              memory={activeCoachMemory}
              onForgetMemory={onForgetMemory}
            />
          </View>
        </View>
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.suggestions}
          >
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
                  numberOfLines={1}
                  style={[
                    styles.suggestionText,
                    { color: colors.foreground, fontFamily: "Inter_500Medium" },
                  ]}
                >
                  {s}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
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
    <ChatSessionsSidebar
      visible={sidebarOpen}
      onClose={() => setSidebarOpen(false)}
      sessions={activeCoachSessions}
      activeSessionId={activeCoachSessionId}
      goalTitle={activeGoal?.profile?.goalType ?? ""}
      onNewChat={onNewChat}
      onPickSession={onPickSession}
      onDeleteSession={onDeleteSession}
    />
    </View>
  );
}

// ---------------------------------------------------------------------------
// ChatGPT-style sidebar listing every coaching session for the active goal.
// Slides in from the left over a dim backdrop. Each row shows the session
// title, a one-line preview of the latest message, and the time it landed.
// Long-press (or the trash icon) deletes a session after confirmation.
// ---------------------------------------------------------------------------

function ChatSessionsSidebar({
  visible,
  onClose,
  sessions,
  activeSessionId,
  goalTitle,
  onNewChat,
  onPickSession,
  onDeleteSession,
}: {
  visible: boolean;
  onClose: () => void;
  sessions: ChatSession[];
  activeSessionId: string | null;
  goalTitle: string;
  onNewChat: () => void;
  onPickSession: (id: string) => void;
  onDeleteSession: (id: string, title: string) => void;
}) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  // Newest first; sessions without messages bubble to the top via createdAt.
  const ordered = [...sessions].sort((a, b) => {
    const aT = Date.parse(a.lastMessageAt || a.createdAt) || 0;
    const bT = Date.parse(b.lastMessageAt || b.createdAt) || 0;
    return bT - aT;
  });
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={sidebarStyles.backdropRow}>
        <View
          style={[
            sidebarStyles.panel,
            {
              backgroundColor: colors.background,
              borderRightColor: colors.border,
              paddingTop: insets.top + 12,
              paddingBottom: insets.bottom + 12,
            },
          ]}
        >
          <View style={sidebarStyles.panelHeader}>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  sidebarStyles.eyebrow,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
                numberOfLines={1}
              >
                {goalTitle ? goalTitle.toUpperCase() : "CHATS"}
              </Text>
              <Text
                style={[
                  sidebarStyles.title,
                  { color: colors.foreground, fontFamily: "Inter_700Bold" },
                ]}
              >
                Chats
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityLabel="Close chat history"
              style={({ pressed }) => [
                sidebarStyles.iconBtn,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.muted,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Feather name="x" size={16} color={colors.foreground} />
            </Pressable>
          </View>

          <Pressable
            onPress={onNewChat}
            style={({ pressed }) => [
              sidebarStyles.newBtn,
              {
                backgroundColor: colors.primary,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
            testID="new-chat-button"
          >
            <Feather name="plus" size={16} color={colors.primaryForeground} />
            <Text
              style={[
                sidebarStyles.newBtnText,
                {
                  color: colors.primaryForeground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              New chat
            </Text>
          </Pressable>

          {ordered.length === 0 ? (
            <View style={sidebarStyles.empty}>
              <Text
                style={[
                  sidebarStyles.emptyText,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_500Medium",
                  },
                ]}
              >
                No chats yet. Tap "New chat" to start.
              </Text>
            </View>
          ) : (
            <FlatList
              data={ordered}
              keyExtractor={(s) => s.id}
              contentContainerStyle={{ paddingVertical: 8 }}
              renderItem={({ item }) => {
                const isActive = item.id === activeSessionId;
                const lastMsg =
                  item.messages.length > 0
                    ? item.messages[item.messages.length - 1].content
                    : "";
                const preview = lastMsg.replace(/\s+/g, " ").trim();
                return (
                  <Pressable
                    onPress={() => onPickSession(item.id)}
                    onLongPress={() => onDeleteSession(item.id, item.title)}
                    style={({ pressed }) => [
                      sidebarStyles.row,
                      {
                        borderColor: colors.border,
                        backgroundColor: isActive
                          ? colors.primary + "18"
                          : pressed
                            ? colors.muted
                            : "transparent",
                      },
                    ]}
                    testID={`session-row-${item.id}`}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text
                        numberOfLines={1}
                        style={[
                          sidebarStyles.rowTitle,
                          {
                            color: colors.foreground,
                            fontFamily: "Inter_600SemiBold",
                          },
                        ]}
                      >
                        {item.title || "New chat"}
                      </Text>
                      {preview ? (
                        <Text
                          numberOfLines={1}
                          style={[
                            sidebarStyles.rowPreview,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_400Regular",
                            },
                          ]}
                        >
                          {preview}
                        </Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => onDeleteSession(item.id, item.title)}
                      hitSlop={8}
                      accessibilityLabel="Delete chat"
                      style={({ pressed }) => ({
                        padding: 6,
                        opacity: pressed ? 0.6 : 0.8,
                      })}
                    >
                      <Feather
                        name="trash-2"
                        size={14}
                        color={colors.mutedForeground}
                      />
                    </Pressable>
                  </Pressable>
                );
              }}
            />
          )}
        </View>
        <Pressable
          style={sidebarStyles.dismiss}
          onPress={onClose}
          accessibilityLabel="Close chat history"
        />
      </View>
    </Modal>
  );
}

const sidebarStyles = StyleSheet.create({
  backdropRow: {
    flex: 1,
    flexDirection: "row",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  panel: {
    width: "82%",
    maxWidth: 360,
    borderRightWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
  },
  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  eyebrow: { fontSize: 10, letterSpacing: 1.2 },
  title: { fontSize: 22, marginTop: 2 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 6,
  },
  newBtnText: { fontSize: 14 },
  empty: { paddingTop: 28, paddingHorizontal: 8 },
  emptyText: { fontSize: 13, lineHeight: 18 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 2,
  },
  rowTitle: { fontSize: 14 },
  rowPreview: { fontSize: 12, marginTop: 2 },
  dismiss: { flex: 1 },
});

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

// Small "i" affordance that sits next to the active goal chip and reveals
// the current roadmap headline on tap. Replaces the previous always-visible
// "Working on: …" subtitle so the header reads cleaner while keeping the
// information one tap away.
function WorkingOnInfoButton({
  headline,
  memory,
  onForgetMemory,
}: {
  headline: string;
  memory: CoachMemory | null;
  onForgetMemory: () => void | Promise<void>;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const facts = memory?.facts ?? [];
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Working on and remembered context"
        style={({ pressed }) => [
          infoStyles.btn,
          {
            borderColor: colors.border,
            backgroundColor: colors.muted,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        testID="info-button"
      >
        <Feather name="info" size={13} color={colors.mutedForeground} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={infoStyles.backdrop}
          onPress={() => setOpen(false)}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              infoStyles.sheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Text
              style={[
                infoStyles.eyebrow,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              WORKING ON
            </Text>
            <Text
              style={[
                infoStyles.body,
                {
                  color: colors.foreground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              {headline}
            </Text>

            {memory ? (
              <>
                <View
                  style={[
                    infoStyles.divider,
                    { backgroundColor: colors.border },
                  ]}
                />
                <Text
                  style={[
                    infoStyles.eyebrow,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  WHAT RUBAI REMEMBERS
                </Text>
                <Text
                  style={[
                    infoStyles.body,
                    {
                      color: colors.foreground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  {memory.summary}
                </Text>
                {facts.length > 0 ? (
                  <ScrollView
                    style={infoStyles.factsScroll}
                    contentContainerStyle={infoStyles.factsList}
                    showsVerticalScrollIndicator={false}
                  >
                    {facts.map((f: string) => (
                      <View
                        key={f}
                        style={[
                          infoStyles.factPill,
                          {
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            infoStyles.factText,
                            {
                              color: colors.foreground,
                              fontFamily: "Inter_500Medium",
                            },
                          ]}
                        >
                          {f}
                        </Text>
                      </View>
                    ))}
                  </ScrollView>
                ) : null}
                <Pressable
                  onPress={async () => {
                    await onForgetMemory();
                    setOpen(false);
                  }}
                  style={infoStyles.forgetBtn}
                  testID="forget-memory"
                >
                  <Feather
                    name="trash-2"
                    size={14}
                    color={colors.destructive}
                  />
                  <Text
                    style={[
                      infoStyles.forgetText,
                      {
                        color: colors.destructive,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    Forget everything
                  </Text>
                </Pressable>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const infoStyles = StyleSheet.create({
  btn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  sheet: {
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 6,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.4,
  },
  body: {
    fontSize: 15,
    lineHeight: 21,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
    marginHorizontal: -18,
  },
  factsScroll: {
    marginTop: 8,
    maxHeight: 240,
  },
  factsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  factPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: "100%",
    flexShrink: 1,
  },
  factText: {
    fontSize: 12,
    flexShrink: 1,
    flexWrap: "wrap",
  },
  forgetBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingVertical: 6,
    marginTop: 8,
  },
  forgetText: {
    fontSize: 12.5,
  },
});

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
  hamburgerBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
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
  headerChipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
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
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
    paddingVertical: 2,
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
