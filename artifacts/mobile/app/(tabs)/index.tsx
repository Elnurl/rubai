import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
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

import { ActiveGoalChip } from "@/components/ActiveGoalChip";
import { AtlasButton } from "@/components/AtlasButton";
import { AtlasLogo } from "@/components/AtlasLogo";
import { EmptyState } from "@/components/EmptyState";
import { ReflectionSheet } from "@/components/ReflectionSheet";
import { SectionHeader } from "@/components/SectionHeader";
import { TaskCard } from "@/components/TaskCard";
import { profileGoalLabel } from "@/constants/atlas";
import { useColors } from "@/hooks/useColors";
import { useEvolveRoadmap } from "@/hooks/useEvolveRoadmap";
import { todayISO } from "@/lib/storage";
import { useAtlas } from "@/providers/AtlasProvider";
import {
  useAtlasBehavioralProfile,
  useAtlasGenerateDailyPlan,
  type DailyTask,
  type ReflectionEntry,
} from "@workspace/api-client-react";

export default function TodayScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 8;
  const bottomTab = isWeb ? 100 : 110;

  const {
    activeGoalId,
    activeProfile,
    activeRoadmap,
    activeDailyPlan,
    activeBehavioral,
    activeBehavioralProfile,
    activeCurrentWeek,
    activeTaskHistory,
    activeReflections,
    setActiveDailyPlan,
    recordActiveTask,
    recordActiveReflection,
    setActiveBehavioralProfile,
  } = useAtlas();

  const generate = useAtlasGenerateDailyPlan();
  const refreshProfile = useAtlasBehavioralProfile();
  // Mount the hook so its self-driving effect runs while Today is open and
  // can auto-evolve the roadmap right after a reflection updates state.
  useEvolveRoadmap();
  const today = todayISO();
  const requestedRef = useRef<string | null>(null);

  const [reflectTarget, setReflectTarget] = useState<{
    task: DailyTask;
    completed: boolean;
  } | null>(null);

  const planIsForToday = activeDailyPlan && activeDailyPlan.plan.date === today;

  // Reset request guard when active goal changes so each goal regenerates today.
  useEffect(() => {
    requestedRef.current = null;
  }, [activeGoalId]);

  useEffect(() => {
    if (!activeProfile || !activeRoadmap) return;
    if (planIsForToday) return;
    const key = `${activeGoalId}:${today}`;
    if (requestedRef.current === key) return;
    requestedRef.current = key;
    generate
      .mutateAsync({
        data: {
          profile: activeProfile,
          roadmap: activeRoadmap,
          behavioral: activeBehavioral,
          date: today,
          currentWeek: activeCurrentWeek,
          ...(activeBehavioralProfile
            ? { learnedProfile: activeBehavioralProfile }
            : {}),
        },
      })
      .then((plan) => {
        void setActiveDailyPlan(plan);
      })
      .catch(() => {
        requestedRef.current = null;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGoalId, activeProfile, activeRoadmap, planIsForToday, today, activeCurrentWeek]);

  const refresh = async () => {
    if (!activeProfile || !activeRoadmap) return;
    requestedRef.current = `${activeGoalId}:${today}`;
    try {
      const plan = await generate.mutateAsync({
        data: {
          profile: activeProfile,
          roadmap: activeRoadmap,
          behavioral: activeBehavioral,
          date: today,
          currentWeek: activeCurrentWeek,
          ...(activeBehavioralProfile
            ? { learnedProfile: activeBehavioralProfile }
            : {}),
        },
      });
      await setActiveDailyPlan(plan);
    } catch {
      requestedRef.current = null;
    }
  };

  const todaysCompletions = useMemo(() => {
    const map = new Map<string, boolean>();
    for (const e of activeTaskHistory) {
      if (e.date === today) map.set(e.taskId, e.completed);
    }
    return map;
  }, [activeTaskHistory, today]);

  const completedCount = useMemo(() => {
    if (!activeDailyPlan) return 0;
    return activeDailyPlan.plan.tasks.filter((t) => todaysCompletions.get(t.id)).length;
  }, [activeDailyPlan, todaysCompletions]);

  const totalCount = activeDailyPlan?.plan.tasks.length ?? 0;
  const progressPct = totalCount > 0 ? completedCount / totalCount : 0;
  const goalLabel = activeProfile ? profileGoalLabel(activeProfile) : "";

  const todaysReflectionMap = useMemo(() => {
    const map = new Map<string, ReflectionEntry>();
    for (const r of activeReflections) {
      if (r.date === today) map.set(r.taskId, r);
    }
    return map;
  }, [activeReflections, today]);

  const handleSubmitReflection = async (entry: ReflectionEntry) => {
    await recordActiveReflection(entry);
    if (!activeProfile) return;
    const recent = activeTaskHistory.slice(-60).map((e) => ({
      taskId: e.taskId,
      taskTitle: e.taskTitle,
      date: e.date,
      completed: e.completed,
    }));
    // Include the just-submitted reflection explicitly so the request never
    // misses it due to closure timing on the activeReflections state update.
    const reflectionsForProfile = [
      ...activeReflections.filter(
        (r) => !(r.taskId === entry.taskId && r.date === entry.date),
      ),
      entry,
    ].slice(-20);
    refreshProfile
      .mutateAsync({
        data: {
          profile: activeProfile,
          recentHistory: recent,
          reflections: reflectionsForProfile,
          ...(activeBehavioralProfile
            ? { previous: activeBehavioralProfile }
            : {}),
        },
      })
      .then(async (res) => {
        await setActiveBehavioralProfile(res.profile);
        // Auto-evolution is fired by useEvolveRoadmap's self-driving effect
        // once the new profile + reflection have flushed into context, so we
        // don't call it inline here (avoids stale-closure misses).
      })
      .catch(() => {
        // Silent — background refresh; user keeps the app running.
      });
  };

  const heroDate = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  if (!activeProfile) {
    return (
      <View
        style={[
          styles.root,
          { backgroundColor: colors.background, paddingTop: topPad },
        ]}
      >
        <EmptyState
          icon="sun"
          title="No active goal"
          description="Add a goal in the Goals tab to see today's plan."
        />
      </View>
    );
  }

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
          <View style={styles.headerRight}>
            <ActiveGoalChip />
            <View style={[styles.streakChip, { backgroundColor: colors.muted }]}>
              <Feather name="zap" size={12} color={colors.accent} />
              <Text
                style={[
                  styles.streakText,
                  { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {activeBehavioral.currentStreakDays}d
              </Text>
            </View>
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
            title={activeDailyPlan?.plan.focusOfTheDay ?? "Today's plan is loading"}
            subtitle={goalLabel ? `Week ${activeCurrentWeek} • ${goalLabel}` : undefined}
          />
        </View>

        {activeDailyPlan?.plan.coachNote && (
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
              {activeDailyPlan.plan.coachNote}
            </Text>
          </Animated.View>
        )}

        {totalCount > 0 && (
          <View style={styles.progress}>
            <View
              style={[styles.progressTrack, { backgroundColor: colors.muted }]}
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
                rubai is preparing today's tasks
              </Text>
            </View>
          ) : activeDailyPlan ? (
            activeDailyPlan.plan.tasks.map((task, i) => {
              const isCompleted = todaysCompletions.get(task.id) === true;
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  completed={isCompleted}
                  index={i}
                  hasReflection={todaysReflectionMap.has(task.id)}
                  onReflect={() =>
                    setReflectTarget({ task, completed: isCompleted })
                  }
                  onToggle={() => {
                    recordActiveTask({
                      taskId: task.id,
                      taskTitle: task.title,
                      date: today,
                      completed: !isCompleted,
                    });
                  }}
                />
              );
            })
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

      {reflectTarget && (
        <ReflectionSheet
          visible={true}
          taskId={reflectTarget.task.id}
          taskTitle={reflectTarget.task.title}
          date={today}
          completed={reflectTarget.completed}
          initialReasonTag={
            todaysReflectionMap.get(reflectTarget.task.id)?.reasonTag
          }
          initialNote={todaysReflectionMap.get(reflectTarget.task.id)?.note}
          onClose={() => setReflectTarget(null)}
          onSubmit={handleSubmitReflection}
        />
      )}
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
    gap: 8,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  streakChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
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
