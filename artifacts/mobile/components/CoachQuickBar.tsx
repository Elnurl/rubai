import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type Props = {
  /** Placeholder text shown inside the faux input pill. */
  placeholder: string;
  /** Optional starter prompts. Tapping one opens the coach and auto-sends it. */
  chips?: string[];
  /** Reports the rendered height so the screen can reserve scroll padding. */
  onHeight?: (height: number) => void;
};

/**
 * A pinned "quick interaction" bar for the AI coach. Lives at the bottom of the
 * Today / Roadmap / Goals tabs, just above the tab bar. It's an entry point —
 * not a full composer: tapping the input pill opens the coach focused, and
 * tapping a chip opens the coach with that prompt already sent.
 */
export function CoachQuickBar({ placeholder, chips, onHeight }: Props) {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  // Sit directly above the floating tab bar (height mirrors _layout.tsx).
  const tabBarSpace = isWeb ? 84 : 70 + insets.bottom;

  const go = (opts: { prefill?: string; autostart?: boolean; focus?: boolean }) => {
    router.push({
      pathname: "/(tabs)/coach",
      params: {
        ...(opts.prefill ? { prefill: opts.prefill } : {}),
        ...(opts.autostart ? { autostart: "1" } : {}),
        ...(opts.focus ? { focus: "1" } : {}),
      },
    });
  };

  const handleLayout = (e: LayoutChangeEvent) => {
    onHeight?.(e.nativeEvent.layout.height);
  };

  return (
    <View
      onLayout={handleLayout}
      style={[
        styles.wrap,
        {
          bottom: tabBarSpace,
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
      ]}
    >
      {chips && chips.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.chips}
        >
          {chips.map((chip) => (
            <Pressable
              key={chip}
              onPress={() => go({ prefill: chip, autostart: true })}
              style={({ pressed }) => [
                styles.chip,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.chipText,
                  { color: colors.foreground, fontFamily: "Inter_500Medium" },
                ]}
              >
                {chip}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <Pressable
        onPress={() => go({ focus: true })}
        accessibilityRole="button"
        accessibilityLabel="Open coach"
        style={({ pressed }) => [
          styles.inputPill,
          {
            backgroundColor: colors.card,
            borderColor: colors.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={[styles.sparkBadge, { backgroundColor: colors.primary + "22" }]}>
          <Ionicons name="sparkles" size={16} color={colors.primary} />
        </View>
        <Text
          numberOfLines={1}
          style={[
            styles.placeholder,
            { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
          ]}
        >
          {placeholder}
        </Text>
        <Pressable
          onPress={() => go({ focus: true })}
          hitSlop={8}
          style={styles.iconBtn}
        >
          <Feather name="mic" size={18} color={colors.mutedForeground} />
        </Pressable>
        <View style={[styles.sendBtn, { backgroundColor: colors.muted }]}>
          <Feather name="arrow-up" size={18} color={colors.mutedForeground} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  chips: {
    gap: 8,
    paddingRight: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipText: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
  inputPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 8,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sparkBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholder: {
    flex: 1,
    fontSize: 15,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
});
