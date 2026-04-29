import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { GOAL_META } from "@/constants/atlas";
import { useColors } from "@/hooks/useColors";
import type { GoalType } from "@workspace/api-client-react";

type Props = {
  goal: GoalType;
  selected?: boolean;
  onPress: () => void;
};

export function GoalCard({ goal, selected, onPress }: Props) {
  const colors = useColors();
  const meta = GOAL_META[goal];

  const handlePress = () => {
    if (Platform.OS !== "web") {
      Haptics.selectionAsync().catch(() => {});
    }
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: selected ? colors.primary : colors.border,
          borderRadius: colors.radius,
          borderWidth: selected ? 2 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: selected ? colors.primary : meta.accent + "1A",
            borderRadius: 14,
          },
        ]}
      >
        <Ionicons
          name={meta.icon as React.ComponentProps<typeof Ionicons>["name"]}
          size={26}
          color={selected ? colors.primaryForeground : meta.accent}
        />
      </View>
      <View style={styles.text}>
        <Text
          style={[
            styles.title,
            { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
          ]}
        >
          {meta.label}
        </Text>
        <Text
          style={[
            styles.tagline,
            { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
          ]}
        >
          {meta.tagline}
        </Text>
      </View>
      <Ionicons
        name={selected ? "checkmark-circle" : "chevron-forward"}
        size={22}
        color={selected ? colors.primary : colors.mutedForeground}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    gap: 16,
  },
  iconWrap: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
  },
  tagline: {
    fontSize: 13,
    lineHeight: 18,
  },
});
