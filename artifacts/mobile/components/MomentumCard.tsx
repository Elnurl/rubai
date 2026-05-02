import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import type { MomentumState } from "@/lib/momentum";

type Props = {
  state: MomentumState;
};

export function MomentumCard({ state }: Props) {
  const colors = useColors();
  const accent =
    state.level === "losing"
      ? colors.destructive
      : state.level === "high"
        ? colors.accent
        : colors.primary;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.muted }]}>
        <Feather name={state.icon} size={14} color={accent} />
      </View>
      <Text
        style={[
          styles.text,
          { color: colors.foreground, fontFamily: "Inter_500Medium" },
        ]}
        numberOfLines={2}
      >
        {state.message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginTop: 12,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
});
