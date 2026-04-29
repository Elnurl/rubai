import { Feather } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
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

import { ChatBubble } from "@/components/ChatBubble";
import { EmptyState } from "@/components/EmptyState";
import { SectionHeader } from "@/components/SectionHeader";
import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";
import {
  useAtlasCoach,
  type ChatMessage,
} from "@workspace/api-client-react";

const SUGGESTIONS = [
  "I'm feeling stuck today",
  "Make today's plan easier",
  "Push me harder this week",
  "What should I focus on?",
];

export default function CoachScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 8;
  const bottomPad = isWeb ? 100 : insets.bottom + 90;

  const {
    profile,
    roadmap,
    dailyPlan,
    behavioral,
    coachHistory,
    setCoachHistory,
  } = useAtlas();

  const coach = useAtlasCoach();
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (coachHistory.length === 0 && profile && roadmap) {
      const opener: ChatMessage = {
        role: "assistant",
        content: `I'm here. We're working on ${roadmap.headline.toLowerCase()}. Tell me what's on your mind, what got in the way, or what you want to push on.`,
      };
      void setCoachHistory([opener]);
    }
  }, [coachHistory.length, profile, roadmap, setCoachHistory]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || !profile || !roadmap || coach.isPending) return;
    setDraft("");

    const userMsg: ChatMessage = { role: "user", content: message };
    const newHistory = [...coachHistory, userMsg];
    await setCoachHistory(newHistory);

    try {
      const res = await coach.mutateAsync({
        data: {
          profile,
          roadmap,
          todayPlan: dailyPlan?.plan,
          behavioral,
          history: coachHistory.slice(-10),
          message,
        },
      });
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: res.reply,
      };
      await setCoachHistory([...newHistory, assistantMsg]);
    } catch {
      const errMsg: ChatMessage = {
        role: "assistant",
        content:
          "Lost the line for a moment. Send that again and we'll pick it back up.",
      };
      await setCoachHistory([...newHistory, errMsg]);
    }
  };

  if (!profile || !roadmap) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <EmptyState
          icon="message-circle"
          title="Coach unlocks after onboarding"
          description="Finish setting up your goal first."
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={0}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View style={[styles.header, { paddingTop: topPad }]}>
        <SectionHeader eyebrow="COACH" title="Atlas" subtitle={`Working on: ${roadmap.headline}`} />
      </View>

      <FlatList
        ref={listRef}
        data={coachHistory}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 8 }}
        renderItem={({ item }) => <ChatBubble role={item.role} content={item.content} />}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        ListFooterComponent={
          coach.isPending ? (
            <View style={styles.typing}>
              <ActivityIndicator size="small" color={colors.mutedForeground} />
              <Text
                style={[
                  styles.typingText,
                  { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
                ]}
              >
                Atlas is thinking
              </Text>
            </View>
          ) : null
        }
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
        {coachHistory.length <= 1 && (
          <View style={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
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
