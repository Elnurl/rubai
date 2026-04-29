import * as Haptics from "expo-haptics";
import React from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useColors } from "@/hooks/useColors";

type Variant = "primary" | "secondary" | "ghost" | "destructive";

type Props = {
  onPress: () => void;
  label: string;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function AtlasButton({
  onPress,
  label,
  variant = "primary",
  loading,
  disabled,
  icon,
  style,
  testID,
}: Props) {
  const colors = useColors();

  const palette = (() => {
    switch (variant) {
      case "primary":
        return { bg: colors.primary, fg: colors.primaryForeground, border: colors.primary };
      case "secondary":
        return { bg: colors.secondary, fg: colors.secondaryForeground, border: colors.border };
      case "ghost":
        return { bg: "transparent", fg: colors.foreground, border: "transparent" };
      case "destructive":
        return { bg: colors.destructive, fg: colors.destructiveForeground, border: colors.destructive };
    }
  })();

  const handlePress = () => {
    if (disabled || loading) return;
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onPress();
  };

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          borderRadius: colors.radius,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text
            style={[
              styles.label,
              { color: palette.fg, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 54,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  label: {
    fontSize: 16,
    letterSpacing: 0.2,
  },
});
