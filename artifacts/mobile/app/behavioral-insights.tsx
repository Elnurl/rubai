import { Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AreaChart } from "@/components/charts/AreaChart";
import { BarChart } from "@/components/charts/BarChart";
import { FocusPulseCard } from "@/components/FocusPulseCard";
import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";
import {
  useAtlasBehavioralProfile,
  type BehavioralProfileRequestRecentHistoryItem,
} from "@workspace/api-client-react";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const FULL_DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function isoForDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

export default function BehavioralInsightsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  const {
    activeBehavioral,
    activeBehavioralProfile,
    activeTaskHistory,
    activeProfile,
    activeReflections,
    setActiveBehavioralProfile,
  } = useAtlas();
  const refreshProfile = useAtlasBehavioralProfile();
  const [adoptedAt, setAdoptedAt] = React.useState<number | null>(null);

  const {
    intensitySeries,
    intensityLabels,
    bestDay,
    deepWorkHours,
    consistencyPct,
    consistencyDelta,
    avgFocusHours,
    avgFocusDelta,
    bars14,
    barsStartLabel,
  } = useMemo(() => {
    // 7-day rolling-average intensity (rolling avg of completions across each
    // day's window, normalized to a smooth curve).
    const series: number[] = [];
    const dayTotals: number[] = [];
    const dayWeekdays: number[] = [];
    for (let i = 6; i >= 0; i--) {
      const iso = isoForDaysAgo(i);
      const completed = activeTaskHistory.filter(
        (e) => e.date === iso && e.completed,
      ).length;
      dayTotals.push(completed);
      const date = new Date(iso);
      dayWeekdays.push(date.getDay());
    }
    // Rolling-window smoothing
    for (let i = 0; i < dayTotals.length; i++) {
      const window = dayTotals.slice(Math.max(0, i - 2), i + 1);
      series.push(window.reduce((a, b) => a + b, 0) / window.length);
    }

    // Best day = weekday with highest completion across last 14d
    const weekdayCounts = new Array(7).fill(0);
    const weekdayDays = new Array(7).fill(0);
    for (let i = 0; i < 14; i++) {
      const iso = isoForDaysAgo(i);
      const date = new Date(iso);
      const wd = date.getDay();
      const completed = activeTaskHistory.filter(
        (e) => e.date === iso && e.completed,
      ).length;
      weekdayCounts[wd] += completed;
      weekdayDays[wd] += 1;
    }
    let bestWd = 6;
    let bestAvg = -1;
    for (let i = 0; i < 7; i++) {
      const avg = weekdayDays[i] > 0 ? weekdayCounts[i] / weekdayDays[i] : 0;
      if (avg > bestAvg) {
        bestAvg = avg;
        bestWd = i;
      }
    }

    // Deep work hours: prefer real `focusMinutes` accumulated in last 7d.
    // Fall back to the legacy 1.5h-per-completed-task heuristic only when
    // the user hasn't run any focus sessions yet so the chart isn't empty.
    const last7Total = dayTotals.reduce((a, b) => a + b, 0);
    let last7FocusMinutes = 0;
    for (let i = 0; i < 7; i++) {
      const iso = isoForDaysAgo(i);
      for (const e of activeTaskHistory) {
        if (e.date === iso && typeof e.focusMinutes === "number") {
          last7FocusMinutes += e.focusMinutes;
        }
      }
    }
    const hasRealFocus = last7FocusMinutes > 0;
    const deep = hasRealFocus
      ? Math.round((last7FocusMinutes / 60) * 10) / 10
      : Math.max(0, Math.round(last7Total * 1.5 * 10) / 10);

    // Consistency = (days with >=1 completion in last 14d) / 14
    let activeDays = 0;
    let prevActiveDays = 0;
    for (let i = 0; i < 14; i++) {
      const iso = isoForDaysAgo(i);
      const completed = activeTaskHistory.some(
        (e) => e.date === iso && e.completed,
      );
      if (completed) activeDays++;
    }
    for (let i = 14; i < 28; i++) {
      const iso = isoForDaysAgo(i);
      const completed = activeTaskHistory.some(
        (e) => e.date === iso && e.completed,
      );
      if (completed) prevActiveDays++;
    }
    const cPct = Math.round((activeDays / 14) * 100);
    const cDelta =
      prevActiveDays === 0
        ? cPct > 0
          ? cPct
          : 0
        : Math.round(((activeDays - prevActiveDays) / prevActiveDays) * 100);

    // Avg focus: real avg if focus sessions exist, else legacy heuristic.
    const avgFocus = hasRealFocus
      ? Math.round((last7FocusMinutes / 7 / 60) * 10) / 10
      : Math.max(0, Math.round((last7Total / 7) * 1.5 * 10) / 10);
    let prev7FocusMinutes = 0;
    let prev7Total = 0;
    for (let i = 7; i < 14; i++) {
      const iso = isoForDaysAgo(i);
      for (const e of activeTaskHistory) {
        if (e.date === iso) {
          if (e.completed) prev7Total += 1;
          if (typeof e.focusMinutes === "number") {
            prev7FocusMinutes += e.focusMinutes;
          }
        }
      }
    }
    const prevAvgFocus = hasRealFocus
      ? Math.round((prev7FocusMinutes / 7 / 60) * 10) / 10
      : Math.max(0, Math.round((prev7Total / 7) * 1.5 * 10) / 10);
    const avgDelta = Math.round((avgFocus - prevAvgFocus) * 60); // in minutes

    // Last 14 days completion bars
    const bars: number[] = [];
    for (let i = 13; i >= 0; i--) {
      const iso = isoForDaysAgo(i);
      const completed = activeTaskHistory.filter(
        (e) => e.date === iso && e.completed,
      ).length;
      bars.push(completed);
    }
    const allZeroBars = bars.every((v) => v === 0);
    const finalBars = allZeroBars ? [1, 2, 1, 3, 2, 4, 3, 2, 4, 3, 5, 4, 3, 5] : bars;

    // Final smoothed intensity series — fall back to a gentle baseline if no
    // history yet so the chart still renders.
    const allZeroSeries = series.every((v) => v === 0);
    const finalSeries = allZeroSeries
      ? [1.2, 1.6, 1.4, 2.1, 2.5, 2.2, 2.8]
      : series;

    return {
      intensitySeries: finalSeries,
      intensityLabels: DAY_LABELS,
      bestDay: FULL_DAY_NAMES[bestWd],
      deepWorkHours: deep,
      consistencyPct: cPct,
      consistencyDelta: cDelta,
      avgFocusHours: avgFocus,
      avgFocusDelta: avgDelta,
      bars14: finalBars,
      barsStartLabel: "Earlier this month",
    };
  }, [activeTaskHistory]);

  // Peak performance hours from learned profile, with sensible fallback
  const peakRows = useMemo(() => {
    const learned = activeBehavioralProfile?.peakHours ?? [];
    if (learned.length > 0) {
      // Map free-form "Morning", "Mid-Morning", etc to short rows
      return learned.slice(0, 3).map((label, i) => ({
        time: ["08", "11", "14"][i] ?? "—",
        title: label,
        description: [
          "Highest creative output detected",
          "Best for complex problem solving",
          "Recommended for light admin/wellness",
        ][i] ?? "Suggested focus window",
        score: [96, 88, 62][i] ?? 70,
      }));
    }
    return [
      {
        time: "08",
        title: "Morning Clarity",
        description: "Highest creative output detected",
        score: 96,
      },
      {
        time: "11",
        title: "Strategic Logic",
        description: "Best for complex problem solving",
        score: 88,
      },
      {
        time: "14",
        title: "Afternoon Dip",
        description: "Recommended for light admin/wellness",
        score: 62,
      },
    ];
  }, [activeBehavioralProfile]);

  const observation =
    activeBehavioralProfile?.summary ??
    "You tend to lose momentum after long stretches of uninterrupted work. Try inserting a 'micro-recovery' break to sustain your peak focus longer.";

  const handleRefresh = React.useCallback(async () => {
    if (!activeProfile) return;
    const recentHistory: BehavioralProfileRequestRecentHistoryItem[] =
      activeTaskHistory.slice(-60).map((e) => ({
        taskId: e.taskId,
        taskTitle: e.taskTitle,
        date: e.date,
        completed: e.completed,
        ...(typeof e.focusMinutes === "number"
          ? { focusMinutes: Math.round(e.focusMinutes) }
          : {}),
      }));
    try {
      const res = await refreshProfile.mutateAsync({
        data: {
          profile: activeProfile,
          recentHistory,
          reflections: activeReflections.slice(-20),
          ...(activeBehavioralProfile ? { previous: activeBehavioralProfile } : {}),
        },
      });
      await setActiveBehavioralProfile(res.profile);
    } catch {
      // Refresh errors stay silent — the existing profile is still shown.
    }
  }, [
    activeProfile,
    activeReflections,
    activeTaskHistory,
    activeBehavioralProfile,
    refreshProfile,
    setActiveBehavioralProfile,
  ]);

  const handleAdoptRhythm = React.useCallback(async () => {
    const labels = peakRows.map((r) => r.title).slice(0, 3);
    if (activeBehavioralProfile) {
      await setActiveBehavioralProfile({
        ...activeBehavioralProfile,
        peakHours: labels,
      });
      setAdoptedAt(Date.now());
      return;
    }
    // No profile yet — build one via refresh, then merge the adopted peak
    // hours on top so the user's choice is actually persisted (and not lost
    // to the freshly-generated profile).
    if (!activeProfile) return;
    const recentHistory: BehavioralProfileRequestRecentHistoryItem[] =
      activeTaskHistory.slice(-60).map((e) => ({
        taskId: e.taskId,
        taskTitle: e.taskTitle,
        date: e.date,
        completed: e.completed,
        ...(typeof e.focusMinutes === "number"
          ? { focusMinutes: Math.round(e.focusMinutes) }
          : {}),
      }));
    try {
      const res = await refreshProfile.mutateAsync({
        data: {
          profile: activeProfile,
          recentHistory,
          reflections: activeReflections.slice(-20),
        },
      });
      await setActiveBehavioralProfile({
        ...res.profile,
        peakHours: labels,
      });
      setAdoptedAt(Date.now());
    } catch {
      // Silent — leave UI unchanged so the user can retry.
    }
  }, [
    peakRows,
    activeBehavioralProfile,
    activeProfile,
    activeReflections,
    activeTaskHistory,
    refreshProfile,
    setActiveBehavioralProfile,
  ]);

  const adopted =
    adoptedAt !== null && Date.now() - adoptedAt < 30_000;

  const subtitleCopy =
    activeBehavioral.currentStreakDays >= 7
      ? "Your rhythm is stabilizing"
      : activeBehavioral.currentStreakDays >= 3
        ? "Your rhythm is taking shape"
        : "Building your baseline";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: isWeb ? 32 : insets.top + 8,
            paddingBottom: 40 + insets.bottom,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text
              style={[
                styles.headerTitle,
                { color: colors.foreground, fontFamily: "Inter_700Bold" },
              ]}
            >
              Behavioral Insights
            </Text>
            <Text
              style={[
                styles.headerSubtitle,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              {subtitleCopy}
            </Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={handleRefresh}
              disabled={refreshProfile.isPending || !activeProfile}
              style={({ pressed }) => [
                styles.closeBtn,
                {
                  backgroundColor: colors.muted,
                  opacity:
                    pressed || refreshProfile.isPending || !activeProfile
                      ? 0.55
                      : 1,
                },
              ]}
              accessibilityLabel="Refresh insights"
              accessibilityRole="button"
            >
              <Feather
                name="refresh-cw"
                size={16}
                color={colors.foreground}
              />
            </Pressable>
            <Pressable
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.closeBtn,
                {
                  backgroundColor: colors.muted,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              accessibilityLabel="Close"
              accessibilityRole="button"
            >
              <Feather name="x" size={18} color={colors.foreground} />
            </Pressable>
          </View>
        </View>

        {/* Focus Pulse */}
        <FocusPulseCard />

        {/* Stat cards */}
        <View style={styles.statRow}>
          <StatCard
            icon="activity"
            label="Consistency"
            value={`${consistencyPct}%`}
            delta={consistencyDelta}
            deltaSuffix="%"
          />
          <StatCard
            icon="clock"
            label="Avg. Focus"
            value={`${avgFocusHours}h`}
            delta={avgFocusDelta}
            deltaSuffix="m"
          />
        </View>

        {/* Focus Intensity */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1, gap: 3 }}>
              <Text
                style={[
                  styles.cardTitle,
                  { color: colors.foreground, fontFamily: "Inter_700Bold" },
                ]}
              >
                Focus Intensity
              </Text>
              <Text
                style={[
                  styles.cardSubtitle,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                7-day rolling average
              </Text>
            </View>
            <View
              style={[
                styles.weeklyChip,
                {
                  backgroundColor: colors.muted,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.weeklyChipText,
                  {
                    color: colors.foreground,
                    fontFamily: "Inter_500Medium",
                  },
                ]}
              >
                Weekly
              </Text>
              <Feather
                name="chevron-down"
                size={12}
                color={colors.mutedForeground}
              />
            </View>
          </View>

          <AreaChart
            data={intensitySeries}
            labels={intensityLabels}
            height={150}
            showDots
            highlightLastDot
          />

          <View
            style={[
              styles.subStatRow,
              { borderTopColor: colors.border },
            ]}
          >
            <SubStat label="Best Day" value={bestDay} />
            <View
              style={[styles.subStatDivider, { backgroundColor: colors.border }]}
            />
            <SubStat label="Deep Work" value={`${deepWorkHours} Hours`} />
          </View>
        </View>

        {/* Peak Performance Hours */}
        <View style={styles.sectionHeaderRow}>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            Peak Performance Hours
          </Text>
          <Text
            style={[
              styles.sectionLink,
              { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
            ]}
          >
            View Trends
          </Text>
        </View>

        <View style={styles.peakList}>
          {peakRows.map((row) => (
            <View
              key={row.title}
              style={[
                styles.peakRow,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <View
                style={[
                  styles.peakTimeChip,
                  { backgroundColor: colors.muted },
                ]}
              >
                <Text
                  style={[
                    styles.peakTimeText,
                    {
                      color: colors.foreground,
                      fontFamily: "Inter_700Bold",
                    },
                  ]}
                >
                  {row.time}
                </Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text
                  style={[
                    styles.peakTitle,
                    {
                      color: colors.foreground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {row.title}
                </Text>
                <Text
                  style={[
                    styles.peakDesc,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  {row.description}
                </Text>
              </View>
              <Text
                style={[
                  styles.peakScore,
                  { color: colors.primary, fontFamily: "Inter_700Bold" },
                ]}
              >
                {row.score}%
              </Text>
            </View>
          ))}
        </View>

        {/* Coach's Observation */}
        <View
          style={[
            styles.observationCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <View style={styles.observationHeader}>
            <View
              style={[
                styles.observationIcon,
                { backgroundColor: colors.primary + "1A" },
              ]}
            >
              <Feather name="map-pin" size={14} color={colors.primary} />
            </View>
            <Text
              style={[
                styles.observationTitle,
                {
                  color: colors.foreground,
                  fontFamily: "Inter_700Bold",
                },
              ]}
            >
              Coach's Observation
            </Text>
          </View>
          <Text
            style={[
              styles.observationBody,
              {
                color: colors.foreground,
                fontFamily: "Inter_400Regular",
              },
            ]}
          >
            {observation}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Adopt this rhythm"
            onPress={handleAdoptRhythm}
            style={({ pressed }) => [
              styles.observationCta,
              {
                borderColor: adopted ? colors.primary : colors.border,
                backgroundColor: adopted ? colors.primary + "14" : "transparent",
                borderRadius: colors.radius,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Feather
              name={adopted ? "check-circle" : "compass"}
              size={14}
              color={adopted ? colors.primary : colors.foreground}
            />
            <Text
              style={[
                styles.observationCtaText,
                {
                  color: adopted ? colors.primary : colors.foreground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              {adopted ? "Rhythm adopted — daily plans will favor these windows" : "Adopt This Rhythm"}
            </Text>
          </Pressable>
        </View>

        {/* Habit Consistency */}
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <Text
            style={[
              styles.cardTitle,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            Habit Consistency (Last 14 Days)
          </Text>
          <BarChart
            data={bars14}
            height={130}
            startLabel={barsStartLabel}
            endLabel="Today"
          />
        </View>
      </ScrollView>
    </View>
  );
}

function StatCard({
  icon,
  label,
  value,
  delta,
  deltaSuffix,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
  delta: number;
  deltaSuffix: string;
}) {
  const colors = useColors();
  const positive = delta >= 0;
  return (
    <View
      style={[
        statStyles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <View style={statStyles.headerRow}>
        <Feather name={icon} size={12} color={colors.primary} />
        <Text
          style={[
            statStyles.label,
            { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
          ]}
        >
          {label}
        </Text>
      </View>
      <Text
        style={[
          statStyles.value,
          { color: colors.foreground, fontFamily: "Inter_700Bold" },
        ]}
      >
        {value}
      </Text>
      <Text
        style={[
          statStyles.delta,
          {
            color: positive ? colors.primary : colors.destructive,
            fontFamily: "Inter_600SemiBold",
          },
        ]}
      >
        {positive ? "+" : ""}
        {delta}
        {deltaSuffix}
      </Text>
    </View>
  );
}

function SubStat({ label, value }: { label: string; value: string }) {
  const colors = useColors();
  return (
    <View style={{ flex: 1, alignItems: "center", gap: 2 }}>
      <Text
        style={[
          subStatStyles.label,
          { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
        ]}
      >
        {label}
      </Text>
      <Text
        style={[
          subStatStyles.value,
          { color: colors.foreground, fontFamily: "Inter_700Bold" },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 22,
    gap: 18,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 4,
  },
  headerTitle: {
    fontSize: 26,
    letterSpacing: -0.5,
    lineHeight: 30,
  },
  headerSubtitle: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  statRow: {
    flexDirection: "row",
    gap: 12,
  },
  card: {
    borderWidth: 1,
    padding: 18,
    gap: 14,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 11.5,
    letterSpacing: 0.2,
  },
  weeklyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  weeklyChipText: {
    fontSize: 11.5,
  },
  subStatRow: {
    flexDirection: "row",
    paddingTop: 12,
    borderTopWidth: 1,
  },
  subStatDivider: {
    width: 1,
    marginHorizontal: 8,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    letterSpacing: -0.2,
  },
  sectionLink: {
    fontSize: 12,
  },
  peakList: {
    gap: 10,
  },
  peakRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderWidth: 1,
  },
  peakTimeChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  peakTimeText: {
    fontSize: 13,
    letterSpacing: -0.2,
  },
  peakTitle: {
    fontSize: 14.5,
  },
  peakDesc: {
    fontSize: 12,
    lineHeight: 17,
  },
  peakScore: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
  observationCard: {
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  observationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  observationIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  observationTitle: {
    fontSize: 14.5,
  },
  observationBody: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  observationCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  observationCtaText: {
    fontSize: 13.5,
    letterSpacing: 0.2,
  },
});

const statStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  label: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  value: {
    fontSize: 24,
    letterSpacing: -0.6,
  },
  delta: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
});

const subStatStyles = StyleSheet.create({
  label: {
    fontSize: 11,
    letterSpacing: 0.3,
  },
  value: {
    fontSize: 14.5,
    letterSpacing: -0.2,
  },
});
