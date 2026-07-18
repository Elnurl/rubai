import { Feather } from "@expo/vector-icons";
import { useUser } from "@/providers/AuthProvider";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { getBaseUrl } from "@workspace/api-client-react";

import { AskCoachPill } from "@/components/AskCoachPill";
import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";
import { TIER_INFO, type SubscriptionTier } from "@/types/atlas";
import type { TaskHistoryEntry } from "@/lib/storage";
import i18n from "@/lib/i18n";

const APP_VERSION = i18n.t("accountTab.appVersion", "rubai · v1.0 · designed for execution");

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
  const { t } = useTranslation();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 8;
  const bottomTab = isWeb ? 84 : 90;

  const {
    tier,
    goals,
    account,
    updateAccount,
    signOut,
    activeBehavioral,
    activeGoal,
    activeCurrentWeek,
    syncStatus,
    syncMessage,
    dismissSyncMessage,
  } = useAtlas();

  const cloudApiLabel = getBaseUrl() || "(no API URL baked into this APK)";

  const systemScheme = useColorScheme();
  const effectiveScheme =
    account.themeOverride === "system"
      ? (systemScheme ?? "light")
      : account.themeOverride;
  const isDark = effectiveScheme === "dark";

  const onSignOut = () => {
    const doSignOut = async () => { await signOut(); };
    if (Platform.OS === "web") {
      if (typeof window !== "undefined" && window.confirm(t("accountTab.signOutConfirmWeb", "Sign out of rubai?")))
        void doSignOut();
    } else {
      Alert.alert(t("accountTab.signOutTitle", "Sign out?"), t("accountTab.signOutBody", "You can sign back in any time."), [
        { text: t("accountTab.cancel", "Cancel"), style: "cancel" },
        { text: t("accountTab.signOut", "Sign out"), style: "destructive", onPress: doSignOut },
      ]);
    }
  };

  const openSubscriptionManagement = () => {
    if (Platform.OS === "ios") {
      void Linking.openURL("itms-apps://apps.apple.com/account/subscriptions");
    } else if (Platform.OS === "android") {
      void Linking.openURL("https://play.google.com/store/account/subscriptions");
    } else {
      void Linking.openURL("https://apps.apple.com/account/subscriptions");
    }
  };
  const { user } = useUser();

  const tierKey =
    (tier as SubscriptionTier) in TIER_INFO ? (tier as SubscriptionTier) : "free";

  const accountEmail = user?.primaryEmailAddress?.emailAddress ?? t("accountTab.signedIn", "Signed in");
  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.username ||
    accountEmail.split("@")[0] ||
    t("accountTab.yourAccount", "Your account");
  const initials =
    (user?.firstName?.[0] ?? "") + (user?.lastName?.[0] ?? "") ||
    fullName.slice(0, 2);
  const avatarUrl = user?.imageUrl ?? null;

  const allTaskHistory = useMemo(
    () => goals.flatMap((g) => g.taskHistory ?? []),
    [goals],
  );

  const activeGoalCount = useMemo(
    () => goals.filter((g) => g.roadmap !== null).length,
    [goals],
  );
  const currentStreak = activeBehavioral.currentStreakDays;
  const bestStreak = useMemo(
    () => computeBestStreak(allTaskHistory),
    [allTaskHistory],
  );
  const tasksDone = useMemo(
    () => allTaskHistory.filter((h) => h.completed).length,
    [allTaskHistory],
  );

  const [goalBreakdownExpanded, setGoalBreakdownExpanded] = useState(false);

  const perGoalStats = useMemo(
    () =>
      goals.map((g) => {
        const title =
          g.profile.customGoalTitle ??
          g.profile.goalType
            .split("_")
            .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
        const history = g.taskHistory ?? [];
        const done = history.filter((h) => h.completed).length;
        const streak = computeBestStreak(history);
        const hasRoadmap = g.roadmap !== null;
        return { id: g.id, title, done, streak, hasRoadmap };
      }),
    [goals],
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
    tierKey === "premium" ? t("accountTab.tierPremium", "PREMIUM") : tierKey === "pro" ? t("accountTab.tierProMember", "PRO MEMBER") : t("accountTab.tierFree", "FREE");

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
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={[
                  styles.syncBannerText,
                  {
                    color:
                      syncStatus === "error"
                        ? colors.destructive
                        : colors.primary,
                    fontFamily: "Inter_500Medium",
                  },
                ]}
              >
                {syncMessage}
              </Text>
              {syncStatus === "error" ? (
                <Text
                  style={[
                    styles.syncBannerText,
                    {
                      color: colors.destructive,
                      fontFamily: "Inter_400Regular",
                      fontSize: 11,
                      opacity: 0.85,
                    },
                  ]}
                  numberOfLines={2}
                >
                  {`API: ${cloudApiLabel}`}
                </Text>
              ) : null}
            </View>
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
            <View style={styles.sectionLabelRow}>
              <SectionLabel>{t("accountTab.activeGoalLabel", "ACTIVE GOAL")}</SectionLabel>
              <Pressable
                onPress={() => router.push("/account/goals" as never)}
                hitSlop={8}
              >
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: "Inter_500Medium",
                    fontSize: 12,
                    letterSpacing: 0.2,
                  }}
                >
                  {goals.length > 1 ? t("accountTab.switchGoal", "Switch goal") : t("accountTab.seeAll", "See all")}
                </Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => router.push("/account/goals" as never)}
              android_ripple={{ color: colors.primary + "14" }}
              style={({ pressed }) => [
                styles.goalCard,
                {
                  backgroundColor: colors.primary + "0D",
                  borderColor: colors.primary + "30",
                  borderRadius: colors.radius,
                  opacity: pressed ? 0.9 : 1,
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
                <Feather
                  name="chevron-right"
                  size={16}
                  color={colors.primary + "80"}
                />
              </View>

              <View style={styles.progressLabelRow}>
                <Text
                  style={{
                    color: colors.primary,
                    fontFamily: "Inter_600SemiBold",
                    fontSize: 11.5,
                  }}
                >
                  {t("accountTab.weekOf", "Week {{currentWeek}} of {{totalWeeks}}", { currentWeek: activeCurrentWeek, totalWeeks })}
                </Text>
                <Text
                  style={{
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                    fontSize: 11,
                  }}
                >
                  {t("accountTab.percent", "{{pct}}%", { pct: Math.round(progress * 100) })}
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
            </Pressable>
          </>
        ) : null}

        {/* ── Stats & Streaks ── */}
        <SectionLabel>{t("accountTab.statsStreaks", "STATS & STREAKS")}</SectionLabel>
        <View style={styles.statsGrid}>
          <StatBlock
            label={t("accountTab.currentStreak", "Current Streak")}
            value={`${currentStreak}d`}
            icon="zap"
            colors={colors}
          />
          <StatBlock
            label={t("accountTab.bestStreak", "Best Streak")}
            value={`${bestStreak}d`}
            icon="award"
            colors={colors}
          />
          <StatBlock
            label={t("accountTab.tasksDone", "Tasks Done")}
            value={String(tasksDone)}
            icon="check-circle"
            colors={colors}
          />
          <StatBlock
            label={t("accountTab.goalsActive", "Goals Active")}
            value={String(activeGoalCount)}
            icon="flag"
            colors={colors}
          />
        </View>

        {/* ── Per-goal breakdown ── */}
        {perGoalStats.length > 0 && (
          <Pressable
            onPress={() => setGoalBreakdownExpanded((v) => !v)}
            style={({ pressed }) => [
              styles.breakdownHeader,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text
              style={{
                flex: 1,
                color: colors.foreground,
                fontFamily: "Inter_600SemiBold",
                fontSize: 13,
                letterSpacing: -0.1,
              }}
            >
              {t("accountTab.breakdownByGoal", "Breakdown by goal")}
            </Text>
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: 12,
                marginRight: 6,
              }}
            >
              {perGoalStats.length === 1
                ? t("accountTab.goalCountOne", "{{count}} goal", { count: perGoalStats.length })
                : t("accountTab.goalCountOther", "{{count}} goals", { count: perGoalStats.length })}
            </Text>
            <Feather
              name={goalBreakdownExpanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.mutedForeground}
            />
          </Pressable>
        )}
        {goalBreakdownExpanded && perGoalStats.length > 0 && (
          <View
            style={[
              styles.breakdownList,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            {perGoalStats.map((gs, idx) => (
              <React.Fragment key={gs.id}>
                {idx > 0 && (
                  <View
                    style={[styles.divider, { backgroundColor: colors.border, marginLeft: 14 }]}
                  />
                )}
                <View style={styles.breakdownRow}>
                  <View
                    style={[
                      styles.breakdownIcon,
                      {
                        backgroundColor: gs.hasRoadmap
                          ? colors.primary + "18"
                          : colors.muted,
                      },
                    ]}
                  >
                    <Feather
                      name={gs.hasRoadmap ? "target" : "check-square"}
                      size={13}
                      color={gs.hasRoadmap ? colors.primary : colors.mutedForeground}
                    />
                  </View>
                  <Text
                    numberOfLines={2}
                    style={{
                      flex: 1,
                      color: colors.foreground,
                      fontFamily: "Inter_500Medium",
                      fontSize: 13,
                      letterSpacing: -0.1,
                    }}
                  >
                    {gs.title}
                  </Text>
                  <View style={styles.breakdownStats}>
                    <View style={styles.breakdownStatPill}>
                      <Feather name="check-circle" size={11} color={colors.primary} />
                      <Text
                        style={{
                          color: colors.foreground,
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 12,
                          marginLeft: 4,
                        }}
                      >
                        {gs.done}
                      </Text>
                    </View>
                    <View style={styles.breakdownStatPill}>
                      <Feather name="award" size={11} color={colors.primary} />
                      <Text
                        style={{
                          color: colors.foreground,
                          fontFamily: "Inter_600SemiBold",
                          fontSize: 12,
                          marginLeft: 4,
                        }}
                      >
                        {gs.streak}d
                      </Text>
                    </View>
                  </View>
                </View>
              </React.Fragment>
            ))}
          </View>
        )}

        {/* ── Preferences ── */}
        <SectionLabel>{t("accountTab.preferences", "PREFERENCES")}</SectionLabel>
        <View
          style={[
            styles.group,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <AcctRow
            icon="bell"
            title={t("accountTab.notifications", "Notifications")}
            onPress={() => router.push("/account/notifications")}
            chevron
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <AcctRow
            icon="award"
            title={t("accountTab.rewards", "Rewards")}
            onPress={() => router.push("/account/rewards")}
            chevron
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <AcctRow
            icon="moon"
            title={t("accountTab.darkMode", "Dark Mode")}
            colors={colors}
            trailing={
              <Switch
                value={isDark}
                onValueChange={(v) =>
                  void updateAccount({ themeOverride: v ? "dark" : "light" })
                }
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={colors.primaryForeground}
              />
            }
          />
        </View>

        {/* ── Account ── */}
        <SectionLabel>{t("accountTab.account", "ACCOUNT")}</SectionLabel>
        <View
          style={[
            styles.group,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <AcctRow
            icon="shield"
            title={t("accountTab.privacySecurity", "Privacy & Security")}
            onPress={() => router.push("/account/privacy")}
            chevron
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <AcctRow
            icon="help-circle"
            title={t("accountTab.helpSupport", "Help & Support")}
            onPress={() =>
              void Linking.openURL("mailto:support@rubai.app")
            }
            chevron
            colors={colors}
          />
        </View>

        {/* ── Subscription card ── */}
        {tierKey !== "free" ? (
          <View
            style={[
              styles.subCard,
              {
                backgroundColor: colors.primary + "1A",
                borderColor: colors.primary + "40",
                borderRadius: colors.radius,
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: colors.foreground,
                  fontFamily: "Inter_700Bold",
                  fontSize: 15,
                  letterSpacing: -0.2,
                }}
              >
                {tierKey === "premium" ? t("accountTab.rubaiPremium", "rubai Premium") : t("accountTab.rubaiPro", "rubai Pro")}
              </Text>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                  fontSize: 12,
                  marginTop: 2,
                }}
              >
                {t("accountTab.activeSubscription", "Active subscription")}
              </Text>
            </View>
            <Pressable
              onPress={openSubscriptionManagement}
              style={({ pressed }) => [
                styles.manageBtn,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.8 : 1,
                },
              ]}
            >
              <Text
                style={{
                  color: colors.primaryForeground,
                  fontFamily: "Inter_700Bold",
                  fontSize: 13,
                }}
              >
                {t("accountTab.manage", "Manage")}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {/* ── Sign out ── */}
        <Pressable
          onPress={onSignOut}
          android_ripple={{ color: colors.destructive + "22" }}
          style={({ pressed }) => [
            styles.signOutBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.destructive + "40",
              borderRadius: colors.radius,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Feather name="log-out" size={16} color={colors.destructive} />
          <Text
            style={{
              color: colors.destructive,
              fontFamily: "Inter_600SemiBold",
              fontSize: 15,
              marginLeft: 8,
            }}
          >
            {t("accountTab.signOutBtn", "Sign Out")}
          </Text>
        </Pressable>

        <Text
          style={{
            color: colors.mutedForeground,
            fontFamily: "Inter_400Regular",
            fontSize: 11,
            textAlign: "center",
            paddingTop: 6,
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

function AcctRow({
  icon,
  title,
  chevron,
  trailing,
  onPress,
  colors,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  chevron?: boolean;
  trailing?: React.ReactNode;
  onPress?: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const inner = (
    <View style={styles.acctRow}>
      <View style={[styles.acctIcon, { backgroundColor: colors.primary + "14" }]}>
        <Feather name={icon} size={15} color={colors.primary} />
      </View>
      <Text
        style={{
          flex: 1,
          color: colors.foreground,
          fontFamily: "Inter_600SemiBold",
          fontSize: 14.5,
          letterSpacing: -0.1,
        }}
      >
        {title}
      </Text>
      {trailing ??
        (chevron && (
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        ))}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        android_ripple={{ color: colors.muted }}
        style={({ pressed }) => [{ opacity: pressed ? 0.85 : 1 }]}
      >
        {inner}
      </Pressable>
    );
  }
  return inner;
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
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginTop: 4,
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
  group: {
    borderWidth: 1,
    overflow: "hidden",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 62,
  },
  acctRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 56,
  },
  acctIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  subCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  manageBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    paddingVertical: 14,
  },
  breakdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  breakdownList: {
    borderWidth: 1,
    overflow: "hidden",
  },
  breakdownRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  breakdownIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  breakdownStats: {
    flexDirection: "row",
    gap: 8,
  },
  breakdownStatPill: {
    flexDirection: "row",
    alignItems: "center",
  },
});
