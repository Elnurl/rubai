import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";
import { deriveAllRewards, type GoalRewards, type RewardEmblem } from "@/lib/rewards";
import { useAtlas } from "@/providers/AtlasProvider";

export default function RewardsScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { goals } = useAtlas();

  const rewardGroups = useMemo(() => deriveAllRewards(goals), [goals]);

  const totalUnlocked = rewardGroups.reduce((n, g) => n + g.unlockedCount, 0);
  const totalAll = rewardGroups.reduce((n, g) => n + g.totalCount, 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: 48,
          paddingHorizontal: 22,
          gap: 18,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
          >
            <Feather name="chevron-left" size={24} color={colors.foreground} />
          </Pressable>
          <Text
            style={{
              flex: 1,
              textAlign: "center",
              color: colors.foreground,
              fontFamily: "Inter_600SemiBold",
              fontSize: 16,
              letterSpacing: -0.2,
              marginRight: 24,
            }}
          >
            {t("rewards.title", "Rewards")}
          </Text>
        </View>

        {/* Intro / overall progress */}
        <View
          style={[
            styles.introCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <View style={[styles.introIcon, { backgroundColor: colors.accent + "1F" }]}>
            <Feather name="gift" size={18} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: colors.foreground,
                fontFamily: "Inter_700Bold",
                fontSize: 15,
                letterSpacing: -0.2,
              }}
            >
              {t("rewards.introTitle", "Unlock as you progress")}
            </Text>
            <Text
              style={{
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
                fontSize: 12,
                lineHeight: 17,
                marginTop: 3,
              }}
            >
              {totalAll > 0
                ? t(
                    "rewards.introProgress",
                    "{{unlocked}} of {{total}} unlocked. Finish each roadmap phase to reveal its emblem.",
                    { unlocked: totalUnlocked, total: totalAll },
                  )
                : t(
                    "rewards.introEmpty",
                    "Create a goal with a roadmap to start collecting emblems.",
                  )}
            </Text>
          </View>
        </View>

        {rewardGroups.length === 0 ? (
          <EmptyState colors={colors} />
        ) : (
          rewardGroups.map((group, gi) => (
            <RewardGroupSection
              key={group.goalId}
              group={group}
              colors={colors}
              indexOffset={gi * 4}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function RewardGroupSection({
  group,
  colors,
  indexOffset,
}: {
  group: GoalRewards;
  colors: ReturnType<typeof useColors>;
  indexOffset: number;
}) {
  return (
    <View style={{ gap: 12 }}>
      <View style={styles.groupHeaderRow}>
        <Text
          style={{
            color: colors.primary,
            fontFamily: "Inter_600SemiBold",
            fontSize: 11,
            letterSpacing: 1.6,
            flex: 1,
          }}
          numberOfLines={1}
        >
          {group.goalTitle.toUpperCase()}
        </Text>
        <Text
          style={{
            color: colors.mutedForeground,
            fontFamily: "Inter_600SemiBold",
            fontSize: 11,
            letterSpacing: 0.4,
          }}
        >
          {group.unlockedCount}/{group.totalCount}
        </Text>
      </View>
      <View style={styles.grid}>
        {group.emblems.map((emblem, i) => (
          <EmblemCard
            key={emblem.key}
            emblem={emblem}
            colors={colors}
            index={indexOffset + i}
          />
        ))}
      </View>
    </View>
  );
}

function EmblemCard({
  emblem,
  colors,
  index,
}: {
  emblem: RewardEmblem;
  colors: ReturnType<typeof useColors>;
  index: number;
}) {
  const { t } = useTranslation();
  const isGrand = emblem.kind === "grand";
  const badgeColor = emblem.locked ? colors.muted : emblem.color;
  const iconColor = emblem.locked ? colors.mutedForeground : "#FFFFFF";

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 12) * 50).springify().damping(16)}
      style={[
        styles.card,
        isGrand && styles.cardWide,
        {
          backgroundColor: colors.card,
          borderColor: emblem.locked ? colors.border : emblem.color + "55",
          borderRadius: colors.radius,
        },
      ]}
    >
      <View
        style={[
          styles.badge,
          isGrand && styles.badgeLarge,
          { backgroundColor: badgeColor },
        ]}
      >
        <Feather
          name={emblem.icon}
          size={isGrand ? 28 : 22}
          color={iconColor}
        />
        {emblem.locked && (
          <View style={[styles.lockPip, { backgroundColor: colors.foreground }]}>
            <Feather name="lock" size={10} color={colors.background} />
          </View>
        )}
      </View>

      <Text
        style={{
          color: emblem.locked ? colors.mutedForeground : colors.foreground,
          fontFamily: "Inter_600SemiBold",
          fontSize: isGrand ? 14 : 12.5,
          textAlign: "center",
          marginTop: 10,
        }}
        numberOfLines={2}
      >
        {isGrand
          ? t("rewards.grandLabel", "{{title}} — Complete", { title: emblem.title })
          : emblem.title}
      </Text>

      <Text
        style={{
          color: emblem.locked ? colors.mutedForeground : emblem.color,
          fontFamily: "Inter_600SemiBold",
          fontSize: 10,
          letterSpacing: 0.5,
          textAlign: "center",
          marginTop: 4,
          opacity: emblem.locked ? 0.8 : 1,
        }}
      >
        {emblem.locked
          ? emblem.unlockWeek
            ? t("rewards.unlocksWeek", "UNLOCKS WEEK {{week}}", {
                week: emblem.unlockWeek + 1,
              })
            : t("rewards.locked", "LOCKED")
          : t("rewards.unlocked", "UNLOCKED")}
      </Text>
    </Animated.View>
  );
}

function EmptyState({ colors }: { colors: ReturnType<typeof useColors> }) {
  const { t } = useTranslation();
  return (
    <View
      style={[
        styles.empty,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <View style={[styles.introIcon, { backgroundColor: colors.muted }]}>
        <Feather name="lock" size={18} color={colors.mutedForeground} />
      </View>
      <Text
        style={{
          color: colors.foreground,
          fontFamily: "Inter_600SemiBold",
          fontSize: 14,
          marginTop: 12,
        }}
      >
        {t("rewards.emptyTitle", "No emblems yet")}
      </Text>
      <Text
        style={{
          color: colors.mutedForeground,
          fontFamily: "Inter_400Regular",
          fontSize: 12.5,
          lineHeight: 18,
          textAlign: "center",
          marginTop: 4,
        }}
      >
        {t(
          "rewards.emptyBody",
          "Once a goal has a roadmap, an emblem appears for every phase — and a grand emblem for finishing the whole goal.",
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  introCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  introIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  groupHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    width: "47%",
    flexGrow: 1,
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  cardWide: {
    width: "100%",
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeLarge: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  lockPip: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    alignItems: "center",
    padding: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
