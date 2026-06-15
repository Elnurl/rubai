import { Feather } from "@expo/vector-icons";
import { useUser } from "@clerk/expo";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AskCoachPill } from "@/components/AskCoachPill";
import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";
import { TIER_INFO, type SubscriptionTier } from "@/types/atlas";
import type { TaskHistoryEntry } from "@/lib/storage";

const APP_VERSION = "rubai · v1.0 · designed for execution";

function computeBestStreak(history: TaskHistoryEntry[]): number {
  const daySet = new Set(history.filter((h) => h.completed).map((h) => h.date));
  const sorted = [...daySet].sort();
  if (sorted.length === 0) return 0;
  let best = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + "T00:00:00");
    const curr = new Date(sorted[i] + "T00:00:00");
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    cur = diff === 1 ? cur + 1 : 1;
    best = Math.max(best, cur);
  }
  return best;
}

export default function AccountScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 8;
  const bottomTab = isWeb ? 84 : 90;

  const {
    tier,
    goals,
    activeBehavioral,
    activeGoal,
    activeTaskHistory,
    activeCurrentWeek,
    syncStatus,
    syncMessage,
    dismissSyncMessage,
  } = useAtlas();
  const { user } = useUser();

  const tierKey =
    (tier as SubscriptionTier) in TIER_INFO ? (tier as SubscriptionTier) : "free";

  const accountEmail = user?.primaryEmailAddress?.emailAddress ?? "Signed in";
  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username ||
    accountEmail.split("@")[0] ||
    "Your account";
  const initials =
    (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "") ||
    fullName.slice(0, 2);
  const avatarUrl = user?.imageUrl ?? null;

  const activeGoalCount = useMemo(
    () => goals.filter((g) => g.roadmap !== null).length,
    [goals],
  );
  const currentStreak = activeBehavioral.currentStreakDays;
  const bestStreak = useMemo(
    () => computeBestStreak(activeTaskHistory),
    [activeTaskHistory],
  );
  const tasksDone = useMemo(
    () => activeTaskHistory.filter((h) => h.completed).length,
    [activeTaskHistory],
  );

  const goalTitle = activeGoal
    ? (activeGoal.profile.customGoalTitle ??
        activeGoal.profile.goalType
          .split("_")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "))
    : null;

  const phases = activeGoal?.roadmap?.phases;
  const totalWeeks =
    activeGoal?.profile?.targetTimelineWeeks ??
    (phases && phases.length > 0 ? phases[phases.length - 1].endWeek : 12);
  const progress = Math.min(activeCurrentWeek / Math.max(totalWeeks, 1), 1);

  const tierBadgeColor =
    tierKey === "premium"
      ? "#F59E0B"
      : tierKey === "pro"
        ? "#10B981"
        : colors.mutedForeground;
  const tierBadgeText =
    tierKey === "premium" ? "PREMIUM" : tierKey === "pro" ? "PRO MEMBER" : "FREE";

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
          <View style={styles.headerSpacer} />
        </View>

        {syncMessage ? (
          <Pressable
            onPress={dismissSyncMessage}
            style={[
              styles.syncBanner,
              {
                backgroundColor:
                  syncStatus === "error"
                    ? colors.destructive + "14"
                    : colors.primary + "14",
                borderColor:
                  syncStatus === "error" ? colors.destructive : colors.primary,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather
              name={syncStatus === "error" ? "alert-circle" : "cloud"}
              size={14}
              color={syncStatus === "error" ? colors.destructive : colors.primary}
            />
            <Text
              style={[
                styles.syncBannerText,
                {
                  color:
                    syncStatus === "error" ? colors.destructive : colors.primary,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              {syncMessage}
            </Text>
          </Pressable>
        ) : null}

        {/* ── Profile card ── */}
        <Pressable
          onPress={() => router.push("/account/profile")}
          android_ripple={{ color: colors.muted }}
          style={({ pressed }) => [
            styles.profileCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
        >
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={styles.profileAvatar} />
          ) : (
            <View
              style={[
                styles.profileAvatar,
                {
                  backgroundColor: colors.primary,
                  alignItems: "center",
                  justifyContent: "center",
                },
              ]}
            >
              <Text
                style={{
                  color: colors.primaryForeground,
                  fontFamily: "Inter_700Bold",
                  fontSize: 20,
                  textTransform: "uppercase",
                }}
              >
                {initials.slice(0, 2)}
              </Text>
            </View>
          )}

          <View style={{ flex: 1, gap: 2 }}>
            <Text
              numberOfLines={1}
              style={{
                color: colors.foreground,
                fontFamily: "Inter_700Bold",
                fontSize: 16,
                letterSpacing: -0.3,
              }}
            >
              {fullName}
            </Text>
            <Text
              numberOfLines={1}
              style={{
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: 12,
              }}
            >
              {accountEmail}
            </Text>
            <View
              style={[
                styles.tierBadge,
                {
                  backgroundColor: tierBadgeColor + "1A",
                  borderColor: tierBadgeColor + "55",
                },
              ]}
            >
              <Text
                style={{
                  color: tierBadgeColor,
                  fontFamily: "Inter_700Bold",
                  fontSize: 9.5,
                  letterSpacing: 1.1,
                }}
              >
                {tierBadgeText}
              </Text>
            </View>
          </View>

          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </Pressable>

        {/* ── Active goal card ── */}
        {activeGoal && goalTitle ? (
          <>
            <SectionLabel>ACTIVE GOAL</SectionLabel>
            <View
              style={[
                styles.goalCard,
                {
                  backgroundColor: colors.primary + "0D",
                  borderColor: colors.primary + "30",
                  borderRadius: colors.radius,
                },
              ]}
            >
              <View style={styles.goalTitleRow}>
                <View
                  style={[
                    styles.goalIconBubble,
                    { backgroundColor: colors.primary + "20" },
                  ]}
                >
                  <Feather name="target" size={14} color={colors.primary} />
                </View>
                <Text
                  numberOfLines={2}
                  style={{
                    flex: 1,
                    color: colors.foreground,
                    fontFamily: "Inter_700Bold",
                    fontSize: 14.5,
                    letterSpacing: -0.2,
                  }}
                >
                  {goalTitle}
                </Text>
              </View>

              <View style={styles.progressLabelRow}>
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 11.5,
                  }}
                >
                  Week {activeCurrentWeek} of {totalWeeks}
                </Text>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                    fontSize: 11,
                  }}
                >
                  {Math.round(progress * 100)}%
                </Text>
              </View>

              <View
                style={{
                  height: 4,
                  borderRadius: 2,
                  overflow: "hidden",
                  backgroundColor: colors.primary + "20",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    borderRadius: 2,
                    backgroundColor: colors.primary,
                    width: `${Math.round(progress * 100)}%`,
                  }}
                />
              </View>
            </View>
          </>
        ) : null}

        {/* ── Stats & Streaks ── */}
        <SectionLabel>STATS & STREAKS</SectionLabel>
        <View style={styles.statsGrid}>
          <StatBlock
            label="Current Streak"
            value={`${currentStreak}d`}
            icon="zap"
            colors={colors}
          />
          <StatBlock
            label="Best Streak"
            value={`${bestStreak}d`}
            icon="award"
            colors={colors}
          />
          <StatBlock
            label="Tasks Done"
            value={String(tasksDone)}
            icon="check-circle"
            colors={colors}
          />
          <StatBlock
            label="Goals Active"
            value={String(activeGoalCount)}
            icon="flag"
            colors={colors}
          />
        </View>

        <Text
          style={{
            color: colors.mutedForeground,
            fontFamily: "Inter_400Regular",
            fontSize: 11.5,
            textAlign: "center",
            paddingTop: 14,
            paddingBottom: 4,
            letterSpacing: 0.2,
          }}
        >
          {APP_VERSION}
        </Text>
      </ScrollView>
    </View>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return (
    <Text
      style={{
        color: colors.primary,
        fontFamily: "Inter_600SemiBold",
        fontSize: 11,
        letterSpacing: 1.8,
        paddingHorizontal: 4,
        marginTop: 4,
      }}
    >
      {children}
    </Text>
  );
}

function StatBlock({
  label,
  value,
  icon,
  colors,
}: {
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={[
        styles.statBlock,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <View
        style={[styles.statIconBubble, { backgroundColor: colors.primary + "14" }]}
      >
        <Feather name={icon} size={13} color={colors.primary} />
      </View>
      <Text
        style={{
          color: colors.foreground,
          fontFamily: "Inter_700Bold",
          fontSize: 22,
          letterSpacing: -0.5,
          marginTop: 8,
        }}
      >
        {value}
      </Text>
      <Text
        style={{
          color: colors.mutedForeground,
          fontFamily: "Inter_400Regular",
          fontSize: 11,
          marginTop: 2,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 16,
    gap: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 4,
  },
  headerSpacer: { flex: 1 },
  syncBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
  },
  syncBannerText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
  },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderWidth: 1,
  },
  profileAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  tierBadge: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginTop: 3,
  },
  goalCard: {
    padding: 14,
    borderWidth: 1,
    gap: 10,
  },
  goalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  goalIconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  progressLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statBlock: {
    flex: 1,
    minWidth: "44%",
    borderWidth: 1,
    padding: 14,
  },
  statIconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
});
