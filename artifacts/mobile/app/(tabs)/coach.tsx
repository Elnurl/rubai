import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActiveGoalChip } from "@/components/ActiveGoalChip";
import { ChatBubble } from "@/components/ChatBubble";
import { EmptyState } from "@/components/EmptyState";
import { SectionHeader } from "@/components/SectionHeader";
import { useColors } from "@/hooks/useColors";
import { useEvolveRoadmap } from "@/hooks/useEvolveRoadmap";
import { useAtlas } from "@/providers/AtlasProvider";
import {
  useAtlasCoach,
  type ChatMessage,
  type CoachActionSuggestion,
} from "@workspace/api-client-react";

const COLD_START_SUGGESTIONS = [
  "I'm feeling stuck today",
  "Make today's plan easier",
  "Push me harder this week",
  "What should I focus on?",
];

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
  } = useAtlas();

  const coach = useAtlasCoach();
  const { evolve, isEvolving } = useEvolveRoadmap();
  const [draft, setDraft] = useState("");
  const [lastSuggestedReplies, setLastSuggestedReplies] = useState<string[]>([]);
  const [lastAction, setLastAction] = useState<CoachActionSuggestion | null>(null);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (activeCoachHistory.length === 0 && activeProfile && activeRoadmap) {
      const opener: ChatMessage = {
        role: "assistant",
        content: `I'm here. We're working on ${activeRoadmap.headline.toLowerCase()}. Tell me what's on your mind, what got in the way, or what you want to push on.`,
      };
      void setActiveCoachHistory([opener]);
    }
  }, [activeCoachHistory.length, activeProfile, activeRoadmap, setActiveCoachHistory]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || !activeProfile || !activeRoadmap || coach.isPending) return;
    setDraft("");
    // Clear ephemeral per-turn UI as soon as the next turn starts.
    setLastSuggestedReplies([]);
    setLastAction(null);

    const userMsg: ChatMessage = { role: "user", content: message };
    await appendActiveCoachMessage(userMsg);

    try {
      const res = await coach.mutateAsync({
        data: {
          profile: activeProfile,
          roadmap: activeRoadmap,
          todayPlan: activeDailyPlan?.plan,
          behavioral: activeBehavioral,
          history: activeCoachHistory.slice(-10),
          message,
          currentWeek: activeCurrentWeek,
          recentReflections: activeReflections.slice(-5),
          recentEvolutions: activeRoadmapEvolutions.slice(0, 2),
          ...(activeBehavioralProfile
            ? { learnedProfile: activeBehavioralProfile }
            : {}),
          ...(activeCurrentPhase ? { currentPhase: activeCurrentPhase } : {}),
          ...(activeCoachMemory ? { coachMemory: activeCoachMemory } : {}),
        },
      });
      const assistantMsg: ChatMessage = { role: "assistant", content: res.reply };
      await appendActiveCoachMessage(assistantMsg);
      setLastSuggestedReplies(res.suggestedReplies ?? []);
      const action = res.actionSuggestion;
      setLastAction(action && action.kind !== "none" ? action : null);
      if (res.memoryUpdate) {
        await applyCoachMemoryUpdate({
          summary: res.memoryUpdate.summary,
          newFacts: res.memoryUpdate.newFacts ?? [],
        });
      }
    } catch {
      const errMsg: ChatMessage = {
        role: "assistant",
        content:
          "Lost the line for a moment. Send that again and we'll pick it back up.",
      };
      await appendActiveCoachMessage(errMsg);
    }
  };

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

  const onForgetMemory = async () => {
    await setActiveCoachMemory(null);
    setMemoryOpen(false);
  };

  // Footer below the chat list: typing indicator, then per-turn suggestions
  // and action card so they always appear right under the latest assistant
  // message regardless of how the FlatList grows.
  const footer = useMemo(() => {
    if (coach.isPending) {
      return (
        <View style={styles.typing}>
          <ActivityIndicator size="small" color={colors.mutedForeground} />
          <Text
            style={[
              styles.typingText,
              { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
            ]}
          >
            RubAI is thinking
          </Text>
        </View>
      );
    }
    return (
      <View style={styles.footerStack}>
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
  }, [coach.isPending, lastAction, lastSuggestedReplies, isEvolving, colors]);

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

  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={0}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View style={[styles.header, { paddingTop: topPad }]}>
        <View style={styles.headerInner}>
          <View style={{ flex: 1 }}>
            <SectionHeader
              eyebrow="COACH"
              title="RubAI"
              subtitle={`Working on: ${activeRoadmap.headline}`}
            />
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
        renderItem={({ item }) => <ChatBubble role={item.role} content={item.content} />}
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
                    borderColor: colors.border,
                    backgroundColor: colors.card,
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
        <View
          style={[
            styles.inputWrap,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: 22,
            },
          ]}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Talk to your coach"
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[
              styles.input,
              { color: colors.foreground, fontFamily: "Inter_400Regular" },
            ]}
            editable={!coach.isPending}
          />
          <Pressable
            onPress={() => send(draft)}
            disabled={!draft.trim() || coach.isPending}
            style={[
              styles.sendButton,
              { backgroundColor: draft.trim() ? colors.primary : colors.muted },
            ]}
            hitSlop={6}
          >
            <Feather
              name="arrow-up"
              size={18}
              color={draft.trim() ? colors.primaryForeground : colors.mutedForeground}
            />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
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
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 6,
  },
  typingText: {
    fontSize: 13,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: 12.5,
    letterSpacing: 0.2,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    borderWidth: 1,
    paddingLeft: 16,
    paddingRight: 6,
    paddingVertical: 6,
    gap: 8,
    minHeight: 48,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 8,
    maxHeight: 140,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
});
