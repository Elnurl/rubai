import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  size?: "sm" | "md" | "lg";
};

export function AtlasLogo({ size = "md" }: Props) {
  const colors = useColors();
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
            color: colors.foreground,
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
              backgroundColor: colors.primary,
              top: dotOffsetTop,
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
