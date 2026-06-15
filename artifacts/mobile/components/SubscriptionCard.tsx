import { Feather } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import { TIER_INFO, type SubscriptionTier } from "@/types/atlas";

type Props = {
  currentTier: SubscriptionTier;
  goalsUsed: number;
  onSelect: (tier: SubscriptionTier) => void;
};

const TIER_ORDER: SubscriptionTier[] = ["free", "pro", "premium"];

export function SubscriptionCard({ currentTier, goalsUsed, onSelect }: Props) {
  const colors = useColors();
  const { t } = useTranslation();
  const current = TIER_INFO[currentTier];

  return (
    <View style={{ gap: 14 }}>
      <View
        style={[
          styles.headerCard,
          {
            backgroundColor: colors.primary,
            borderRadius: colors.radius,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text
              style={[
                styles.eyebrow,
                {
                  color: colors.primaryForeground + "CC",
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              {t("subscriptionCard.yourPlan", "YOUR PLAN")}
            </Text>
            <Text
              style={[
                styles.planTitle,
                { color: colors.primaryForeground, fontFamily: "Inter_700Bold" },
              ]}
            >
              {current.label}
            </Text>
            <Text
              style={[
                styles.planSub,
                {
                  color: colors.primaryForeground + "CC",
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              {current.tagline}
            </Text>
          </View>
          <Feather name="award" size={28} color={colors.primaryForeground} />
        </View>

        <View
          style={[
            styles.usageBar,
            { backgroundColor: colors.primaryForeground + "33" },
          ]}
        >
          <View
            style={[
              styles.usageFill,
              {
                backgroundColor: colors.primaryForeground,
                width: `${Math.min(100, (goalsUsed / current.goalLimit) * 100)}%`,
              },
            ]}
          />
        </View>
        <Text
          style={[
            styles.usageText,
            {
              color: colors.primaryForeground,
              fontFamily: "Inter_500Medium",
            },
          ]}
        >
          {current.goalLimit === 1
            ? t("subscriptionCard.goalsInUseOne", "{{used}} of {{limit}} goal in use", { used: goalsUsed, limit: current.goalLimit })
            : t("subscriptionCard.goalsInUseOther", "{{used}} of {{limit}} goals in use", { used: goalsUsed, limit: current.goalLimit })}
        </Text>
      </View>

      <Text
        style={[
          styles.sectionLabel,
          { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
        ]}
      >
        {t("subscriptionCard.switchTier", "SWITCH TIER")}
      </Text>

      {TIER_ORDER.map((tier) => {
        const info = TIER_INFO[tier];
        const isCurrent = tier === currentTier;
        return (
          <Pressable
            key={tier}
            onPress={() => !isCurrent && onSelect(tier)}
            disabled={isCurrent}
            style={({ pressed }) => [
              styles.tierCard,
              {
                backgroundColor: colors.card,
                borderColor: isCurrent ? colors.primary : colors.border,
                borderWidth: isCurrent ? 2 : 1,
                borderRadius: colors.radius,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.tierTopRow}>
                <Text
                  style={[
                    styles.tierLabel,
                    { color: colors.foreground, fontFamily: "Inter_700Bold" },
                  ]}
                >
                  {info.label}
                </Text>
                <Text
                  style={[
                    styles.tierPrice,
                    { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
                  ]}
                >
                  {info.price}
                </Text>
              </View>
              <Text
                style={[
                  styles.tierTagline,
                  { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
                ]}
              >
                {info.tagline}
              </Text>
              <Text
                style={[
                  styles.tierLimit,
                  { color: colors.foreground, fontFamily: "Inter_500Medium" },
                ]}
              >
                {info.goalLimit === 1
                  ? t("subscriptionCard.activeGoalsOne", "{{count}} active goal", { count: info.goalLimit })
                  : t("subscriptionCard.activeGoalsOther", "{{count}} active goals", { count: info.goalLimit })}
              </Text>
            </View>
            {isCurrent ? (
              <View
                style={[
                  styles.currentPill,
                  {
                    backgroundColor: colors.primary + "1A",
                    borderColor: colors.primary,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.currentPillText,
                    { color: colors.primary, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  {t("subscriptionCard.current", "CURRENT")}
                </Text>
              </View>
            ) : (
              <Feather name="chevron-right" size={20} color={colors.mutedForeground} />
            )}
          </Pressable>
        );
      })}

      <Text
        style={[
          styles.disclaimer,
          { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
        ]}
      >
        {t("subscriptionCard.disclaimer", "Demo subscription. No real charges — switch freely to explore the multi-goal experience.")}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  headerCard: {
    padding: 20,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.6,
    marginBottom: 4,
  },
  planTitle: {
    fontSize: 26,
    letterSpacing: -0.4,
  },
  planSub: {
    fontSize: 13.5,
    lineHeight: 18,
    marginTop: 2,
    maxWidth: 220,
  },
  usageBar: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  usageFill: {
    height: "100%",
    borderRadius: 3,
  },
  usageText: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1.6,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  tierCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 18,
  },
  tierTopRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 8,
  },
  tierLabel: {
    fontSize: 17,
  },
  tierPrice: {
    fontSize: 13,
  },
  tierTagline: {
    fontSize: 13,
    lineHeight: 18,
  },
  tierLimit: {
    fontSize: 12.5,
    marginTop: 4,
  },
  currentPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 999,
  },
  currentPillText: {
    fontSize: 10,
    letterSpacing: 1.2,
  },
  disclaimer: {
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 4,
    fontStyle: "italic",
  },
});
