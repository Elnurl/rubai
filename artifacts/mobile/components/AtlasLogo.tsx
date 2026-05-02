import React from "react";
import { StyleSheet, Text, useColorScheme, View } from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  size?: "sm" | "md" | "lg";
};

export function AtlasLogo({ size = "md" }: Props) {
  const colors = useColors();
  const scheme = useColorScheme();
  const isDark = scheme === "dark";

  // Theme-inverted color treatment:
  // - Light theme: green word, foreground-color decorative dot
  // - Dark theme:  foreground-color (cream) word, green decorative dot
  const wordColor = isDark ? colors.foreground : colors.primary;
  const dotColor = isDark ? colors.primary : colors.foreground;

  const titleSize = size === "lg" ? 32 : size === "md" ? 24 : 18;
  const dotSize = Math.round(titleSize * 0.18);

  // Render the wordmark as plain "rubai" (regular i, universally supported on
  // every Android font fallback) and overlay a decorative dot at the top-right
  // edge. Previously we used the dotless-i character (U+0131) so the green dot
  // could float standalone, but that glyph rendered as tofu on some Android
  // OEM font configurations (Samsung One UI in particular).
  return (
    <View style={styles.row}>
      <Text
        style={[
          styles.text,
          {
            fontSize: titleSize,
            color: wordColor,
            fontFamily: "Inter_700Bold",
            letterSpacing: -0.5,
          },
        ]}
      >
        rubai
      </Text>
      <View
        style={[
          styles.dot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: dotColor,
            top: -Math.round(titleSize * 0.05),
            right: -Math.round(titleSize * 0.05),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    position: "relative",
  },
  text: {
    includeFontPadding: false,
  },
  dot: {
    position: "absolute",
  },
});
