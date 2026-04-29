import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AtlasButton } from "@/components/AtlasButton";
import { SectionHeader } from "@/components/SectionHeader";
import { SubscriptionCard } from "@/components/SubscriptionCard";
import { profileGoalLabel } from "@/constants/atlas";
import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";
import {
  useAtlasAdaptPlan,
  type AdaptResponse,
} from "@workspace/api-client-react";

export default function AccountScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 8;
  const bottomTab = isWeb ? 100 : 110;

  const {
    goals,
    subscription,
    account,
    activeGoal,
    activeProfile,
    activeRoadmap,
    activeBehavioral,
    updateSubscription,
    updateAccount,
    resetAll,
  } = useAtlas();

  const adapt = useAtlasAdaptPlan();
  const [adaptResult, setAdaptResult] = useState<AdaptResponse | null>(null);

  const onReset = () => {
    const doReset = async () => {
      await resetAll();
      router.replace("/welcome");
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Erase ALL goals, history and progress?")) {
        void doReset();
      }
    } else {
      Alert.alert(
        "Reset everything?",
        "This permanently deletes every goal, roadmap, history entry and preference.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Reset", style: "destructive", onPress: doReset },
        ],
      );
    }
  };

  const onAdapt = async () => {
    if (!activeProfile || !activeRoadmap) return;
    try {
      const res = await adapt.mutateAsync({
        data: {
          profile: activeProfile,
          roadmap: activeRoadmap,
          behavioral: activeBehavioral,
        },
      });
      setAdaptResult(res);
    } catch {
      // ignore
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad, paddingBottom: bottomTab },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader
          eyebrow="ACCOUNT"
          title="Your subscription"
          subtitle="Demo account — switch tiers freely."
        />

        <SubscriptionCard
          currentTier={subscription.tier}
          goalsUsed={goals.length}
          onSelect={(tier) => void updateSubscription(tier)}
        />

        <SectionHeader
          eyebrow="PREFERENCES"
          title="Notifications"
          subtitle="Local-only preferences for this device."
        />

        <View
          style={[
            styles.prefsCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <PrefRow
            icon="bell"
            title="Daily plan reminder"
            description={`Sends a nudge each morning at ${account.reminderTime}.`}
            value={account.notificationsEnabled}
            onChange={(v) => void updateAccount({ notificationsEnabled: v })}
          />
          <View style={[styles.prefDivider, { backgroundColor: colors.border }]} />
          <PrefRow
            icon="trending-up"
            title="Weekly performance summary"
            description="A short note on streaks and completion rate."
            value={account.performanceUpdates}
            onChange={(v) => void updateAccount({ performanceUpdates: v })}
          />
        </View>

        {activeGoal && activeProfile ? (
          <>
            <SectionHeader
              eyebrow="ACTIVE GOAL"
              title={profileGoalLabel(activeProfile)}
              subtitle={activeRoadmap?.headline}
            />

            <View
              style={[
                styles.adaptCard,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <View style={styles.adaptHeader}>
                <Feather name="cpu" size={16} color={colors.primary} />
                <Text
                  style={[
                    styles.adaptLabel,
                    { color: colors.primary, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  ADAPTIVE ENGINE
                </Text>
              </View>
              <Text
                style={[
                  styles.adaptBody,
                  { color: colors.foreground, fontFamily: "Inter_400Regular" },
                ]}
              >
                Run a quick re-evaluation. Atlas will look at your last two
                weeks and decide whether to soften, hold, or push the plan.
              </Text>
              <AtlasButton
                label={adapt.isPending ? "Analyzing" : "Re-evaluate this goal"}
                variant="secondary"
                onPress={onAdapt}
                loading={adapt.isPending}
                disabled={!activeRoadmap || adapt.isPending}
                icon={
                  <Feather name="refresh-cw" size={16} color={colors.foreground} />
                }
              />

              {adaptResult && (
                <View style={styles.adaptResult}>
                  <View style={styles.adaptDifficulty}>
                    <Feather
                      name={
                        adaptResult.difficultyAdjustment === "harder"
                          ? "trending-up"
                          : adaptResult.difficultyAdjustment === "easier"
                            ? "trending-down"
                            : "minus"
                      }
                      size={16}
                      color={
                        adaptResult.difficultyAdjustment === "harder"
                          ? colors.accent
                          : adaptResult.difficultyAdjustment === "easier"
                            ? colors.primary
                            : colors.mutedForeground
                      }
                    />
                    <Text
                      style={[
                        styles.adaptDifficultyText,
                        { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
                      ]}
                    >
                      {adaptResult.difficultyAdjustment === "harder"
                        ? "Pushing harder"
                        : adaptResult.difficultyAdjustment === "easier"
                          ? "Easing back"
                          : "Holding the line"}
                    </Text>
                  </View>
                  <View style={{ gap: 6 }}>
                    {adaptResult.adjustments.map((a, i) => (
                      <View key={i} style={styles.adjRow}>
                        <View
                          style={[styles.adjDot, { backgroundColor: colors.primary }]}
                        />
                        <Text
                          style={[
                            styles.adjText,
                            { color: colors.foreground, fontFamily: "Inter_400Regular" },
                          ]}
                        >
                          {a}
                        </Text>
                      </View>
                    ))}
                  </View>
                  <Text
                    style={[
                      styles.encouragement,
                      { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
                    ]}
                  >
                    {adaptResult.encouragement}
                  </Text>
                </View>
              )}
            </View>

            <View
              style={[
                styles.statsRow,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <Stat
                label="Streak"
                value={String(activeBehavioral.currentStreakDays)}
                unit="days"
                color={colors.primary}
              />
              <Divider />
              <Stat
                label="Done rate"
                value={`${Math.round(activeBehavioral.completionRate * 100)}`}
                unit="%"
                color={colors.accent}
              />
              <Divider />
              <Stat
                label="Daily time"
                value={String(activeProfile.availableTimePerDayMinutes)}
                unit="min"
                color={colors.foreground}
              />
            </View>
          </>
        ) : null}

        <Pressable
          onPress={onReset}
          style={({ pressed }) => [
            styles.resetButton,
            {
              borderColor: colors.border,
              borderRadius: colors.radius,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Feather name="rotate-ccw" size={16} color={colors.destructive} />
          <Text
            style={[
              styles.resetText,
              { color: colors.destructive, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            Reset all data
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function PrefRow({
  icon,
  title,
  description,
  value,
  onChange,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const colors = useColors();
  return (
    <View style={styles.prefRow}>
      <View style={[styles.prefIcon, { backgroundColor: colors.muted }]}>
        <Feather name={icon} size={16} color={colors.foreground} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text
          style={[
            styles.prefTitle,
            { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.prefDesc,
            { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
          ]}
        >
          {description}
        </Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={Platform.OS === "android" ? colors.background : undefined}
      />
    </View>
  );
}

function Stat({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: string;
  unit: string;
  color: string;
}) {
  const colors = useColors();
  return (
    <View style={statStyles.container}>
      <Text style={[statStyles.value, { color, fontFamily: "Inter_700Bold" }]}>
        {value}
        <Text
          style={[
            statStyles.unit,
            { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
          ]}
        >
          {" "}
          {unit}
        </Text>
      </Text>
      <Text
        style={[
          statStyles.label,
          { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
        ]}
      >
        {label.toUpperCase()}
      </Text>
    </View>
  );
}

function Divider() {
  const colors = useColors();
  return <View style={[statStyles.divider, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 22,
    gap: 16,
  },
  prefsCard: {
    borderWidth: 1,
    paddingVertical: 4,
  },
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  prefIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  prefTitle: {
    fontSize: 14.5,
  },
  prefDesc: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  prefDivider: {
    height: 1,
    marginHorizontal: 16,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1,
    padding: 16,
  },
  adaptCard: {
    padding: 18,
    borderWidth: 1,
    gap: 12,
  },
  adaptHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  adaptLabel: {
    fontSize: 11,
    letterSpacing: 1.6,
  },
  adaptBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  adaptResult: {
    gap: 10,
    marginTop: 4,
  },
  adaptDifficulty: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  adaptDifficultyText: {
    fontSize: 14.5,
  },
  adjRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  adjDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginTop: 7,
  },
  adjText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 20,
  },
  encouragement: {
    fontSize: 13,
    lineHeight: 19,
    fontStyle: "italic",
    marginTop: 4,
  },
  resetButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 16,
    borderWidth: 1,
    marginTop: 6,
  },
  resetText: {
    fontSize: 14.5,
    letterSpacing: 0.2,
  },
});

const statStyles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 4,
    alignItems: "center",
  },
  value: {
    fontSize: 22,
    letterSpacing: -0.4,
  },
  unit: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
  label: {
    fontSize: 10,
    letterSpacing: 1.5,
  },
  divider: {
    width: 1,
    marginHorizontal: 8,
  },
});
