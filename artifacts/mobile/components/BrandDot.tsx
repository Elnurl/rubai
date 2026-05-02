import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";

type Mode = "static" | "idle" | "thinking";
type Size = "sm" | "md" | "lg" | "xl" | "hero";

type Props = {
  /** Visual presentation: static = no animation. idle = subtle breathing pulse.
   *  thinking = vertical 3-dot checklist progression (used while AI responds). */
  mode?: Mode;
  size?: Size;
  /** Optional override; defaults to the active palette's primary color. */
  color?: string;
};

const DOT_SIZE: Record<Size, number> = {
  sm: 10,
  md: 14,
  lg: 22,
  xl: 36,
  hero: 56,
};

const STACK_GAP: Record<Size, number> = {
  sm: 6,
  md: 9,
  lg: 14,
  xl: 22,
  hero: 32,
};

/**
 * The green dot above the "i" in "rubai" — the brand mark.
 *
 * - `static` and `idle` render a single dot (idle adds a calm breathing pulse).
 * - `thinking` renders three dots stacked vertically; one "lights up" at a
 *   time, top→middle→bottom, like checkboxes being completed in sequence.
 *   This communicates structured task progression rather than a generic
 *   spinner — execution, momentum, AI guidance.
 */
export function BrandDot({ mode = "static", size = "md", color }: Props) {
  const colors = useColors();
  const dotColor = color ?? colors.primary;
  const dotPx = DOT_SIZE[size];

  if (mode === "thinking") {
    return <ThinkingStack dotPx={dotPx} gap={STACK_GAP[size]} color={dotColor} />;
  }

  return <SingleDot dotPx={dotPx} color={dotColor} animated={mode === "idle"} />;
}

function SingleDot({
  dotPx,
  color,
  animated,
}: {
  dotPx: number;
  color: string;
  animated: boolean;
}) {
  const t = useSharedValue(0);

  useEffect(() => {
    if (!animated) {
      t.value = 0;
      return;
    }
    t.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
    return () => cancelAnimation(t);
  }, [animated, t]);

  const dotStyle = useAnimatedStyle(() => {
    "worklet";
    const scale = 1 + 0.06 * Math.sin(t.value * Math.PI);
    const opacity = 0.88 + 0.12 * Math.sin(t.value * Math.PI);
    return { transform: [{ scale }], opacity };
  });

  return (
    <View
      style={{
        width: dotPx,
        height: dotPx,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Animated.View
        style={[
          styles.dot,
          {
            width: dotPx,
            height: dotPx,
            borderRadius: dotPx / 2,
            backgroundColor: color,
          },
          animated ? dotStyle : null,
        ]}
      />
    </View>
  );
}

function ThinkingStack({
  dotPx,
  gap,
  color,
}: {
  dotPx: number;
  gap: number;
  color: string;
}) {
  // t cycles 0 → 3 over 1800ms. Each integer slice is one dot's "active" turn.
  const t = useSharedValue(0);

  useEffect(() => {
    t.value = withRepeat(
      withTiming(3, { duration: 1800, easing: Easing.linear }),
      -1,
      false,
    );
    return () => cancelAnimation(t);
  }, [t]);

  const styleForSlot = (phase: number, slot: 0 | 1 | 2) => {
    "worklet";
    const isActive = phase >= slot && phase < slot + 1;
    if (!isActive) {
      return { opacity: 0.18, transform: [{ scale: 1 }] };
    }
    const local = phase - slot; // 0..1
    // Quick rise on entry, hold full, gentle fade as we approach the next slot.
    const easeIn = Math.min(1, local / 0.18);
    const easeOut = 1 - Math.max(0, (local - 0.7) / 0.3);
    const intensity = Math.min(easeIn, easeOut);
    const opacity = 0.18 + 0.82 * intensity;
    const scale = 1 + 0.18 * intensity;
    return { opacity, transform: [{ scale }] };
  };

  const dot0 = useAnimatedStyle(() => styleForSlot(t.value, 0));
  const dot1 = useAnimatedStyle(() => styleForSlot(t.value, 1));
  const dot2 = useAnimatedStyle(() => styleForSlot(t.value, 2));

  const dotBase = {
    width: dotPx,
    height: dotPx,
    borderRadius: dotPx / 2,
    backgroundColor: color,
  };

  return (
    <View style={[styles.stack, { gap }]}>
      <Animated.View style={[dotBase, dot0]} />
      <Animated.View style={[dotBase, dot1]} />
      <Animated.View style={[dotBase, dot2]} />
    </View>
  );
}

const styles = StyleSheet.create({
  dot: {},
  stack: {
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
  },
});
