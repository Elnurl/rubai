import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";

type Props = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
};

export function SectionHeader({ eyebrow, title, subtitle }: Props) {
  const colors = useColors();
  return (
    <View style={styles.container}>
      {eyebrow && (
        <Text
          style={[
            styles.eyebrow,
            { color: colors.primary, fontFamily: "Inter_600SemiBold" },
          ]}
        >
          {eyebrow}
        </Text>
      )}
      <Text
        style={[
          styles.title,
          { color: colors.foreground, fontFamily: "Inter_700Bold" },
        ]}
      >
        {title}
      </Text>
      {subtitle && (
        <Text
          style={[
            styles.subtitle,
            { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
          ]}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 3,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 20,
    letterSpacing: -0.3,
    lineHeight: 25,
  },
  subtitle: {
    fontSize: 12.5,
    lineHeight: 18,
  },
});
