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
import { useAtlas } from "@/providers/AtlasProvider";

const AUTO_DISMISS_MS = 4000;

type IconName = React.ComponentProps<typeof Feather>["name"];

type TierMessageDef = {
  eyebrow: string;
  title: string;
  subtitle: string;
  icon: IconName;
  isUpgrade: boolean;
};

function tierLabel(t: string): string {
  if (t === "premium") return "Premium";
  if (t === "pro") return "Pro";
  return "Free";
}

function tierRank(t: string): number {
  if (t === "premium") return 2;
  if (t === "pro") return 1;
  return 0;
}

function buildMessage(fromTier: string, toTier: string): TierMessageDef {
  const from = tierLabel(fromTier);
  const to = tierLabel(toTier);
  const isUpgrade = tierRank(toTier) > tierRank(fromTier);

  if (isUpgrade) {
    return {
      eyebrow: "PLAN UPDATED",
      title: `Welcome to ${to}!`,
      subtitle: "Your new features are ready.",
      icon: "star",
      isUpgrade: true,
    };
  } else if (toTier === "free") {
    return {
      eyebrow: "PLAN UPDATED",
      title: `Your ${from} plan has ended`,
      subtitle: "You've been moved to the Free plan.",
      icon: "info",
      isUpgrade: false,
    };
  } else {
    return {
      eyebrow: "PLAN UPDATED",
      title: `Plan updated to ${to}`,
      subtitle: `Changed from ${from} to ${to}.`,
      icon: "info",
      isUpgrade: false,
    };
  }
}

export function TierChangeToast() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { pendingTierChangeToast, dismissTierChangeToast } = useAtlas();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-20);

  useEffect(() => {
    if (!pendingTierChangeToast) return;
    opacity.value = withTiming(1, {
      duration: 220,
      easing: Easing.out(Easing.quad),
    });
    translateY.value = withTiming(0, {
      duration: 220,
      easing: Easing.out(Easing.quad),
    });

    opacity.value = withDelay(
      AUTO_DISMISS_MS,
      withTiming(0, { duration: 200 }, (finished) => {
        if (finished) {
          runOnJS(dismissTierChangeToast)();
        }
      }),
    );
    translateY.value = withDelay(
      AUTO_DISMISS_MS,
      withTiming(-20, { duration: 200 }),
    );
  }, [pendingTierChangeToast, opacity, translateY, dismissTierChangeToast]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!pendingTierChangeToast) return null;

  const msg = buildMessage(
    pendingTierChangeToast.fromTier,
    pendingTierChangeToast.toTier,
  );

  const top = Platform.OS === "web" ? 12 : insets.top + 8;

  const iconBg = msg.isUpgrade ? colors.accent : colors.mutedForeground;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.wrap, { top }, animatedStyle]}
    >
      <Pressable
        onPress={dismissTierChangeToast}
        style={[
          styles.card,
          {
            backgroundColor: colors.foreground,
            borderRadius: colors.radius,
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={msg.title}
      >
        <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
          <Feather
            name={msg.icon}
            size={16}
            color={colors.primaryForeground}
          />
        </View>
        <View style={styles.text}>
          <Text
            style={[
              styles.eyebrow,
              { color: colors.accent, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {msg.eyebrow}
          </Text>
          <Text
            style={[
              styles.title,
              { color: colors.background, fontFamily: "Inter_700Bold" },
            ]}
            numberOfLines={1}
          >
            {msg.title}
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: colors.background, fontFamily: "Inter_400Regular" },
            ]}
            numberOfLines={2}
          >
            {msg.subtitle}
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
