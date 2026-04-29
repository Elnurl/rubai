import { useRouter } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { AtlasLogo } from "@/components/AtlasLogo";
import { GOAL_META } from "@/constants/atlas";
import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";
import { useAtlasGenerateRoadmap } from "@workspace/api-client-react";

const STEPS = [
  "Reading your profile",
  "Analyzing constraints and time",
  "Selecting strategy",
  "Drafting phases",
  "Setting milestones",
  "Stress-testing the plan",
];

export default function GeneratingScreen() {
  const colors = useColors();
  const router = useRouter();
  const { profile, setRoadmap } = useAtlas();
  const generate = useAtlasGenerateRoadmap();
  const [stepIndex, setStepIndex] = React.useState(0);
  const startedRef = useRef(false);
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulse]);

  useEffect(() => {
    const id = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }, 1500);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!profile) {
      router.replace("/welcome");
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const roadmap = await generate.mutateAsync({ data: { profile } });
        await setRoadmap(roadmap);
        setStepIndex(STEPS.length - 1);
        setTimeout(() => router.replace("/(tabs)"), 700);
      } catch {
        startedRef.current = false;
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const meta = profile ? GOAL_META[profile.goalType] : null;
  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={styles.center}>
        <View style={styles.pulseWrap}>
          <Animated.View
            style={[
              styles.pulse,
              { backgroundColor: colors.primary, opacity, transform: [{ scale }] },
            ]}
          />
          <View style={[styles.dot, { backgroundColor: colors.primary }]} />
        </View>

        <View style={{ height: 40 }} />
        <AtlasLogo size="md" />
        {meta && (
          <Text
            style={[
              styles.label,
              { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
            ]}
          >
            {meta.label.toUpperCase()}
          </Text>
        )}
        <Text
          style={[
            styles.title,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
          {generate.isError ? "Hit a snag." : "Engineering your roadmap."}
        </Text>
        <Text
          style={[
            styles.step,
            { color: colors.primary, fontFamily: "Inter_600SemiBold" },
          ]}
        >
          {generate.isError ? "Retrying" : STEPS[stepIndex]}
        </Text>

        {generate.isError && (
          <Text
            style={[
              styles.error,
              { color: colors.destructive, fontFamily: "Inter_500Medium" },
            ]}
          >
            Connection issue. We'll try again automatically.
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  pulseWrap: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  pulse: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  dot: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  label: {
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 14,
  },
  title: {
    fontSize: 26,
    letterSpacing: -0.5,
    marginTop: 8,
    textAlign: "center",
  },
  step: {
    fontSize: 14,
    letterSpacing: 0.4,
    marginTop: 18,
  },
  error: {
    marginTop: 14,
    fontSize: 13,
    textAlign: "center",
  },
});
