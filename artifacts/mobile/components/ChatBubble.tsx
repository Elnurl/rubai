import { Feather } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { BrandDot } from "@/components/BrandDot";
import { useColors } from "@/hooks/useColors";

type Props = {
  role: "user" | "assistant";
  content: string;
  /** When provided on assistant bubbles, renders a small speaker icon to replay the reply via TTS. */
  onSpeak?: () => void;
  isSpeaking?: boolean;
};

export function ChatBubble({ role, content, onSpeak, isSpeaking }: Props) {
  const colors = useColors();
  const isUser = role === "user";

  return (
    <Animated.View
      entering={FadeIn.duration(220)}
      style={[
        styles.row,
        { justifyContent: isUser ? "flex-end" : "flex-start" },
      ]}
    >
      {!isUser && (
        <View style={styles.avatarSlot}>
          <BrandDot size="md" mode="static" />
        </View>
      )}
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isUser ? colors.primary : colors.card,
            borderColor: isUser ? colors.primary : colors.border,
          },
        ]}
      >
        <Text
          style={[
            styles.text,
            {
              color: isUser ? colors.primaryForeground : colors.foreground,
              fontFamily: "Inter_400Regular",
            },
          ]}
        >
          {content}
        </Text>
        {!isUser && onSpeak ? (
          <Pressable
            onPress={onSpeak}
            hitSlop={8}
            style={styles.speakerButton}
            testID="chat-bubble-speak"
            accessibilityLabel={isSpeaking ? "Stop speaking" : "Read aloud"}
          >
            <Feather
              name={isSpeaking ? "volume-2" : "volume-1"}
              size={14}
              color={isSpeaking ? colors.primary : colors.mutedForeground}
            />
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginVertical: 8,
    gap: 10,
  },
  avatarSlot: {
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  bubble: {
    maxWidth: "78%",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 18,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
  speakerButton: {
    alignSelf: "flex-end",
    marginTop: 6,
    paddingLeft: 6,
    paddingVertical: 2,
  },
});
