import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useTranslation } from "react-i18next";

import { GOAL_META, profileGoalLabel } from "@/constants/atlas";
import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";
import type { Goal } from "@/types/atlas";

function computeCurrentWeek(startDate: string | null): number {
  if (!startDate) return 1;
  const start = new Date(startDate + "T00:00:00");
  const now = new Date();
  const days = Math.floor(
    (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
  );
  return Math.max(1, Math.floor(days / 7) + 1);
}

function goalCompletionPct(goal: Goal): number {
  const currentWeek = computeCurrentWeek(goal.startDate ?? null);
  const phases = goal.roadmap?.phases;
  const totalWeeks =
    goal.profile?.targetTimelineWeeks ??
    (phases && phases.length > 0 ? phases[phases.length - 1].endWeek : 12);
  return Math.round(Math.min(currentWeek / Math.max(totalWeeks, 1), 1) * 100);
}

export default function AccountGoalsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 0 : insets.top;

  const { goals, activeGoalId, setActiveGoal } = useAtlas();
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const sortedGoals = useMemo(
    () =>
      [...goals].sort((a, b) => {
        if (a.id === activeGoalId) return -1;
        if (b.id === activeGoalId) return 1;
        return 0;
      }),
    [goals, activeGoalId],
  );

  const handleSwitch = async (goalId: string) => {
    if (goalId === activeGoalId) return;
    setSwitchingId(goalId);
    try {
      await setActiveGoal(goalId);
    } finally {
      setSwitchingId(null);
    }
    router.back();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 14,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backBtn}
        >
          <Feather name="arrow-left" size={22} color={colors.foreground} />
        </Pressable>
        <Text
          style={[
            styles.headerTitle,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
          {t("goals.headerTitle", "My Goals")}
        </Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {goals.length === 0 ? (
          <View style={styles.empty}>
            <Feather name="flag" size={36} color={colors.mutedForeground} />
            <Text
              style={[
                styles.emptyText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              {t("goals.emptyText", "No goals yet. Add one from the Goals tab.")}
            </Text>
          </View>
        ) : (
          sortedGoals.map((goal, i) => (
            <GoalRow
              key={goal.id}
              goal={goal}
              index={i}
              isActive={goal.id === activeGoalId}
              isSwitching={switchingId === goal.id}
              onMakeActive={() => void handleSwitch(goal.id)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

type GoalRowProps = {
  goal: Goal;
  index: number;
  isActive: boolean;
  isSwitching: boolean;
  onMakeActive: () => void;
};

function GoalRow({
  goal,
  index,
  isActive,
  isSwitching,
  onMakeActive,
}: GoalRowProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const meta = GOAL_META[goal.profile.goalType];
  const label = profileGoalLabel(goal.profile);
  const currentWeek = computeCurrentWeek(goal.startDate ?? null);
  const phases = goal.roadmap?.phases;
  const totalWeeks =
    goal.profile?.targetTimelineWeeks ??
    (phases && phases.length > 0 ? phases[phases.length - 1].endWeek : 12);
  const pct = goalCompletionPct(goal);
  const hasRoadmap = goal.roadmap !== null;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(280)}
      style={[
        styles.row,
        {
          backgroundColor: colors.card,
          borderColor: isActive ? colors.primary : colors.border,
          borderWidth: isActive ? 2 : 1,
          borderRadius: colors.radius,
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          {
            backgroundColor: isActive
              ? colors.primary
              : meta.accent + "1A",
          },
        ]}
      >
        <Ionicons
          name={meta.icon as React.ComponentProps<typeof Ionicons>["name"]}
          size={22}
          color={isActive ? colors.primaryForeground : meta.accent}
        />
      </View>

      <View style={styles.details}>
        <View style={styles.titleRow}>
          <Text
            numberOfLines={1}
            style={[
              styles.title,
              { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {label}
          </Text>
          {isActive && (
            <View
              style={[
                styles.activeBadge,
                {
                  backgroundColor: colors.primary + "1A",
                  borderColor: colors.primary,
                },
              ]}
            >
              <Text
                style={[
                  styles.activeBadgeText,
                  { color: colors.primary, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {t("goals.activeBadge", "ACTIVE")}
              </Text>
            </View>
          )}
        </View>

        {hasRoadmap ? (
          <>
            <View style={styles.metaRow}>
              <Text
                style={[
                  styles.metaText,
                  {
                    color: isActive ? colors.primary : colors.mutedForeground,
                    fontFamily: "Inter_500Medium",
                  },
                ]}
              >
                {t("goals.weekOf", "Week {{currentWeek}} of {{totalWeeks}}", { currentWeek, totalWeeks })}
              </Text>
              <Text
                style={[
                  styles.metaText,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {t("goals.pctComplete", "{{pct}}% complete", { pct })}
              </Text>
            </View>

            <View
              style={[
                styles.progressTrack,
                { backgroundColor: colors.primary + "20" },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: isActive
                      ? colors.primary
                      : meta.accent,
                    width: `${pct}%` as `${number}%`,
                  },
                ]}
              />
            </View>
          </>
        ) : (
          <Text
            style={[
              styles.metaText,
              {
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
              },
            ]}
          >
            {t("goals.roadmapPending", "Roadmap pending")}
          </Text>
        )}

        {!isActive && (
          <Pressable
            onPress={onMakeActive}
            disabled={isSwitching}
            style={({ pressed }) => [
              styles.makeActiveBtn,
              {
                backgroundColor: pressed
                  ? colors.primary + "20"
                  : colors.primary + "12",
                borderColor: colors.primary + "40",
                borderRadius: colors.radius - 2,
                opacity: isSwitching ? 0.6 : 1,
              },
            ]}
          >
            {isSwitching ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Feather name="check-circle" size={13} color={colors.primary} />
                <Text
                  style={[
                    styles.makeActiveBtnText,
                    { color: colors.primary, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  {t("goals.makeActive", "Make active")}
                </Text>
              </>
            )}
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    alignItems: "flex-start",
  },
  headerTitle: {
    fontSize: 17,
    letterSpacing: -0.3,
  },
  scroll: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 10,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingTop: 60,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    padding: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  details: {
    flex: 1,
    gap: 6,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  title: {
    fontSize: 15,
    flexShrink: 1,
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    borderRadius: 999,
  },
  activeBadgeText: {
    fontSize: 9.5,
    letterSpacing: 1,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaText: {
    fontSize: 11.5,
    letterSpacing: 0.2,
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  makeActiveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    alignSelf: "flex-start",
    marginTop: 2,
  },
  makeActiveBtnText: {
    fontSize: 12.5,
    letterSpacing: 0.1,
  },
});
