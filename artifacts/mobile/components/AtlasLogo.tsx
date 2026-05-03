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
  // +5% size vs the previous 0.198 multiplier so the dot reads a touch
  // bolder above the i-stem at every breakpoint.
  const dotSize = Math.round(titleSize * 0.208);

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
    <View
      style={styles.row}
      accessible
      accessibilityRole="header"
      accessibilityLabel="rubai"
    >
      <Text style={[styles.text, textStyle]}>ruba</Text>
      <View>
        <Text style={[styles.text, textStyle]}>{"\u0131"}</Text>
        {/*
          Center the dot over the i-stem. We put it inside an absolutely-
          positioned full-width overlay with alignItems:center so it follows
          the rendered glyph box (not the font's advance width — which has
          uneven side bearings on dotless-i and was pushing the dot right of
          the stem).
        */}
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: Math.round(titleSize * 0.07),
            left: 0,
            right: 0,
            alignItems: "center",
          }}
        >
          <View
            style={{
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: dotColor,
              marginLeft: titleSize * 0.015,
            }}
          />
        </View>
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
