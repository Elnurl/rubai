import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";

import { Feather } from "@expo/vector-icons";

import { GOAL_META, profileGoalLabel } from "@/constants/atlas";
import { useColors } from "@/hooks/useColors";
import { GoalLimitError, useAtlas } from "@/providers/AtlasProvider";
import { TIER_INFO } from "@/types/atlas";
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
  const {
    createGoal,
    setRoadmapForGoal,
    setPendingDraft,
    pendingDraft,
    goals,
    canAddMoreGoals,
    goalLimit,
    subscription,
  } = useAtlas();
  const generate = useAtlasGenerateRoadmap();
  const [stepIndex, setStepIndex] = React.useState(0);
  type ErrorState =
    | { kind: "network"; message: string }
    | { kind: "limit"; message: string; limit: number };
  const [errorState, setErrorState] = React.useState<ErrorState | null>(null);
  const [retryToken, setRetryToken] = React.useState(0);
  const startedRef = useRef(false);
  // Snapshots for the effect to read without re-firing on changes.
  const goalsRef = useRef(goals);
  goalsRef.current = goals;
  const canAddMoreGoalsRef = useRef(canAddMoreGoals);
  canAddMoreGoalsRef.current = canAddMoreGoals;
  const goalLimitRef = useRef(goalLimit);
  goalLimitRef.current = goalLimit;
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
    if (errorState) return;
    const id = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
    }, 1500);
    return () => clearInterval(id);
  }, [errorState]);

  useEffect(() => {
    if (!profile) {
      router.replace("/welcome");
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;
    setErrorState(null);
    (async () => {
      try {
        // Pre-flight: if the user has no orphan to reuse AND is already at
        // their tier limit on completed goals, surface the limit error up
        // front instead of wasting a (slow, expensive) OpenAI roundtrip
        // only to throw afterwards.
        const orphan = goalsRef.current.find((g) => g.roadmap === null);
        if (!orphan && !canAddMoreGoalsRef.current) {
          throw new GoalLimitError(goalLimitRef.current);
        }

        // Generate the roadmap FIRST. We only persist a goal once the
        // expensive/external AI call has succeeded — that way a network or
        // server failure cannot leave behind an "orphan" goal that wastes
        // the user's tier slot.
        const roadmap = await generate.mutateAsync({ data: { profile } });

        // If a previous failed attempt left an orphan goal lying around
        // (created locally before this safer ordering existed), reuse it
        // instead of creating yet another goal record.
        const reusableOrphan = goalsRef.current.find(
          (g) => g.roadmap === null,
        );
        let goalId: string;
        if (reusableOrphan) {
          goalId = reusableOrphan.id;
        } else {
          const newGoal = await createGoal(profile);
          goalId = newGoal.id;
        }
        await setRoadmapForGoal(goalId, roadmap);
        await setPendingDraft(null);
        setStepIndex(STEPS.length - 1);
        setTimeout(() => router.replace("/(tabs)"), 700);
      } catch (err) {
        // Surface the failure instead of looping silently. We split errors
        // into two flavors so we can offer the right next action:
        //   - "limit": the user is at their tier's goal cap; retrying will
        //     just hit the same wall, so we route them to manage existing
        //     goals instead.
        //   - "network": transient — Try again is the right move.
        startedRef.current = false;
        if (err instanceof GoalLimitError) {
          setErrorState({
            kind: "limit",
            message: `You've reached your plan's limit of ${err.limit} active goal${err.limit === 1 ? "" : "s"}. Free up a slot by removing or replacing an existing goal.`,
            limit: err.limit,
          });
        } else {
          const message =
            err instanceof Error
              ? err.message
              : "Something went wrong building your roadmap.";
          setErrorState({ kind: "network", message });
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, retryToken]);

  const handleRetry = useCallback(() => {
    if (startedRef.current) return;
    setStepIndex(0);
    setErrorState(null);
    setRetryToken((t) => t + 1);
  }, []);

  const handleBack = useCallback(() => {
    router.replace("/welcome");
  }, [router]);

  const handleManageGoals = useCallback(() => {
    router.replace("/(tabs)/goals");
  }, [router]);

  const handleReplaceGoal = useCallback(() => {
    router.replace("/replace-goal");
  }, [router]);

  const handleUpgrade = useCallback(() => {
    router.replace("/(tabs)/account");
  }, [router]);

  const planLabel = TIER_INFO[subscription.tier].label;
  const usedSlots = goals.filter((g) => g.roadmap !== null).length;

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
        <Text
          style={[
            styles.title,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
          {errorState
            ? errorState.kind === "limit"
              ? "Plan limit reached."
              : "Hit a snag."
            : "Engineering your roadmap."}
        </Text>
        <Text
          style={[
            styles.step,
            { color: colors.primary, fontFamily: "Inter_600SemiBold" },
          ]}
        >
          {errorState
            ? errorState.kind === "limit"
              ? `You're on the ${planLabel} plan`
              : "Couldn't reach the server"
            : STEPS[stepIndex]}
        </Text>

        {errorState?.kind === "network" && (
          <>
            <Text
              style={[
                styles.error,
                { color: colors.destructive, fontFamily: "Inter_500Medium" },
              ]}
            >
              {errorState.message}
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

        {errorState?.kind === "limit" && (
          <View style={styles.limitWrap}>
            <View
              style={[
                styles.usageCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Text
                style={[
                  styles.usageEyebrow,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_600SemiBold",
                  },
                ]}
              >
                GOALS USED
              </Text>
              <Text
                style={[
                  styles.usageNumber,
                  { color: colors.foreground, fontFamily: "Inter_700Bold" },
                ]}
              >
                {usedSlots}
                <Text
                  style={[
                    styles.usageDenom,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  {" "}
                  / {goalLimit}
                </Text>
              </Text>
              <Text
                style={[
                  styles.usageHint,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {errorState.message}
              </Text>
            </View>

            <View style={styles.actions}>
              <Pressable
                onPress={handleReplaceGoal}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  { backgroundColor: colors.primary },
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
              >
                <Feather
                  name="refresh-ccw"
                  size={15}
                  color={colors.primaryForeground}
                />
                <Text
                  style={[
                    styles.primaryBtnText,
                    { fontFamily: "Inter_700Bold" },
                  ]}
                >
                  Replace a goal
                </Text>
              </Pressable>

              <Pressable
                onPress={handleManageGoals}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  { borderColor: colors.border },
                  pressed && { opacity: 0.7 },
                ]}
                accessibilityRole="button"
              >
                <Feather name="list" size={14} color={colors.foreground} />
                <Text
                  style={[
                    styles.secondaryBtnText,
                    {
                      color: colors.foreground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  View my goals
                </Text>
              </Pressable>

              <Pressable
                onPress={handleUpgrade}
                style={({ pressed }) => [
                  styles.tertiaryBtn,
                  pressed && { opacity: 0.7 },
                ]}
                accessibilityRole="button"
              >
                <Feather name="arrow-up-right" size={14} color={colors.accent} />
                <Text
                  style={[
                    styles.tertiaryBtnText,
                    { color: colors.accent, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  Upgrade plan
                </Text>
              </Pressable>

              <Pressable
                onPress={handleBack}
                style={({ pressed }) => [
                  styles.tertiaryBtn,
                  pressed && { opacity: 0.6 },
                ]}
                accessibilityRole="button"
              >
                <Text
                  style={[
                    styles.tertiaryBtnText,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  Back to start
                </Text>
              </Pressable>
            </View>
          </View>
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
    flexDirection: "row",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 15,
    letterSpacing: 0.2,
  },
  secondaryBtn: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    gap: 8,
  },
  secondaryBtnText: {
    fontSize: 14,
    letterSpacing: 0.2,
  },
  tertiaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  tertiaryBtnText: {
    fontSize: 13.5,
    letterSpacing: 0.2,
  },
  limitWrap: {
    width: "100%",
    marginTop: 18,
    gap: 14,
  },
  usageCard: {
    width: "100%",
    paddingVertical: 18,
    paddingHorizontal: 18,
    borderWidth: 1,
    alignItems: "center",
    gap: 4,
  },
  usageEyebrow: {
    fontSize: 11,
    letterSpacing: 1.4,
  },
  usageNumber: {
    fontSize: 36,
    lineHeight: 42,
    marginTop: 2,
  },
  usageDenom: {
    fontSize: 18,
  },
  usageHint: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
});
