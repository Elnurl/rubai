import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AtlasButton } from "@/components/AtlasButton";
import { AtlasLogo } from "@/components/AtlasLogo";
import { EmptyState } from "@/components/EmptyState";
import { SectionHeader } from "@/components/SectionHeader";
import { TaskCard } from "@/components/TaskCard";
import { GOAL_META } from "@/constants/atlas";
import { useColors } from "@/hooks/useColors";
import { todayISO } from "@/lib/storage";
import { useAtlas } from "@/providers/AtlasProvider";
import { useAtlasGenerateDailyPlan } from "@workspace/api-client-react";

export default function TodayScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 8;
  const bottomTab = isWeb ? 100 : 110;

  const {
    profile,
    roadmap,
    dailyPlan,
    behavioral,
    currentWeek,
    setDailyPlan,
    recordTask,
    taskHistory,
  } = useAtlas();

  const generate = useAtlasGenerateDailyPlan();
  const today = todayISO();
  const requestedRef = useRef<string | null>(null);

  const planIsForToday =
    dailyPlan && dailyPlan.plan.date === today;

  useEffect(() => {
    if (!profile || !roadmap) return;
    if (planIsForToday) return;
    if (requestedRef.current === today) return;
    requestedRef.current = today;
    generate
      .mutateAsync({
        data: {
          profile,
          roadmap,
          behavioral,
          date: today,
          currentWeek,
        },
      })
      .then((plan) => {
        setDailyPlan(plan);
      })
      .catch(() => {
        requestedRef.current = null;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, roadmap, planIsForToday, today, currentWeek]);

  const refresh = async () => {
    if (!profile || !roadmap) return;
    requestedRef.current = today;
    try {
      const plan = await generate.mutateAsync({
        data: {
          profile,
          roadmap,
          behavioral,
          date: today,
          currentWeek,
        },
      });
      await setDailyPlan(plan);
    } catch {
      requestedRef.current = null;
    }
  };

  const todaysCompletions = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const e of taskHistory) {
      if (e.date === today) map.set(e.taskId, e.completed);
    }
    return map;
  }, [taskHistory, today]);

  const completedCount = useMemo(() => {
    if (!dailyPlan) return 0;
    return dailyPlan.plan.tasks.filter((t) => todaysCompletions.get(t.id)).length;
  }, [dailyPlan, todaysCompletions]);

  const totalCount = dailyPlan?.plan.tasks.length ?? 0;
  const progressPct = totalCount > 0 ? completedCount / totalCount : 0;
  const goalLabel = profile ? GOAL_META[profile.goalType].label : "";

  const heroDate = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad, paddingBottom: bottomTab },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={generate.isPending && Boolean(planIsForToday)}
            onRefresh={refresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <AtlasLogo size="sm" />
          <View style={[styles.streakChip, { backgroundColor: colors.muted }]}>
            <Feather name="zap" size={12} color={colors.accent} />
            <Text
              style={[
                styles.streakText,
                { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              {behavioral.currentStreakDays} day streak
            </Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text
            style={[
              styles.dateLabel,
              { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
            ]}
          >
            {heroDate.toUpperCase()}
          </Text>
          <SectionHeader
            title={dailyPlan?.plan.focusOfTheDay ?? "Today's plan is loading"}
            subtitle={goalLabel ? `Week ${currentWeek} • ${goalLabel}` : undefined}
          />
        </View>

        {dailyPlan?.plan.coachNote && (
          <Animated.View
            entering={FadeIn.duration(400)}
            style={[
              styles.coachNote,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <View
              style={[styles.coachAvatar, { backgroundColor: colors.primary }]}
            >
              <Text
                style={[
                  styles.coachAvatarText,
                  { color: colors.primaryForeground, fontFamily: "Inter_700Bold" },
                ]}
              >
                A
              </Text>
            </View>
            <Text
              style={[
                styles.coachNoteText,
                { color: colors.foreground, fontFamily: "Inter_400Regular" },
              ]}
            >
              {dailyPlan.plan.coachNote}
            </Text>
          </Animated.View>
        )}

        {totalCount > 0 && (
          <View style={styles.progress}>
            <View
              style={[
                styles.progressTrack,
                { backgroundColor: colors.muted },
              ]}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${Math.round(progressPct * 100)}%`,
                    backgroundColor: colors.primary,
                  },
                ]}
              />
            </View>
            <Text
              style={[
                styles.progressText,
                { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
              ]}
            >
              {completedCount} of {totalCount} done
            </Text>
          </View>
        )}

        <View style={styles.taskList}>
          {generate.isPending && !planIsForToday ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
              <Text
                style={[
                  styles.loadingText,
                  { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
                ]}
              >
                Atlas is preparing today's tasks
              </Text>
            </View>
          ) : dailyPlan ? (
            dailyPlan.plan.tasks.map((task, i) => (
              <TaskCard
                key={task.id}
                task={task}
                completed={todaysCompletions.get(task.id) === true}
                index={i}
                onToggle={() => {
                  const wasCompleted = todaysCompletions.get(task.id) === true;
                  recordTask({
                    taskId: task.id,
                    taskTitle: task.title,
                    date: today,
                    completed: !wasCompleted,
                  });
                }}
              />
            ))
          ) : (
            <EmptyState
              icon="cloud-off"
              title="We couldn't reach the planner"
              description="Pull down to refresh and we'll generate today's plan."
              action={
                <AtlasButton
                  label="Try again"
                  variant="secondary"
                  onPress={refresh}
                  icon={
                    <Feather
                      name="refresh-cw"
                      size={16}
                      color={colors.foreground}
                    />
                  }
                />
              }
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 22,
    gap: 22,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  streakChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  streakText: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
  hero: {
    gap: 8,
  },
  dateLabel: {
    fontSize: 11,
    letterSpacing: 1.4,
  },
  coachNote: {
    flexDirection: "row",
    gap: 12,
    padding: 16,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  coachAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  coachAvatarText: {
    fontSize: 14,
  },
  coachNoteText: {
    flex: 1,
    fontSize: 14.5,
    lineHeight: 21,
  },
  progress: {
    gap: 6,
  },
  progressTrack: {
    width: "100%",
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
  taskList: {
    gap: 12,
  },
  loading: {
    paddingVertical: 32,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 13,
  },
});
