import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AtlasButton } from "@/components/AtlasButton";
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
      const message = `You're at your ${TIER_INFO[subscription.tier].label} plan limit of ${goalLimit} active goal${goalLimit === 1 ? "" : "s"}. Upgrade in Account or remove a goal first.`;
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") window.alert(message);
      } else {
        Alert.alert("Plan limit reached", message, [
          { text: "OK" },
          { text: "Open Account", onPress: () => router.navigate("/account") },
        ]);
      }
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
            {goals.map((g) => (
              <GoalListItem
                key={g.id}
                goal={g}
                isActive={g.id === activeGoalId}
                weekProgress={
                  g.roadmap
                    ? { current: 1, total: g.roadmap.totalWeeks }
                    : undefined
                }
                onPress={() => {
                  if (g.id !== activeGoalId) void setActiveGoal(g.id);
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
                borderColor: canAddMoreGoals ? colors.primary : colors.border,
                borderRadius: colors.radius,
                opacity: pressed ? 0.85 : 1,
                backgroundColor: canAddMoreGoals ? colors.primary + "0F" : colors.card,
              },
            ]}
          >
            <Feather
              name={canAddMoreGoals ? "plus-circle" : "lock"}
              size={18}
              color={canAddMoreGoals ? colors.primary : colors.mutedForeground}
            />
            <Text
              style={[
                styles.addBtnText,
                {
                  color: canAddMoreGoals ? colors.primary : colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              {canAddMoreGoals
                ? "Add another goal"
                : `Plan limit reached (${goalLimit})`}
            </Text>
          </Pressable>
        )}

        {!canAddMoreGoals && goals.length > 0 && (
          <Pressable
            onPress={() => router.navigate("/account")}
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
