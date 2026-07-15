import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
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
import Animated, {
  FadeIn,
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  Easing,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActiveGoalChip } from "@/components/ActiveGoalChip";
import { AtlasLogo } from "@/components/AtlasLogo";
import { BrandDot } from "@/components/BrandDot";
import { ChatBubble } from "@/components/ChatBubble";
import { EmptyState } from "@/components/EmptyState";
import { useColors } from "@/hooks/useColors";
import { useEvolveRoadmap } from "@/hooks/useEvolveRoadmap";
import { useTextToSpeech } from "@/hooks/useTextToSpeech";
import { useVoiceRecorder, type RecordedClip } from "@/hooks/useVoiceRecorder";
import { useAtlas } from "@/providers/AtlasProvider";
import {
  loadCalendarContextIfEnabled,
  writePlanToCalendarOnDemand,
  writePlanToCalendarIfEnabled,
  writeSingleEventOnDemand,
  type WriteOutcome,
} from "@/lib/calendar";
import { todayISO } from "@/lib/storage";
import {
  customFetch,
  useAtlasCoach,
  useAtlasGenerateDailyPlan,
  useAtlasGenerateTitle,
  type ChatMessage,
  type CoachActionSuggestion,
  type ProposedCoachAction,
} from "@workspace/api-client-react";
import {
  encodeImageAttachment,
  encodeFileAttachment,
  stripAttachmentMeta,
} from "@/lib/attachmentEncoding";
import { streamCoachReply, type CoachStreamFinal } from "@/lib/coachStream";
import i18n from "@/lib/i18n";
import { useTypewriter } from "@/lib/useTypewriter";
import type { CoachMemory } from "@workspace/api-client-react";
import type { ChatSession } from "@/types/atlas";


type ModelChoice = "smart" | "fast";

// Turns a calendar WriteOutcome into a short, honest user-facing line. Used
// when an AI calendar action succeeds or hits a consent/permission gap.
function calendarOutcomeMessage(
  outcome: WriteOutcome,
  calendarTitle?: string | null,
): string {
  if (outcome.ok) {
    const target = calendarTitle ?? i18n.t("coach.yourCalendar", "your calendar");
    return outcome.written === 1
      ? i18n.t("coach.addedTaskToCalendar", "Added {{count}} task to {{target}}.", { count: outcome.written, target })
      : i18n.t("coach.addedTasksToCalendar", "Added {{count}} tasks to {{target}}.", { count: outcome.written, target });
  }
  switch (outcome.reason) {
    case "no-permission":
      return i18n.t("coach.calNoPermission", "I need calendar permission first. Open Account → Calendar sync to grant access.");
    case "no-calendar":
      return i18n.t("coach.calNoCalendar", "Pick a calendar in Account → Calendar sync, then ask me again.");
    case "web":
      return i18n.t("coach.calWeb", "Calendar sync is mobile-only — try this from the iOS or Android app.");
    case "disabled":
      return i18n.t("coach.calDisabled", "Turn on calendar sync in Account → Calendar sync first.");
    default:
      return i18n.t("coach.calNothing", "There's nothing to add to your calendar yet.");
  }
}

type PendingAttachment = {
  /** "image" for photos/camera; "file" for documents. */
  kind: "image" | "file";
  filename: string;
  /** A short label we show in the input (e.g. "photo · 1.2MB"). */
  label: string;
  /** Base64-encoded image bytes (no data URL prefix). Set when the user
   *  picks an image so the server can run vision on this turn. */
  base64?: string;
  /** MIME type of the picked image, e.g. "image/jpeg" or "image/png".
   *  Combined with `base64` to build a data URL for the vision model. */
  mimeType?: string;
  /** Text content for text-based files. Passed to the coach so it can
   *  read and reason about the document (txt, md, csv, json, etc.). */
  fileContent?: string;
  /** Local file URI used for thumbnail display in the chat bubble. */
  uri?: string;
};

export default function CoachScreen() {
  const { t } = useTranslation();
  const coldStartSuggestions = useMemo(
    () => [
      t("coach.suggestionStuck", "I'm feeling stuck today"),
      t("coach.suggestionEasier", "Make today's plan easier"),
      t("coach.suggestionHarder", "Push me harder this week"),
      t("coach.suggestionFocus", "What should I focus on?"),
    ],
    [t],
  );
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 8;
  const bottomPad = isWeb ? 84 : insets.bottom + 72;

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
  const generateDaily = useAtlasGenerateDailyPlan();
  const { evolve, isEvolving } = useEvolveRoadmap();
  const recorder = useVoiceRecorder();
  const tts = useTextToSpeech();
  const [draft, setDraft] = useState("");
  const inputRef = useRef<TextInput>(null);
  const [lastSuggestedReplies, setLastSuggestedReplies] = useState<string[]>([]);
  const [lastAction, setLastAction] = useState<CoachActionSuggestion | null>(null);
  const [applyingAction, setApplyingAction] = useState(false);
  // Transient "Undo" bar shown right after the AI applies a change instantly.
  // `onUndo` is null for non-revertible actions (e.g. calendar writes) — the
  // bar then just confirms what happened and auto-dismisses.
  const [undoBar, setUndoBar] = useState<{
    message: string;
    onUndo: (() => Promise<void>) | null;
  } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modelChoice, setModelChoice] = useState<ModelChoice>("smart");
  const [conversationMode, setConversationMode] = useState<"coach" | "normal">("coach");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false); // TODO: voice output — implement later
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [pendingAttachment, setPendingAttachment] =
    useState<PendingAttachment | null>(null);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const plusBtnRef = useRef<View>(null);
  const [menuAnchor, setMenuAnchor] = useState({ x: 0, y: 0, w: 0 });
  const [transcribing, setTranscribing] = useState(false);
  // Streaming state. `isStreaming` is true from request start until the
  // `final` SSE event lands, even before the first delta — so the typing
  // indicator shows immediately. The typewriter smooths the bursty SSE
  // deltas into a steady word-by-word reveal (a fronting proxy can buffer
  // the stream and deliver big chunks, which would otherwise make the
  // reply pop in all at once). `typer.displayed` is what we render.
  const typer = useTypewriter();
  const [isStreaming, setIsStreaming] = useState(false);
  // True while the server-side agent is running tools (memory search /
  // task history) before the reply starts streaming. Drives a small
  // caption under the thinking indicator.
  const [agentWorking, setAgentWorking] = useState(false);
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
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    };
  }, []);

  // Log session_started behavioral event each time the coach tab gains focus.
  // Fire-and-forget — never blocks UI or throws.
  useFocusEffect(
    useCallback(() => {
      customFetch("/api/atlas/session-start", { method: "POST" }).catch(() => {});
    }, []),
  );

  useEffect(() => {
    if (activeCoachHistory.length === 0 && activeProfile && activeRoadmap) {
      const opener: ChatMessage = {
        role: "assistant",
        content: t("coach.opener", "I'm here. We're working on {{headline}}. Tell me what's on your mind, what got in the way, or what you want to push on.", { headline: activeRoadmap.headline.toLowerCase() }),
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
      Alert.alert(t("coach.voice", "Voice"), msg);
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

      // Pin (goalId, sessionId) AT SEND TIME so a late stream completion or
      // image-turn response can't land in whichever session happens to be
      // active by the time the network call returns. The provider's
      // `appendCoachMessageToSession` is a no-op if the pinned session was
      // deleted while the request was in flight.
      const pinnedGoalId = activeGoal?.id ?? null;
      const pinnedSessionId = activeCoachSessionId;
      if (!pinnedGoalId || !pinnedSessionId) return;

      const visibleContent =
        attachment?.kind === "image" && attachment.uri
          ? encodeImageAttachment(attachment.uri, message)
          : attachment?.kind === "file"
            ? encodeFileAttachment(attachment.filename, message)
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
        history: activeCoachHistory
          .slice(-10)
          .map((m) => ({ ...m, content: stripAttachmentMeta(m.content) })),
        message,
        conversationMode,
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
        ...(attachment
          ? {
              attachmentNote: attachment.fileContent
                ? `File: ${attachment.filename}\n\n${attachment.fileContent.slice(0, 6000)}`
                : attachment.filename,
            }
          : {}),
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
        // Agentic coach: apply the proposed change INSTANTLY (with Undo) instead
        // of surfacing a confirm card. The model already spoke as if it acted.
        if (res.proposedAction) {
          void applyActionInstant(res.proposedAction);
        }
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
                  setAgentWorking(false);
                  accumulated += chunk;
                  typer.push(accumulated);
                },
                onFinal: (res) => {
                  finalRes = res;
                },
                onStatus: (stage) => {
                  if (stage === "tools") setAgentWorking(true);
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
            setAgentWorking(false);
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
        const isQuotaExceeded =
          err instanceof Error && err.message === "quota_exceeded";
        const errMsg: ChatMessage = {
          role: "assistant",
          content: isQuotaExceeded
            ? t("coach.quotaExceeded", "Günlük AI limitinə çatdın. Daha çox istifadə üçün planını yüksəlt. 🚀")
            : t("coach.connectionLost", "Bağlantı bir anlığa kəsildi. Mesajını yenidən göndər — davam edək."),
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
      conversationMode,
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

  // Consume params handed in by the CoachQuickBar on Today / Roadmap / Goals.
  // `prefill` + `autostart` → send the prompt; `focus` → just focus the input.
  // We key off the prefill text so the same chip can be tapped again later
  // (params are cleared after handling, which resets the guard).
  const params = useLocalSearchParams<{
    prefill?: string;
    autostart?: string;
    focus?: string;
  }>();
  const handledPrefillRef = useRef<string | null>(null);
  useEffect(() => {
    if (params.focus === "1") {
      router.setParams({ focus: "" });
      const t = setTimeout(() => inputRef.current?.focus(), 350);
      return () => clearTimeout(t);
    }
  }, [params.focus, router]);
  useEffect(() => {
    const prefill =
      typeof params.prefill === "string" ? params.prefill.trim() : "";
    if (!prefill) {
      handledPrefillRef.current = null;
      return;
    }
    if (handledPrefillRef.current === prefill) return;
    const auto = params.autostart === "1";
    // A turn already in flight is a *transient* block — wait for it to settle
    // (deps below re-run this effect) before consuming the param.
    if (auto && (coach.isPending || isStreaming)) return;
    handledPrefillRef.current = prefill;
    router.setParams({ prefill: "", autostart: "" });
    // Only auto-send when the coach is actually unlocked. If there's no active
    // profile/roadmap the coach screen is locked, so we can't (and must not
    // later silently) send — stash the text as a draft instead so the param is
    // consumed now and never fires unexpectedly once prerequisites appear.
    if (auto && activeProfile && activeRoadmap) {
      void send(prefill);
    } else {
      setDraft(prefill);
      setTimeout(() => inputRef.current?.focus(), 350);
    }
  }, [
    params.prefill,
    params.autostart,
    activeProfile,
    activeRoadmap,
    coach.isPending,
    isStreaming,
    send,
    router,
  ]);

  const onNewChat = useCallback(async () => {
    setSidebarOpen(false);
    setLastSuggestedReplies([]);
    setLastAction(null);
    setUndoBar(null);
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
      setUndoBar(null);
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
        if (window.confirm(t("coach.deleteConfirmWeb", 'Delete "{{title}}"?', { title }))) goAhead();
        return;
      }
      Alert.alert(
        t("coach.deleteChatTitle", "Delete chat"),
        t("coach.deleteChatMessage", 'Delete "{{title}}"? This cannot be undone.', { title }),
        [
          { text: t("coach.cancel", "Cancel"), style: "cancel" },
          { text: t("coach.delete", "Delete"), style: "destructive", onPress: goAhead },
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

  // Show a transient Undo bar (auto-dismisses after 8s). `onUndo` is null for
  // actions that can't be reverted (calendar writes).
  const showUndo = useCallback(
    (message: string, onUndo: (() => Promise<void>) | null) => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      setUndoBar({ message, onUndo });
      undoTimerRef.current = setTimeout(() => {
        setUndoBar(null);
        undoTimerRef.current = null;
      }, 8000);
    },
    [],
  );

  const onUndoPress = useCallback(async () => {
    const bar = undoBar;
    if (!bar?.onUndo) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    undoTimerRef.current = null;
    setUndoBar(null);
    try {
      await bar.onUndo();
      await appendActiveCoachMessage({
        role: "assistant",
        content: t("coach.reverted", "Reverted — back to how it was."),
      });
    } catch {
      // best-effort revert; ignore failures
    }
  }, [undoBar, appendActiveCoachMessage]);

  // Agentic apply: run the AI's proposed change IMMEDIATELY against local state
  // (the source of truth syncs in the background), then expose Undo. The model
  // already narrated what it did + why in its streamed reply, so for successful
  // changes we only surface the Undo bar; failures append an honest correction.
  const applyActionInstant = useCallback(
    async (action: ProposedCoachAction) => {
      if (applyingAction) return;
      setApplyingAction(true);
      try {
        const planSnapshot = activeDailyPlan?.plan ?? null;
        const restorePlan = planSnapshot
          ? async () => {
              await setActiveDailyPlan(planSnapshot);
            }
          : null;
        let confirmation = t("coach.done", "Done.");
        let undoFn: (() => Promise<void>) | null = null;
        let permanentNote: string | null = null;
        let applied = false;

        switch (action.kind) {
          case "addTaskToday": {
            if (action.task && planSnapshot) {
              await setActiveDailyPlan({
                ...planSnapshot,
                tasks: [...planSnapshot.tasks, action.task],
              });
              confirmation = t("coach.addedTaskToday", 'Added "{{title}}" to today.', { title: action.task.title });
              undoFn = restorePlan;
              applied = true;
            }
            break;
          }
          case "addTasksToday": {
            const tasks = action.tasks ?? [];
            if (tasks.length > 0 && planSnapshot) {
              await setActiveDailyPlan({
                ...planSnapshot,
                tasks: [...planSnapshot.tasks, ...tasks],
              });
              confirmation = tasks.length === 1
                ? t("coach.addedTasksTodayOne", "Added {{count}} task to today.", { count: tasks.length })
                : t("coach.addedTasksTodayMany", "Added {{count}} tasks to today.", { count: tasks.length });
              undoFn = restorePlan;
              applied = true;
            }
            break;
          }
          case "removeTaskToday": {
            if (action.taskId && planSnapshot) {
              const removed = planSnapshot.tasks.find(
                (t) => t.id === action.taskId,
              );
              await setActiveDailyPlan({
                ...planSnapshot,
                tasks: planSnapshot.tasks.filter((t) => t.id !== action.taskId),
              });
              confirmation = removed
                ? t("coach.removedTaskToday", 'Removed "{{title}}" from today.', { title: removed.title })
                : t("coach.removedThatTask", "Removed that task.");
              undoFn = restorePlan;
              applied = true;
            }
            break;
          }
          case "editTaskToday": {
            const patch = action.taskPatch;
            if (action.taskId && patch && planSnapshot) {
              const edited = planSnapshot.tasks.find(
                (t) => t.id === action.taskId,
              );
              await setActiveDailyPlan({
                ...planSnapshot,
                tasks: planSnapshot.tasks.map((t) =>
                  t.id === action.taskId
                    ? {
                        ...t,
                        ...(patch.title != null ? { title: patch.title } : {}),
                        ...(patch.description != null
                          ? { description: patch.description }
                          : {}),
                        ...(patch.durationMinutes != null
                          ? { durationMinutes: patch.durationMinutes }
                          : {}),
                        ...(patch.category != null
                          ? { category: patch.category }
                          : {}),
                        ...(patch.priority != null
                          ? { priority: patch.priority }
                          : {}),
                      }
                    : t,
                ),
              });
              confirmation = edited
                ? t("coach.updatedTask", 'Updated "{{title}}".', { title: edited.title })
                : t("coach.updatedThatTask", "Updated that task.");
              undoFn = restorePlan;
              applied = true;
            }
            break;
          }
          case "lightenToday": {
            const ids = action.removeTaskIds ?? [];
            if (ids.length > 0 && planSnapshot) {
              const drop = new Set(ids);
              await setActiveDailyPlan({
                ...planSnapshot,
                tasks: planSnapshot.tasks.filter((t) => !drop.has(t.id)),
              });
              confirmation = ids.length === 1
                ? t("coach.lightenedTodayOne", "Lightened today by {{count}} task.", { count: ids.length })
                : t("coach.lightenedTodayMany", "Lightened today by {{count}} tasks.", { count: ids.length });
              undoFn = restorePlan;
              applied = true;
            }
            break;
          }
          case "renameGoal": {
            if (action.newTitle) {
              const newTitle = action.newTitle;
              // Capture the EXACT prior value (may be undefined for a
              // non-custom goal) so Undo restores it precisely instead of
              // leaving the renamed title in place.
              const prevTitle: string | undefined =
                activeGoal?.profile?.customGoalTitle;
              await updateActiveGoal((g) => ({
                ...g,
                profile: { ...g.profile, customGoalTitle: newTitle },
              }));
              confirmation = t("coach.renamedGoal", 'Renamed your goal to "{{title}}".', { title: newTitle });
              undoFn = async () => {
                await updateActiveGoal((g) => ({
                  ...g,
                  profile: { ...g.profile, customGoalTitle: prevTitle },
                }));
              };
              applied = true;
            }
            break;
          }
          case "regenerateDay": {
            if (activeProfile && activeRoadmap) {
              const calendarContext = await loadCalendarContextIfEnabled(
                account.calendarSync,
              );
              const plan = await generateDaily.mutateAsync({
                data: {
                  profile: activeProfile,
                  roadmap: activeRoadmap,
                  behavioral: activeBehavioral,
                  date: todayISO(),
                  currentWeek: activeCurrentWeek,
                  ...(activeBehavioralProfile
                    ? { learnedProfile: activeBehavioralProfile }
                    : {}),
                  ...(calendarContext ? { calendarContext } : {}),
                  ...(account.preferredLanguage ? { preferredLanguage: account.preferredLanguage } : {}),
                },
              });
              await setActiveDailyPlan(plan);
              void writePlanToCalendarIfEnabled(
                account.calendarSync,
                plan,
                account.reminderTime,
              );
              confirmation = t("coach.rebuiltPlan", "Rebuilt today's plan from scratch.");
              undoFn = restorePlan;
              applied = true;
            }
            break;
          }
          case "syncToCalendar": {
            const outcome = await writePlanToCalendarOnDemand(
              account.calendarSync,
              planSnapshot,
            );
            const msg = calendarOutcomeMessage(
              outcome,
              account.calendarSync.calendarTitle,
            );
            if (outcome.ok) {
              confirmation = msg;
              applied = true;
            } else {
              permanentNote = msg;
            }
            break;
          }
          case "addCalendarEvent": {
            if (action.event) {
              const outcome = await writeSingleEventOnDemand(
                account.calendarSync,
                action.event,
              );
              if (outcome.ok) {
                confirmation = t("coach.addedEventToCalendar", 'Added "{{title}}" to {{target}}.', { title: action.event.title, target: account.calendarSync.calendarTitle ?? t("coach.yourCalendar", "your calendar") });
                applied = true;
              } else {
                permanentNote = calendarOutcomeMessage(
                  outcome,
                  account.calendarSync.calendarTitle,
                );
              }
            }
            break;
          }
          case "editMilestone": {
            const { milestonePhaseId, milestoneId, milestonePatch } = action;
            if (milestonePhaseId && milestoneId && milestonePatch && activeRoadmap) {
              const prevRoadmap = activeRoadmap;
              const edited = activeRoadmap.phases
                .find((p) => p.id === milestonePhaseId)
                ?.milestones.find((m) => m.id === milestoneId);
              await updateActiveGoal((g) => {
                if (!g.roadmap) return g;
                return {
                  ...g,
                  roadmap: {
                    ...g.roadmap,
                    phases: g.roadmap.phases.map((phase) =>
                      phase.id !== milestonePhaseId
                        ? phase
                        : {
                            ...phase,
                            milestones: phase.milestones.map((m) =>
                              m.id !== milestoneId
                                ? m
                                : {
                                    ...m,
                                    ...(milestonePatch.title != null
                                      ? { title: milestonePatch.title }
                                      : {}),
                                    ...(milestonePatch.description != null
                                      ? { description: milestonePatch.description }
                                      : {}),
                                  },
                            ),
                          },
                    ),
                  },
                };
              });
              confirmation = edited
                ? t("coach.updatedMilestone", 'Updated milestone "{{title}}".', { title: edited.title })
                : t("coach.updatedMilestoneGeneric", "Updated milestone.");
              undoFn = async () => {
                await updateActiveGoal((g) => ({ ...g, roadmap: prevRoadmap }));
              };
              applied = true;
            }
            break;
          }
          case "addMilestone": {
            const { milestonePhaseId, newMilestone } = action;
            if (milestonePhaseId && newMilestone && activeRoadmap) {
              const prevRoadmap = activeRoadmap;
              const newId = `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
              await updateActiveGoal((g) => {
                if (!g.roadmap) return g;
                return {
                  ...g,
                  roadmap: {
                    ...g.roadmap,
                    phases: g.roadmap.phases.map((phase) =>
                      phase.id !== milestonePhaseId
                        ? phase
                        : {
                            ...phase,
                            milestones: [
                              ...phase.milestones,
                              {
                                id: newId,
                                title: newMilestone.title,
                                description: newMilestone.description,
                                weekNumber: newMilestone.weekNumber,
                              },
                            ],
                          },
                    ),
                  },
                };
              });
              confirmation = t("coach.addedMilestone", 'Added milestone "{{title}}".', { title: newMilestone.title });
              undoFn = async () => {
                await updateActiveGoal((g) => ({ ...g, roadmap: prevRoadmap }));
              };
              applied = true;
            }
            break;
          }
          case "removeMilestone": {
            const { milestonePhaseId, milestoneId } = action;
            if (milestonePhaseId && milestoneId && activeRoadmap) {
              const prevRoadmap = activeRoadmap;
              const removed = activeRoadmap.phases
                .find((p) => p.id === milestonePhaseId)
                ?.milestones.find((m) => m.id === milestoneId);
              await updateActiveGoal((g) => {
                if (!g.roadmap) return g;
                return {
                  ...g,
                  roadmap: {
                    ...g.roadmap,
                    phases: g.roadmap.phases.map((phase) =>
                      phase.id !== milestonePhaseId
                        ? phase
                        : {
                            ...phase,
                            milestones: phase.milestones.filter(
                              (m) => m.id !== milestoneId,
                            ),
                          },
                    ),
                  },
                };
              });
              confirmation = removed
                ? t("coach.removedMilestone", 'Removed milestone "{{title}}".', { title: removed.title })
                : t("coach.removedMilestoneGeneric", "Removed milestone.");
              undoFn = async () => {
                await updateActiveGoal((g) => ({ ...g, roadmap: prevRoadmap }));
              };
              applied = true;
            }
            break;
          }
          case "editPhase": {
            const { phaseId, phasePatch } = action;
            if (phaseId && phasePatch && activeRoadmap) {
              const prevRoadmap = activeRoadmap;
              const editedPhase = activeRoadmap.phases.find((p) => p.id === phaseId);
              await updateActiveGoal((g) => {
                if (!g.roadmap) return g;
                return {
                  ...g,
                  roadmap: {
                    ...g.roadmap,
                    phases: g.roadmap.phases.map((phase) =>
                      phase.id !== phaseId
                        ? phase
                        : {
                            ...phase,
                            ...(phasePatch.title != null
                              ? { title: phasePatch.title }
                              : {}),
                            ...(phasePatch.focus != null
                              ? { focus: phasePatch.focus }
                              : {}),
                          },
                    ),
                  },
                };
              });
              confirmation = editedPhase
                ? t("coach.updatedPhase", 'Updated phase "{{title}}".', { title: editedPhase.title })
                : t("coach.updatedPhaseGeneric", "Updated phase.");
              undoFn = async () => {
                await updateActiveGoal((g) => ({ ...g, roadmap: prevRoadmap }));
              };
              applied = true;
            }
            break;
          }
        }

        if (permanentNote) {
          await appendActiveCoachMessage({
            role: "assistant",
            content: permanentNote,
          });
        } else if (applied) {
          showUndo(confirmation, undoFn);
        } else {
          await appendActiveCoachMessage({
            role: "assistant",
            content: t("coach.couldntApply", "I couldn't apply that just now — want me to try again?"),
          });
        }
      } catch {
        await appendActiveCoachMessage({
          role: "assistant",
          content: t("coach.couldntApply", "I couldn't apply that just now — want me to try again?"),
        });
      } finally {
        setApplyingAction(false);
      }
    },
    [
      applyingAction,
      activeDailyPlan,
      setActiveDailyPlan,
      updateActiveGoal,
      appendActiveCoachMessage,
      account.calendarSync,
      account.reminderTime,
      activeGoal,
      activeProfile,
      activeRoadmap,
      activeBehavioral,
      activeCurrentWeek,
      activeBehavioralProfile,
      generateDaily,
      showUndo,
    ],
  );

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
          err instanceof Error ? err.message : t("coach.transcribeFailed", "Couldn't transcribe that clip.");
        if (Platform.OS === "web") {
          // eslint-disable-next-line no-alert
          window.alert(message);
        } else {
          Alert.alert(t("coach.voice", "Voice"), message);
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
        kind: "image",
        filename,
        label,
        base64: asset.base64 ?? undefined,
        mimeType,
        uri: asset.uri,
      });
    },
    [],
  );

  const pickFromLibrary = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        if (Platform.OS !== "web") {
          Alert.alert(t("coach.photos", "Photos"), t("coach.photoPermission", "Allow photo access to attach an image."));
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
          t("coach.camera", "Camera"),
          t("coach.cameraPermission", "Allow camera access to snap what you're working on."),
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

  // Pick a document (txt, md, csv, json, pdf, docx, etc.) using the OS
  // file picker. For text-based files we read the content and include it
  // as `attachmentNote` so the coach can reason about it. Binary files
  // (PDF, Word, etc.) are attached by name only.
  const pickDocument = useCallback(async () => {
    setAttachMenuOpen(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const { name, size, mimeType, uri } = asset;
      const sizeKb = size ? Math.round(size / 1024) : null;
      const label = sizeKb ? `${name} · ${formatSize(sizeKb)}` : name;

      // For text-based formats, read the content so the coach can see it.
      let fileContent: string | undefined;
      const isText =
        (mimeType &&
          (mimeType.startsWith("text/") ||
            mimeType === "application/json" ||
            mimeType === "application/xml")) ||
        /\.(txt|md|markdown|csv|json|xml|yaml|yml|log|js|ts|py|sh)$/i.test(
          name,
        );
      if (isText) {
        try {
          const res = await fetch(uri);
          fileContent = await res.text();
        } catch {
          // Can't read — fall back to name-only attachment
        }
      }

      setPendingAttachment({ kind: "file", filename: name, label, fileContent, uri });
    } catch {
      // User cancelled or permission denied — silently ignore
    }
  }, []);

  // Tapping "+" measures button position and opens floating popover above it.
  const onAttachmentPress = useCallback(() => {
    plusBtnRef.current?.measureInWindow((px, py, pw) => {
      const screenW = Dimensions.get("window").width;
      const menuW = 240;
      const left = Math.min(Math.max(px, 8), screenW - menuW - 8);
      setMenuAnchor({ x: left, y: py, w: menuW });
      setAttachMenuOpen(true);
    });
  }, []);

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
          {agentWorking ? (
            <Text style={[styles.agentWorkingText, { color: colors.mutedForeground }]}>
              {t("coach.agentWorking", "Tarixçənə baxıram…")}
            </Text>
          ) : null}
        </View>
      );
    }
    return (
      <View style={styles.footerStack}>
        {undoBar ? (
          <View
            style={[
              styles.undoBar,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Feather
              name="check-circle"
              size={16}
              color={colors.primary}
              style={styles.undoIcon}
            />
            <Text
              style={[styles.undoText, { color: colors.text }]}
              numberOfLines={2}
            >
              {undoBar.message}
            </Text>
            {undoBar.onUndo ? (
              <Pressable
                onPress={onUndoPress}
                hitSlop={8}
                style={[styles.undoButton, { borderColor: colors.primary }]}
              >
                <Text style={[styles.undoButtonText, { color: colors.primary }]}>
                  {t("coach.undo", "Undo")}
                </Text>
              </Pressable>
            ) : null}
          </View>
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
    undoBar,
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
          title={t("coach.emptyTitle", "Coach unlocks after intake")}
          description={t("coach.emptyDesc", "Add a goal and finish the intake form first.")}
        />
      </View>
    );
  }

  const isRecording = recorder.state === "recording";
  const recordingSeconds = Math.floor(recorder.durationMs / 1000);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Dismiss overlay — same stacking context as dropdown card so zIndex works */}
      {dropdownOpen && (
        <Pressable
          style={[StyleSheet.absoluteFill, { zIndex: 150 }]}
          onPress={() => setDropdownOpen(false)}
        />
      )}

      {/* Dropdown card — rendered here (root level) so zIndex:200 beats overlay:150 */}
      {dropdownOpen && (
        <View
          style={[
            styles.dropdownCard,
            {
              top: topPad + 52,
              backgroundColor: colors.card,
              borderColor: colors.border,
              shadowColor: colors.foreground,
            },
          ]}
        >
          <ModelModeRow
            label={t("coach.smartLabel", "Smart")}
            desc={t("coach.smartDesc", "Best answers")}
            selected={modelChoice === "smart"}
            onPress={() => { setModelChoice("smart"); setDropdownOpen(false); }}
            colors={colors}
          />
          <View style={[styles.dropdownSep, { backgroundColor: colors.border }]} />
          <ModelModeRow
            label={t("coach.fastLabel", "Fast")}
            desc={t("coach.fastDesc", "Faster responses")}
            selected={modelChoice === "fast"}
            onPress={() => { setModelChoice("fast"); setDropdownOpen(false); }}
            colors={colors}
          />
          <View style={[styles.dropdownGroupDivider, { backgroundColor: colors.muted }]} />
          <ModelModeRow
            label={t("coach.coachLabel", "Coach")}
            desc={t("coach.coachModeDesc", "Goal-focused coaching")}
            selected={conversationMode === "coach"}
            onPress={() => { setConversationMode("coach"); setDropdownOpen(false); }}
            colors={colors}
          />
          <View style={[styles.dropdownSep, { backgroundColor: colors.border }]} />
          <ModelModeRow
            label={t("coach.generalLabel", "General")}
            desc={t("coach.generalModeDesc", "Free conversation")}
            selected={conversationMode === "normal"}
            onPress={() => { setConversationMode("normal"); setDropdownOpen(false); }}
            colors={colors}
          />
        </View>
      )}

    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={0}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View style={[styles.header, { paddingTop: topPad, zIndex: 100 }]}>
        <View style={styles.headerInner}>
          {/* Hamburger */}
          <Pressable
            onPress={() => setSidebarOpen(true)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t("coach.openChatHistory", "Open chat history")}
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

          {/* Logo + chevron — taps open/close the dropdown */}
          <Pressable
            onPress={() => setDropdownOpen((v) => !v)}
            hitSlop={10}
            testID="model-mode-dropdown-trigger"
            style={styles.logoPillWrap}
          >
            <AtlasLogo size="sm" />
            <Feather
              name={dropdownOpen ? "chevron-up" : "chevron-down"}
              size={11}
              color={colors.mutedForeground}
              style={{ marginLeft: 1, marginTop: 3 }}
            />
          </Pressable>

          {/* Right chips */}
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
            {coldStartSuggestions.map((s) => (
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

        {transcribing && (
          <View style={styles.transcribingRow}>
            <ActivityIndicator size="small" color={colors.mutedForeground} />
            <Text style={[styles.transcribingText, { color: colors.mutedForeground }]}>
              {t("coach.transcribing", "TRANSCRIBING…")}
            </Text>
          </View>
        )}

        {pendingAttachment ? (
          pendingAttachment.kind === "image" && pendingAttachment.uri ? (
            /* Image: show thumbnail preview with X button */
            <View style={styles.attachmentThumbWrap}>
              <Image
                source={{ uri: pendingAttachment.uri }}
                style={[
                  styles.attachmentThumb,
                  { borderColor: colors.border },
                ]}
                resizeMode="cover"
              />
              <Pressable
                onPress={() => setPendingAttachment(null)}
                hitSlop={6}
                testID="remove-attachment"
                style={[
                  styles.attachmentThumbX,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Feather name="x" size={12} color={colors.mutedForeground} />
              </Pressable>
            </View>
          ) : (
            /* File: show icon + name chip */
            <View
              style={[
                styles.attachmentRow,
                { borderColor: colors.border, backgroundColor: colors.card },
              ]}
            >
              <Feather name="file-text" size={13} color={colors.mutedForeground} />
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
          )
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
            ref={plusBtnRef}
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
                {t("coach.recording", "Recording {{time}}", { time: formatTime(recordingSeconds) })}
              </Text>
            </View>
          ) : (
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              placeholder={t("coach.inputPlaceholder", "Talk to your coach...")}
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

    {/* Attach-menu — floating popover above + button */}
    <Modal
      visible={attachMenuOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setAttachMenuOpen(false)}
    >
      <Pressable style={{ flex: 1 }} onPress={() => setAttachMenuOpen(false)} />
      <View
        style={[
          styles.attachMenuSheet,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            left: menuAnchor.x,
            top: menuAnchor.y - 178,
            width: menuAnchor.w,
          },
        ]}
      >
        {/* Header */}
        <Text style={[styles.attachMenuHeader, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          {t("coach.addAttachments", "Add attachments")}
        </Text>

        {/* Camera */}
        <Pressable
          style={styles.attachMenuRow}
          onPress={() => { setAttachMenuOpen(false); void pickFromCamera(); }}
        >
          <View style={[styles.attachMenuIcon, { backgroundColor: colors.primary + "18" }]}>
            <Feather name="camera" size={18} color={colors.primary} />
          </View>
          <View style={styles.attachMenuText}>
            <Text style={[styles.attachMenuLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {t("coach.camera", "Camera")}
            </Text>
            <Text style={[styles.attachMenuSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t("coach.cameraSub", "Take a photo right now")}
            </Text>
          </View>
        </Pressable>

        <View style={[styles.attachMenuDivider, { backgroundColor: colors.border }]} />

        {/* Photos */}
        <Pressable
          style={styles.attachMenuRow}
          onPress={() => { setAttachMenuOpen(false); void pickFromLibrary(); }}
        >
          <View style={[styles.attachMenuIcon, { backgroundColor: colors.primary + "18" }]}>
            <Feather name="image" size={18} color={colors.primary} />
          </View>
          <View style={styles.attachMenuText}>
            <Text style={[styles.attachMenuLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {t("coach.photos", "Photos")}
            </Text>
            <Text style={[styles.attachMenuSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t("coach.photosSub", "Pick from your library")}
            </Text>
          </View>
        </Pressable>

        <View style={[styles.attachMenuDivider, { backgroundColor: colors.border }]} />

        {/* Files */}
        <Pressable
          style={styles.attachMenuRow}
          onPress={() => { setAttachMenuOpen(false); void pickDocument(); }}
        >
          <View style={[styles.attachMenuIcon, { backgroundColor: colors.primary + "18" }]}>
            <Feather name="paperclip" size={18} color={colors.primary} />
          </View>
          <View style={styles.attachMenuText}>
            <Text style={[styles.attachMenuLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {t("coach.files", "Files")}
            </Text>
            <Text style={[styles.attachMenuSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t("coach.filesSub", "PDF, Word, text, CSV…")}
            </Text>
          </View>
        </Pressable>
      </View>
    </Modal>

    </View>
  );
}

// ---------------------------------------------------------------------------
// ChatGPT-style sidebar listing every coaching session for the active goal.
// Rendered as an absolute overlay (no Modal) so Reanimated owns 100% of the
// enter/exit animation — no iOS native bottom-sheet transition can interfere.
// Panel slides in from the left; backdrop fades in simultaneously.
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
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const PANEL_W = 290;
  const translateX = useSharedValue(-PANEL_W);
  const backdropOpacity = useSharedValue(0);

  React.useEffect(() => {
    const cfg = {
      duration: 260,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
    };
    translateX.value = withTiming(visible ? 0 : -PANEL_W, cfg);
    backdropOpacity.value = withTiming(visible ? 1 : 0, { duration: 220 });
  }, [visible, translateX, backdropOpacity, PANEL_W]);

  const panelAnim = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));
  const backdropAnim = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  // Newest first.
  const ordered = [...sessions].sort((a, b) => {
    const aT = Date.parse(a.lastMessageAt || a.createdAt) || 0;
    const bT = Date.parse(b.lastMessageAt || b.createdAt) || 0;
    return bT - aT;
  });

  return (
    // Always mounted; pointerEvents controls whether touches reach children.
    <View
      style={[StyleSheet.absoluteFill, { zIndex: 100 }]}
      pointerEvents={visible ? "box-none" : "none"}
    >
      {/* Dim backdrop — tapping it closes the drawer */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.45)" }, backdropAnim]}
        pointerEvents={visible ? "auto" : "none"}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel={t("coach.closeChatHistory", "Close chat history")}
        />
      </Animated.View>

      {/* Sliding panel */}
      <Animated.View
        style={[
          sidebarStyles.panel,
          panelAnim,
          {
            width: PANEL_W,
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
                { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
              ]}
              numberOfLines={1}
            >
              {goalTitle ? goalTitle.toUpperCase() : t("coach.chatsEyebrow", "CHATS")}
            </Text>
            <Text
              style={[
                sidebarStyles.title,
                { color: colors.foreground, fontFamily: "Inter_700Bold" },
              ]}
            >
              {t("coach.chatsTitle", "Chats")}
            </Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={10}
            accessibilityLabel={t("coach.closeChatHistory", "Close chat history")}
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
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
          testID="new-chat-button"
        >
          <Feather name="plus" size={16} color={colors.primaryForeground} />
          <Text
            style={[
              sidebarStyles.newBtnText,
              { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {t("coach.newChat", "New chat")}
          </Text>
        </Pressable>

        {ordered.length === 0 ? (
          <View style={sidebarStyles.empty}>
            <Text
              style={[
                sidebarStyles.emptyText,
                { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
              ]}
            >
              {t("coach.noChats", 'No chats yet. Tap "New chat" to start.')}
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
                        { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
                      ]}
                    >
                      {item.title || t("coach.newChat", "New chat")}
                    </Text>
                    {preview ? (
                      <Text
                        numberOfLines={1}
                        style={[
                          sidebarStyles.rowPreview,
                          { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
                        ]}
                      >
                        {preview}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    onPress={() => onDeleteSession(item.id, item.title)}
                    hitSlop={8}
                    accessibilityLabel={t("coach.deleteChat", "Delete chat")}
                    style={({ pressed }) => ({
                      padding: 6,
                      opacity: pressed ? 0.6 : 0.8,
                    })}
                  >
                    <Feather name="trash-2" size={14} color={colors.mutedForeground} />
                  </Pressable>
                </Pressable>
              );
            }}
          />
        )}
      </Animated.View>
    </View>
  );
}

const sidebarStyles = StyleSheet.create({
  panel: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
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
  title: { fontSize: 18, marginTop: 2 },
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
  const { t } = useTranslation();
  const colors = useColors();
  const [open, setOpen] = useState(false);
  const facts = memory?.facts ?? [];
  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={t("coach.workingOnContext", "Working on and remembered context")}
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
              {t("coach.workingOn", "WORKING ON")}
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
                  {t("coach.whatRubaiRemembers", "WHAT RUBAI REMEMBERS")}
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
                    {t("coach.forgetEverything", "Forget everything")}
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
    paddingHorizontal: 16,
    paddingBottom: 8,
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
  agentWorkingText: {
    fontSize: 12,
    fontStyle: "italic",
  },
  headerChipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  logoPillWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dropdownCard: {
    position: "absolute",
    top: "100%",
    left: 52,
    width: 240,
    marginTop: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 14,
    elevation: 10,
    zIndex: 200,
  },
  dropdownSep: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 56,
  },
  dropdownGroupDivider: {
    height: 6,
  },
  dropdownRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 13,
    gap: 12,
  },
  dropdownRowLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
    letterSpacing: -0.1,
  },
  dropdownRowDesc: {
    fontFamily: "Inter_400Regular",
    fontSize: 12.5,
    marginTop: 1,
  },
  transcribingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 4,
  },
  transcribingText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 10.5,
    letterSpacing: 1.2,
  },
  footerStack: {
    paddingHorizontal: 6,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 10,
  },
  undoBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  undoIcon: {
    marginTop: 1,
  },
  undoText: {
    flex: 1,
    fontFamily: "Inter_500Medium",
    fontSize: 13,
    lineHeight: 18,
  },
  undoButton: {
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 14,
  },
  undoButtonText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
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
    fontSize: 12.5,
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
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    gap: 8,
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
  attachmentThumbWrap: {
    alignSelf: "flex-end",
    marginHorizontal: 8,
    marginBottom: 4,
  },
  attachmentThumb: {
    width: 90,
    height: 68,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  attachmentThumbX: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
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
    paddingVertical: 3,
    gap: 6,
    minHeight: 38,
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
    fontSize: 13,
    paddingTop: 10,
    paddingBottom: 0,
    maxHeight: 110,
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
  attachMenuSheet: {
    position: "absolute",
    borderWidth: 1,
    borderRadius: 16,
    overflow: "hidden",
  },
  attachMenuHeader: {
    fontSize: 11,
    letterSpacing: 0.2,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 6,
  },
  attachMenuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  attachMenuIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  attachMenuText: { flex: 1 },
  attachMenuLabel: {
    fontSize: 13,
    marginBottom: 1,
  },
  attachMenuSub: {
    fontSize: 11,
  },
  attachMenuDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 56,
  },
});

// ---------------------------------------------------------------------------
// ModelModeRow — single selectable row inside the dropdown card
// ---------------------------------------------------------------------------
function ModelModeRow({
  label,
  desc,
  selected,
  onPress,
  colors,
}: {
  label: string;
  desc: string;
  selected: boolean;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.dropdownRow,
        { opacity: pressed ? 0.75 : 1 },
      ]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.dropdownRowLabel, { color: colors.foreground }]}>
          {label}
        </Text>
        <Text style={[styles.dropdownRowDesc, { color: colors.mutedForeground }]}>
          {desc}
        </Text>
      </View>
      {selected && (
        <Feather name="check" size={16} color={colors.primary} />
      )}
    </Pressable>
  );
}
