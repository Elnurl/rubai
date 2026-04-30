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
  // - Light theme: green word, foreground-color dot
  // - Dark theme:  foreground-color (cream) word, green dot
  const wordColor = isDark ? colors.foreground : colors.primary;
  const dotColor = isDark ? colors.primary : colors.foreground;

  const titleSize = size === "lg" ? 32 : size === "md" ? 24 : 18;
  const dotSize = Math.round(titleSize * 0.22);
  const dotOffsetTop = Math.round(titleSize * 0.04);

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
        {"ruba"}
      </Text>
      <View style={styles.iWrap}>
        <View
          style={[
            styles.dot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: dotColor,
              top: dotOffsetTop,
            },
          ]}
        />
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
          {"\u0131"}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
  },
  text: {
    includeFontPadding: false,
  },
  iWrap: {
    position: "relative",
    alignItems: "center",
  },
  dot: {
    position: "absolute",
  },
});
