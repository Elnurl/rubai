import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  size?: "sm" | "md" | "lg";
};

export function AtlasLogo({ size = "md" }: Props) {
  const colors = useColors();
  const titleSize = size === "lg" ? 32 : size === "md" ? 24 : 18;
  const dotSize = size === "lg" ? 10 : 8;

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.dot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: colors.primary,
          },
        ]}
      />
      <Text
        style={[
          styles.text,
          {
            fontSize: titleSize,
            color: colors.foreground,
            fontFamily: "Inter_700Bold",
            letterSpacing: -0.5,
          },
        ]}
      >
        atlas
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {},
  text: {},
});
