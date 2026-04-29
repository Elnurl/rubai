import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AtlasButton } from "@/components/AtlasButton";
import { EmptyState } from "@/components/EmptyState";
import { SectionHeader } from "@/components/SectionHeader";
import { GOAL_META, profileGoalLabel } from "@/constants/atlas";
import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";
import {
  useAtlasAdaptPlan,
  type AdaptResponse,
} from "@workspace/api-client-react";

export default function MeScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 8;
  const bottomTab = isWeb ? 100 : 110;

  const { profile, roadmap, behavioral, currentWeek, resetAll } = useAtlas();
  const adapt = useAtlasAdaptPlan();
  const [adaptResult, setAdaptResult] = useState<AdaptResponse | null>(null);

  const onReset = () => {
    const doReset = async () => {
      await resetAll();
      router.replace("/welcome");
    };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm("Start over and delete your current plan?")) {
        doReset();
      }
    } else {
      Alert.alert(
        "Start a new goal?",
        "This deletes your current profile, roadmap, history, and progress.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Reset", style: "destructive", onPress: doReset },
        ],
      );
    }
  };

  const onAdapt = async () => {
    if (!profile || !roadmap) return;
    try {
      const res = await adapt.mutateAsync({
        data: { profile, roadmap, behavioral },
      });
      setAdaptResult(res);
    } catch {
      // ignore
    }
  };

  if (!profile || !roadmap) {
    return (
      <View
        style={[
          styles.root,
          { backgroundColor: colors.background, paddingTop: topPad },
        ]}
      >
        <EmptyState
          icon="user"
          title="Nothing here yet"
          description="Finish onboarding to see your profile."
        />
      </View>
    );
  }

  const meta = GOAL_META[profile.goalType];

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad, paddingBottom: bottomTab },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader eyebrow="PROFILE" title="You" subtitle={profileGoalLabel(profile)} />

        <View
          style={[
            styles.statsRow,
            { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
          ]}
        >
          <Stat
            label="Streak"
            value={String(behavioral.currentStreakDays)}
            unit="days"
            color={colors.primary}
          />
          <Divider />
          <Stat
            label="Done rate"
            value={`${Math.round(behavioral.completionRate * 100)}`}
            unit="%"
            color={colors.accent}
          />
          <Divider />
          <Stat
            label="Week"
            value={String(currentWeek)}
            unit={`of ${roadmap.totalWeeks}`}
            color={colors.foreground}
          />
        </View>

        <ProfileCard
          icon="target"
          title="Goal"
          body={profile.goalStatement}
        />
        <ProfileCard
          icon="bar-chart-2"
          title="Starting from"
          body={profile.currentLevel}
        />
        <ProfileCard
          icon="clock"
          title="Daily time"
          body={`${profile.availableTimePerDayMinutes} minutes per day`}
        />
        <ProfileCard
          icon="sun"
          title="Productivity window"
          body={profile.productivityPattern}
        />
        <ProfileCard
          icon="trending-up"
          title="Consistency"
          body={profile.consistencyLevel}
        />
        {profile.constraints.length > 0 && (
          <ProfileCard
            icon="alert-circle"
            title="Constraints"
            body={profile.constraints.join(" • ")}
          />
        )}

        <View style={{ height: 8 }} />

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
            Run a quick re-evaluation. Atlas will look at your last two weeks
            and decide whether to soften, hold, or push the plan.
          </Text>
          <AtlasButton
            label={adapt.isPending ? "Analyzing" : "Re-evaluate plan"}
            variant="secondary"
            onPress={onAdapt}
            loading={adapt.isPending}
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
            Start over with a new goal
          </Text>
        </Pressable>
      </ScrollView>
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
      <Text
        style={[
          statStyles.value,
          { color, fontFamily: "Inter_700Bold" },
        ]}
      >
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

function ProfileCard({
  icon,
  title,
  body,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  body: string;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.profileCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <View style={[styles.profileIcon, { backgroundColor: colors.muted }]}>
        <Feather name={icon} size={16} color={colors.foreground} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Text
          style={[
            styles.profileTitle,
            { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
          ]}
        >
          {title.toUpperCase()}
        </Text>
        <Text
          style={[
            styles.profileBody,
            { color: colors.foreground, fontFamily: "Inter_500Medium" },
          ]}
        >
          {body}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 22,
    gap: 14,
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1,
    padding: 16,
    marginTop: 6,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderWidth: 1,
  },
  profileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  profileTitle: {
    fontSize: 10.5,
    letterSpacing: 1.4,
  },
  profileBody: {
    fontSize: 14.5,
    lineHeight: 20,
  },
  adaptCard: {
    padding: 18,
    borderWidth: 1,
    gap: 12,
    marginTop: 6,
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
    marginTop: 10,
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
