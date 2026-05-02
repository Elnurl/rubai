import { Feather } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { getAwardDef } from "@/lib/awards";
import { useAtlas } from "@/providers/AtlasProvider";

const AUTO_DISMISS_MS = 3200;

export function AwardToast() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { pendingAwardToast, dismissAwardToast } = useAtlas();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-20);

  useEffect(() => {
    if (!pendingAwardToast) return;
    opacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) });
    translateY.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) });

    // Auto-dismiss with a fade-out, then call dismiss to drain the queue.
    opacity.value = withDelay(
      AUTO_DISMISS_MS,
      withTiming(0, { duration: 200 }, (finished) => {
        if (finished) {
          runOnJS(dismissAwardToast)();
        }
      }),
    );
    translateY.value = withDelay(
      AUTO_DISMISS_MS,
      withTiming(-20, { duration: 200 }),
    );
  }, [pendingAwardToast, opacity, translateY, dismissAwardToast]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!pendingAwardToast) return null;
  const def = getAwardDef(pendingAwardToast.id);
  if (!def) return null;

  const top = (Platform.OS === "web" ? 12 : insets.top + 8);

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { top }, animatedStyle]}
    >
      <Pressable
        onPress={dismissAwardToast}
        style={[
          styles.card,
          {
            backgroundColor: colors.foreground,
            borderRadius: colors.radius,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Award unlocked: ${def.title}`}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.accent }]}>
          <Feather name={def.icon} size={16} color={colors.primaryForeground} />
        </View>
        <View style={styles.text}>
          <Text
            style={[
              styles.eyebrow,
              { color: colors.accent, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            AWARD UNLOCKED
          </Text>
          <Text
            style={[
              styles.title,
              { color: colors.background, fontFamily: "Inter_700Bold" },
            ]}
            numberOfLines={1}
          >
            {def.title}
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: colors.background, fontFamily: "Inter_400Regular" },
            ]}
            numberOfLines={2}
          >
            {def.subtitle}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 12,
    right: 12,
    alignItems: "center",
    zIndex: 9999,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    width: "100%",
    maxWidth: 480,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 0.6,
    marginBottom: 2,
    opacity: 0.85,
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 16,
    opacity: 0.85,
    marginTop: 1,
  },
});
