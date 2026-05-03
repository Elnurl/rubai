import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";

import { AtlasButton } from "@/components/AtlasButton";
import { AskCoachPill } from "@/components/AskCoachPill";
import { EmptyState } from "@/components/EmptyState";
import { GoalListItem } from "@/components/GoalListItem";
import { SectionHeader } from "@/components/SectionHeader";
import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";
import { TIER_INFO } from "@/types/atlas";

export default function GoalsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 8;
  const bottomTab = isWeb ? 100 : 110;

  const {
    goals,
    activeGoalId,
    setActiveGoal,
    removeGoal,
    canAddMoreGoals,
    goalLimit,
    subscription,
  } = useAtlas();

  const onAdd = () => {
    if (!canAddMoreGoals) {
      // Route to the replace flow rather than a dead-end alert — this keeps
      // the user moving forward (pick a goal to swap out) instead of just
      // telling them they can't proceed.
      router.push("/replace-goal");
      return;
    }
    router.push("/new-goal");
  };

  const onDelete = (goalId: string, label: string) => {
    const doDelete = () => void removeGoal(goalId);
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(`Delete "${label}" and all its progress?`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        "Delete this goal?",
        `"${label}" and all of its roadmap, history, and progress will be removed.`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: doDelete },
        ],
      );
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
        <View style={styles.headerRow}>
          <AskCoachPill />
        </View>

        <SectionHeader
          eyebrow="GOALS"
          title="Your active goals"
          subtitle={`${goals.length} of ${goalLimit} on the ${TIER_INFO[subscription.tier].label} plan`}
        />

        {goals.length === 0 ? (
          <EmptyState
            icon="plus-circle"
            title="No goals yet"
            description="Add your first goal to start building a roadmap."
            action={
              <AtlasButton
                label="Add a goal"
                onPress={onAdd}
                icon={
                  <Feather name="plus" size={16} color={colors.primaryForeground} />
                }
              />
            }
          />
        ) : (
          <View style={styles.list}>
            {goals.map((g, i) => (
              <GoalListItem
                key={g.id}
                index={i}
                goal={g}
                isActive={g.id === activeGoalId}
                weekProgress={
                  g.roadmap
                    ? { current: 1, total: g.roadmap.totalWeeks }
                    : undefined
                }
                onPress={() => {
                  // Switch to the tapped goal (no-op if already active) and
                  // jump straight to its roadmap so the user lands on the
                  // page they expected when tapping a goal card.
                  void (async () => {
                    if (g.id !== activeGoalId) {
                      try {
                        await setActiveGoal(g.id);
                      } catch {
                        // setActiveGoal preserves the previous active goal
                        // on failure; still navigate so the user sees that
                        // goal's roadmap (it's persisted independently).
                      }
                    }
                    router.navigate("/roadmap");
                  })();
                }}
                onDelete={() =>
                  onDelete(
                    g.id,
                    g.profile.customGoalTitle?.trim() || g.profile.goalStatement,
                  )
                }
              />
            ))}
          </View>
        )}

        {goals.length > 0 && (
          <Pressable
            onPress={onAdd}
            style={({ pressed }) => [
              styles.addBtn,
              {
                borderColor: colors.primary,
                borderRadius: colors.radius,
                opacity: pressed ? 0.85 : 1,
                backgroundColor: colors.primary + "0F",
              },
            ]}
          >
            <Feather
              name={canAddMoreGoals ? "plus-circle" : "refresh-ccw"}
              size={18}
              color={colors.primary}
            />
            <Text
              style={[
                styles.addBtnText,
                {
                  color: colors.primary,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              {canAddMoreGoals ? "Add another goal" : "Replace a goal"}
            </Text>
          </Pressable>
        )}

        {!canAddMoreGoals && goals.length > 0 && (
          <Pressable
            onPress={() => router.navigate("/plans")}
            style={({ pressed }) => [
              styles.upgradeRow,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Feather name="arrow-up-right" size={16} color={colors.accent} />
            <Text
              style={[
                styles.upgradeText,
                { color: colors.foreground, fontFamily: "Inter_500Medium" },
              ]}
            >
              Upgrade your plan to run more goals in parallel
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 22,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
    paddingBottom: 4,
  },
  list: {
    gap: 10,
    marginTop: 4,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 16,
    borderWidth: 1.5,
    borderStyle: "dashed",
    marginTop: 6,
  },
  addBtnText: {
    fontSize: 14,
    letterSpacing: 0.2,
  },
  upgradeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderWidth: 1,
  },
  upgradeText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 19,
  },
});
