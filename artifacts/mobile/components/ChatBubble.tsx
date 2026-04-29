import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";

type Props = {
  role: "user" | "assistant";
  content: string;
};

export function ChatBubble({ role, content }: Props) {
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
        <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
          <Text
            style={[
              styles.avatarText,
              { color: colors.primaryForeground, fontFamily: "Inter_700Bold" },
            ]}
          >
            A
          </Text>
        </View>
      )}
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isUser ? colors.foreground : colors.card,
            borderColor: isUser ? colors.foreground : colors.border,
            borderTopLeftRadius: isUser ? 18 : 6,
            borderTopRightRadius: isUser ? 6 : 18,
          },
        ]}
      >
        <Text
          style={[
            styles.text,
            {
              color: isUser ? colors.background : colors.foreground,
              fontFamily: "Inter_400Regular",
            },
          ]}
        >
          {content}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginVertical: 6,
    gap: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 13,
  },
  bubble: {
    maxWidth: "80%",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  text: {
    fontSize: 15,
    lineHeight: 22,
  },
});
