import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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

import { AtlasLogo } from "@/components/AtlasLogo";
import { ChatBubble } from "@/components/ChatBubble";
import { GOAL_META } from "@/constants/atlas";
import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";
import {
  useAtlasOnboardingChat,
  type ChatMessage,
} from "@workspace/api-client-react";

export default function OnboardingScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const {
    pendingGoalType,
    onboardingHistory,
    setOnboardingHistory,
    setProfile,
  } = useAtlas();

  const chat = useAtlasOnboardingChat();
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    if (!pendingGoalType) {
      router.replace("/welcome");
    }
  }, [pendingGoalType, router]);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !pendingGoalType || chat.isPending) return;
    setDraft("");

    const userMsg: ChatMessage = { role: "user", content: text };
    const newHistory = [...onboardingHistory, userMsg];
    await setOnboardingHistory(newHistory);

    try {
      const res = await chat.mutateAsync({
        data: {
          goalType: pendingGoalType,
          history: newHistory,
        },
      });
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: res.message,
      };
      const updated = [...newHistory, assistantMsg];
      await setOnboardingHistory(updated);

      if (res.isComplete && res.profile) {
        await setProfile(res.profile);
        setRedirecting(true);
        setTimeout(() => {
          router.replace("/generating");
        }, 1000);
      }
    } catch {
      const errMsg: ChatMessage = {
        role: "assistant",
        content:
          "I lost the connection just now. Tap send again and we'll pick up where you left off.",
      };
      await setOnboardingHistory([...newHistory, errMsg]);
    }
  };

  const meta = pendingGoalType ? GOAL_META[pendingGoalType] : null;
  const topPad = isWeb ? 67 : insets.top + 8;
  const bottomPad = isWeb ? 34 : insets.bottom;

  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={0}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View
        style={[
          styles.header,
          { paddingTop: topPad, borderBottomColor: colors.border },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Feather name="chevron-left" size={26} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerCenter}>
          <AtlasLogo size="sm" />
          {meta && (
            <Text
              style={[
                styles.headerSubtitle,
                { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
              ]}
            >
              {meta.label}
            </Text>
          )}
        </View>
        <View style={{ width: 26 }} />
      </View>

      <FlatList
        ref={listRef}
        data={onboardingHistory}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={{ paddingHorizontal: 18, paddingTop: 16, paddingBottom: 16 }}
        renderItem={({ item }) => (
          <ChatBubble role={item.role} content={item.content} />
        )}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        ListFooterComponent={
          chat.isPending ? (
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
          ) : redirecting ? (
            <View style={styles.typing}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text
                style={[
                  styles.typingText,
                  { color: colors.primary, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                Building your roadmap
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
            paddingBottom: bottomPad + 10,
          },
        ]}
      >
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
            placeholder="Type your answer"
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[
              styles.input,
              { color: colors.foreground, fontFamily: "Inter_400Regular" },
            ]}
            editable={!chat.isPending && !redirecting}
          />
          <Pressable
            onPress={handleSend}
            disabled={!draft.trim() || chat.isPending || redirecting}
            style={[
              styles.sendButton,
              {
                backgroundColor: draft.trim() ? colors.primary : colors.muted,
              },
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
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    gap: 2,
  },
  headerSubtitle: {
    fontSize: 11.5,
    letterSpacing: 0.6,
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
