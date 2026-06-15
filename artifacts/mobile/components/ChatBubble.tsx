import { Feather } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { BrandDot } from "@/components/BrandDot";
import { useColors } from "@/hooks/useColors";
import { decodeAttachment } from "@/lib/attachmentEncoding";

type Props = {
  role: "user" | "assistant";
  content: string;
  /** When provided on assistant bubbles, renders a small speaker icon to replay the reply via TTS. */
  onSpeak?: () => void;
  isSpeaking?: boolean;
};

export function ChatBubble({ role, content, onSpeak, isSpeaking }: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const isUser = role === "user";

  // Parse optional attachment header embedded in user messages.
  const decoded = isUser ? decodeAttachment(content) : null;
  const displayText = decoded ? decoded.message : content;
  const attachMeta = decoded?.meta ?? null;

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
          <BrandDot size="sm" mode="static" />
        </View>
      )}
      <View
        style={[
          isUser ? styles.userBubble : styles.assistantBubble,
          isUser
            ? {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
              }
            : null,
        ]}
      >
        {/* Image thumbnail — shown when user attached a photo/camera shot */}
        {attachMeta?.kind === "IMG" ? (
          <Image
            source={{ uri: attachMeta.uri }}
            style={styles.thumbnail}
            resizeMode="cover"
          />
        ) : null}

        {/* File pill — shown when user attached a document */}
        {attachMeta?.kind === "FILE" ? (
          <View
            style={[
              styles.filePill,
              { backgroundColor: "rgba(255,255,255,0.18)" },
            ]}
          >
            <Feather
              name="file-text"
              size={13}
              color={colors.primaryForeground}
            />
            <Text
              numberOfLines={1}
              style={[
                styles.filePillText,
                {
                  color: colors.primaryForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              {attachMeta.filename}
            </Text>
          </View>
        ) : null}

        {/* Message body */}
        {displayText.length > 0 ? (
          <Text
            style={[
              styles.text,
              {
                color: isUser ? colors.primaryForeground : colors.foreground,
                fontFamily: "Inter_400Regular",
                marginTop: attachMeta ? 8 : 0,
              },
            ]}
          >
            {displayText}
          </Text>
        ) : null}

        {!isUser && onSpeak ? (
          <Pressable
            onPress={onSpeak}
            hitSlop={8}
            style={styles.speakerButton}
            testID="chat-bubble-speak"
            accessibilityLabel={isSpeaking ? t("chatBubble.stopSpeaking", "Stop speaking") : t("chatBubble.readAloud", "Read aloud")}
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
    marginVertical: 4,
    gap: 8,
  },
  avatarSlot: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  userBubble: {
    maxWidth: "78%",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
  },
  assistantBubble: {
    flex: 1,
    paddingVertical: 2,
    paddingRight: 6,
  },
  text: {
    fontSize: 13,
    lineHeight: 19,
  },
  thumbnail: {
    width: 200,
    height: 150,
    borderRadius: 10,
  },
  filePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  filePillText: {
    fontSize: 12.5,
    maxWidth: 160,
  },
  speakerButton: {
    alignSelf: "flex-end",
    marginTop: 6,
    paddingLeft: 6,
    paddingVertical: 2,
  },
});
