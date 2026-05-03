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

  // Wordmark is "ruba" + dotless-i (U+0131) so the green BrandDot can sit
  // alone above the i-stem. Inter is bundled as a custom font (not a system
  // fallback) so U+0131 always renders — no tofu risk on Android OEMs.
  const textStyle = {
    fontSize: titleSize,
    color: wordColor,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  } as const;

  return (
    <View style={styles.row}>
      <Text style={[styles.text, textStyle]}>ruba</Text>
      <View>
        <Text style={[styles.text, textStyle]}>{"\u0131"}</Text>
        <View
          pointerEvents="none"
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: dotColor,
              top: Math.round(titleSize * 0.18),
              left: "50%",
              marginLeft: -Math.round(dotSize / 2),
            },
          ]}
        />
      </View>
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
