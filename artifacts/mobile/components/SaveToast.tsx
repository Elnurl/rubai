import { Feather } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

type Props = {
  visible: boolean;
  message?: string;
  onDismiss: () => void;
};

const HOLD_MS = 1800;
const IN_MS = 200;
const OUT_MS = 180;

export function SaveToast({ visible, message = "Saved", onDismiss }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    if (!visible) {
      opacity.value = 0;
      translateY.value = 12;
      return;
    }
    opacity.value = withSequence(
      withTiming(1, { duration: IN_MS, easing: Easing.out(Easing.quad) }),
      withDelay(
        HOLD_MS,
        withTiming(0, { duration: OUT_MS }, (finished) => {
          if (finished) runOnJS(onDismiss)();
        }),
      ),
    );
    translateY.value = withSequence(
      withTiming(0, { duration: IN_MS, easing: Easing.out(Easing.quad) }),
      withDelay(HOLD_MS, withTiming(12, { duration: OUT_MS })),
    );
  }, [visible, opacity, translateY, onDismiss]);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  const bottomOffset = Platform.OS === "web"
    ? 102
    : insets.bottom + 90;

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wrap, { bottom: bottomOffset }, animStyle]}
    >
      <View
        style={[
          styles.pill,
          {
            backgroundColor: colors.foreground,
            borderRadius: 999,
            shadowColor: "#000",
          },
        ]}
      >
        <View
          style={[
            styles.iconWrap,
            { backgroundColor: colors.primary },
          ]}
        >
          <Feather name="check" size={11} color={colors.primaryForeground} />
        </View>
        <Text
          style={[
            styles.label,
            { color: colors.background, fontFamily: "Inter_600SemiBold" },
          ]}
        >
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
    pointerEvents: "none",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: 16,
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  iconWrap: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontSize: 14,
    letterSpacing: 0.1,
  },
});
