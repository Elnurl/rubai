import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

import { AtlasLogo } from "@/components/AtlasLogo";
import { GOAL_META, profileGoalLabel } from "@/constants/atlas";
import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";
import {
  useAtlasGenerateRoadmap,
  type UserProfile,
} from "@workspace/api-client-react";

const STEPS = [
  "Reading your intake",
  "Analyzing constraints and time",
  "Selecting strategy",
  "Drafting phases",
  "Setting milestones",
  "Stress-testing the plan",
];

export default function GeneratingScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ profile?: string }>();
  const { createGoal, setRoadmapForGoal, setPendingDraft, pendingDraft } = useAtlas();
  const generate = useAtlasGenerateRoadmap();
  const [stepIndex, setStepIndex] = React.useState(0);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [retryToken, setRetryToken] = React.useState(0);
  const startedRef = useRef(false);
  // Persist the created goal across retries so a roadmap-step failure doesn't
  // spawn a duplicate goal each time the user taps "Try again".
  const createdGoalIdRef = useRef<string | null>(null);
  const pulse = useRef(new Animated.Value(0)).current;

  // Decode profile from route params, falling back to the pendingDraft's
  // synthesised profile if the app was reopened mid-flow and params are gone.
  const profile = useMemo<UserProfile | null>(() => {
    try {
      if (params.profile) return JSON.parse(params.profile) as UserProfile;
    } catch {
      // ignore parse failure, fall through to draft
    }
    return pendingDraft?.synthesizedProfile ?? null;
  }, [params.profile, pendingDraft?.synthesizedProfile]);

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
    if (errorMessage) return;
    const id = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }, 1500);
    return () => clearInterval(id);
  }, [errorMessage]);

  useEffect(() => {
    if (!profile) {
      router.replace("/welcome");
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    setErrorMessage(null);
    (async () => {
      try {
        // Create the goal first (returns its id so we can attach the roadmap
        // back to the exact goal without relying on async-state propagation).
        // Reuse the previously-created goal on retry to avoid orphan goals
        // when only the AI roadmap step failed.
        let goalId = createdGoalIdRef.current;
        if (!goalId) {
          const newGoal = await createGoal(profile);
          goalId = newGoal.id;
          createdGoalIdRef.current = goalId;
        }
        const roadmap = await generate.mutateAsync({ data: { profile } });
        await setRoadmapForGoal(goalId, roadmap);
        await setPendingDraft(null);
        setStepIndex(STEPS.length - 1);
        setTimeout(() => router.replace("/(tabs)"), 700);
      } catch (err) {
        // Surface the failure instead of looping silently. The user
        // can either tap "Try again" (which re-arms this effect via
        // retryToken) or back out to the welcome screen.
        startedRef.current = false;
        const message =
          err instanceof Error
            ? err.message
            : "Something went wrong building your roadmap.";
        setErrorMessage(message);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, retryToken]);

  const handleRetry = useCallback(() => {
    if (startedRef.current) return;
    setStepIndex(0);
    setErrorMessage(null);
    setRetryToken((t) => t + 1);
  }, []);

  const handleBack = useCallback(() => {
    router.replace("/welcome");
  }, [router]);

  const meta = profile ? GOAL_META[profile.goalType] : null;
  const displayLabel = profile ? profileGoalLabel(profile) : "";
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
            {displayLabel.toUpperCase()}
          </Text>
        )}
        <Text
          style={[
            styles.title,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
          {errorMessage ? "Hit a snag." : "Engineering your roadmap."}
        </Text>
        <Text
          style={[
            styles.step,
            { color: colors.primary, fontFamily: "Inter_600SemiBold" },
          ]}
        >
          {errorMessage ? "Couldn't reach the server" : STEPS[stepIndex]}
        </Text>

        {errorMessage && (
          <>
            <Text
              style={[
                styles.error,
                { color: colors.destructive, fontFamily: "Inter_500Medium" },
              ]}
            >
              {errorMessage}
            </Text>

            <View style={styles.actions}>
              <Pressable
                onPress={handleRetry}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: colors.primary },
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.primaryBtnText,
                    { fontFamily: "Inter_700Bold" },
                  ]}
                >
                  Try again
                </Text>
              </Pressable>

              <Pressable
                onPress={handleBack}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  { borderColor: colors.border },
                  pressed && { opacity: 0.7 },
                ]}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.secondaryBtnText,
                    {
                      color: colors.foreground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  Back to start
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
  actions: {
    marginTop: 24,
    width: "100%",
    gap: 10,
  },
  primaryBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 15,
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  secondaryBtnText: {
    fontSize: 14,
    letterSpacing: 0.2,
  },
});
