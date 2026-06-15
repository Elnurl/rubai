import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
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

import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";
import { TIER_INFO } from "@/types/atlas";

export default function ReplaceGoalScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 24 : insets.top + 8;
  const bottomPad = isWeb ? 24 : insets.bottom + 24;

  const { goals, removeGoal, subscription, goalLimit, pendingDraft } =
    useAtlas();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const planLabel = TIER_INFO[subscription.tier].label;
  const completedGoals = goals.filter((g) => g.roadmap !== null);

  const replaceWithPending = useCallback(
    async (goalId: string, label: string) => {
      const performReplace = async () => {
        setPendingId(goalId);
        try {
          await removeGoal(goalId);
          // Hand control back to the generating screen — pendingDraft still
          // holds the synthesised profile, so the AI flow will resume.
          router.replace("/generating");
        } catch {
          setPendingId(null);
        }
      };

      const message = t(
        "replaceGoal.confirmMessage",
        '"{{label}}" and all of its progress will be replaced with your new goal. This can\'t be undone.',
        { label },
      );
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && window.confirm(message)) {
          void performReplace();
        }
        return;
      }
      Alert.alert(t("replaceGoal.confirmTitle", "Replace this goal?"), message, [
        { text: t("replaceGoal.cancelBtn", "Cancel"), style: "cancel" },
        {
          text: t("replaceGoal.replaceBtn", "Replace"),
          style: "destructive",
          onPress: () => void performReplace(),
        },
      ]);
    },
    [removeGoal, router, t],
  );

  const onCancel = useCallback(() => {
    router.back();
  }, [router]);

  const hasPending = pendingDraft?.synthesizedProfile != null;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad, paddingBottom: bottomPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={onCancel}
          style={({ pressed }) => [
            styles.backRow,
            { opacity: pressed ? 0.6 : 1 },
          ]}
          accessibilityRole="button"
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
          <Text
            style={[
              styles.backText,
              { color: colors.foreground, fontFamily: "Inter_500Medium" },
            ]}
          >
            {t("replaceGoal.backBtn", "Back")}
          </Text>
        </Pressable>

        <Text
          style={[
            styles.eyebrow,
            { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
          ]}
        >
          {t("replaceGoal.eyebrow", "REPLACE A GOAL")}
        </Text>
        <Text
          style={[
            styles.title,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
          {t("replaceGoal.title", "Pick a goal to swap out")}
        </Text>
        <Text
          style={[
            styles.subtitle,
            { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
          ]}
        >
          {goalLimit === 1
            ? t(
                "replaceGoal.subtitleOne",
                "You're on the {{plan}} plan ({{used}} of {{limit}} goal used). Removing one frees a slot for your new goal.",
                { plan: planLabel, used: completedGoals.length, limit: goalLimit },
              )
            : t(
                "replaceGoal.subtitleMany",
                "You're on the {{plan}} plan ({{used}} of {{limit}} goals used). Removing one frees a slot for your new goal.",
                { plan: planLabel, used: completedGoals.length, limit: goalLimit },
              )}
        </Text>

        {!hasPending && (
          <View
            style={[
              styles.warning,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather name="info" size={14} color={colors.mutedForeground} />
            <Text
              style={[
                styles.warningText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_500Medium",
                },
              ]}
            >
              {t(
                "replaceGoal.warningText",
                "No new goal queued — deletions here will simply remove the selected goal.",
              )}
            </Text>
          </View>
        )}

        <View style={styles.list}>
          {completedGoals.length === 0 ? (
            <Text
              style={[
                styles.empty,
                { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
              ]}
            >
              {t(
                "replaceGoal.emptyBody",
                "You don't have any completed goals to replace yet.",
              )}
            </Text>
          ) : (
            completedGoals.map((g) => {
              const label =
                g.profile.customGoalTitle?.trim() || g.profile.goalStatement;
              const isPending = pendingId === g.id;
              return (
                <View
                  key={g.id}
                  style={[
                    styles.card,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      borderRadius: colors.radius,
                    },
                  ]}
                >
                  <View style={styles.cardBody}>
                    <Text
                      style={[
                        styles.cardLabel,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                      numberOfLines={2}
                    >
                      {label}
                    </Text>
                    {g.roadmap && (
                      <Text
                        style={[
                          styles.cardMeta,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_400Regular",
                          },
                        ]}
                      >
                        {t("replaceGoal.weekRoadmap", "{{weeks}}-week roadmap", {
                          weeks: g.roadmap.totalWeeks,
                        })}
                      </Text>
                    )}
                  </View>
                  <Pressable
                    onPress={() => void replaceWithPending(g.id, label)}
                    disabled={isPending}
                    style={({ pressed }) => [
                      styles.replaceBtn,
                      {
                        backgroundColor: colors.destructive,
                        opacity: isPending ? 0.5 : pressed ? 0.85 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={t("replaceGoal.replaceA11y", "Replace {{label}}", { label })}
                  >
                    <Feather
                      name="refresh-ccw"
                      size={14}
                      color={colors.primaryForeground}
                    />
                    <Text
                      style={[
                        styles.replaceBtnText,
                        { fontFamily: "Inter_700Bold" },
                      ]}
                    >
                      {isPending
                        ? t("replaceGoal.replacing", "Replacing…")
                        : t("replaceGoal.replaceCardBtn", "Replace")}
                    </Text>
                  </Pressable>
                </View>
              );
            })
          )}
        </View>

        <Pressable
          onPress={() => router.replace("/(tabs)/account")}
          style={({ pressed }) => [
            styles.upgradeRow,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
          accessibilityRole="button"
        >
          <Feather name="arrow-up-right" size={16} color={colors.accent} />
          <Text
            style={[
              styles.upgradeText,
              { color: colors.foreground, fontFamily: "Inter_500Medium" },
            ]}
          >
            {t("replaceGoal.upgradeText", "Or upgrade your plan to keep all your goals")}
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 22,
    gap: 12,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
  },
  backText: { fontSize: 14 },
  eyebrow: { fontSize: 11, letterSpacing: 1.4, marginTop: 4 },
  title: { fontSize: 24, lineHeight: 30, marginTop: 4 },
  subtitle: { fontSize: 14, lineHeight: 20, marginTop: 4 },
  warning: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderWidth: 1,
  },
  warningText: { flex: 1, fontSize: 12.5, lineHeight: 17 },
  list: { gap: 10, marginTop: 12 },
  empty: { textAlign: "center", paddingVertical: 24, fontSize: 14 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 1,
  },
  cardBody: { flex: 1, gap: 4 },
  cardLabel: { fontSize: 15 },
  cardMeta: { fontSize: 12 },
  replaceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  replaceBtnText: { color: "#fff", fontSize: 13, letterSpacing: 0.2 },
  upgradeRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderWidth: 1,
  },
  upgradeText: { flex: 1, fontSize: 13.5, lineHeight: 19 },
});
