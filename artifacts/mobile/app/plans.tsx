import { Feather } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useState } from "react";
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
import { useAtlas, TierChangeError } from "@/providers/AtlasProvider";
import { TIER_INFO, type SubscriptionTier } from "@/types/atlas";

const TIER_ORDER: SubscriptionTier[] = ["free", "pro", "premium"];

const FEATURES: Record<SubscriptionTier, string[]> = {
  free: [
    "1 active goal",
    "Adaptive AI roadmap",
    "Daily plan & coach chat",
  ],
  pro: [
    "Up to 5 parallel goals",
    "Everything in Free",
    "Re-evaluate plan anytime",
    "Behavioral insights",
  ],
  premium: [
    "Up to 25 parallel goals",
    "Everything in Pro",
    "Advanced AI re-evaluation",
    "Priority generation",
  ],
};

export default function PlansScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 20 : insets.top + 8;
  const bottomPad = isWeb ? 24 : insets.bottom + 24;

  const { tier, updateSubscription, goals } = useAtlas();
  const currentTier = (TIER_INFO[tier as SubscriptionTier] ? tier : "free") as SubscriptionTier;
  const activeGoalCount = goals.filter((g) => g.roadmap !== null).length;

  const [busyTier, setBusyTier] = useState<SubscriptionTier | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const onSelect = async (target: SubscriptionTier) => {
    if (target === currentTier || busyTier) return;
    setErrorMsg(null);

    const isDowngrade =
      TIER_ORDER.indexOf(target) < TIER_ORDER.indexOf(currentTier);
    const targetLimit = TIER_INFO[target].goalLimit;
    const wouldExceed = isDowngrade && activeGoalCount > targetLimit;

    const proceed = async () => {
      setBusyTier(target);
      try {
        await updateSubscription(target);
        // Pop back so the user lands on Account with the new plan reflected.
        if (router.canGoBack()) router.back();
      } catch (err) {
        const msg =
          err instanceof TierChangeError
            ? err.message
            : "Couldn't change your plan. Please try again.";
        setErrorMsg(msg);
      } finally {
        setBusyTier(null);
      }
    };

    if (wouldExceed) {
      const msg = `You have ${activeGoalCount} active goals but ${TIER_INFO[target].label} only allows ${targetLimit}. Remove ${activeGoalCount - targetLimit} goal(s) on the Goals tab first.`;
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") window.alert(msg);
      } else {
        Alert.alert("Downgrade blocked", msg, [{ text: "OK" }]);
      }
      return;
    }

    if (isDowngrade) {
      const msg = `Switch from ${TIER_INFO[currentTier].label} to ${TIER_INFO[target].label}?`;
      if (Platform.OS === "web") {
        if (typeof window !== "undefined" && window.confirm(msg)) void proceed();
      } else {
        Alert.alert("Confirm downgrade", msg, [
          { text: "Cancel", style: "cancel" },
          { text: "Switch", style: "destructive", onPress: () => void proceed() },
        ]);
      }
    } else {
      void proceed();
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: "Choose your plan" }} />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad, paddingBottom: bottomPad },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text
            style={[
              styles.eyebrow,
              { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            SUBSCRIPTION
          </Text>
          <Text
            style={[
              styles.title,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            Choose your plan
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            You're on the {TIER_INFO[currentTier].label} plan with {activeGoalCount} active goal{activeGoalCount === 1 ? "" : "s"}.
          </Text>
        </View>

        {errorMsg ? (
          <View
            style={[
              styles.errorBanner,
              {
                backgroundColor: colors.destructive + "14",
                borderColor: colors.destructive,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather name="alert-circle" size={14} color={colors.destructive} />
            <Text
              style={[
                styles.errorBannerText,
                { color: colors.destructive, fontFamily: "Inter_500Medium" },
              ]}
            >
              {errorMsg}
            </Text>
          </View>
        ) : null}

        {TIER_ORDER.map((t) => {
          const info = TIER_INFO[t];
          const isCurrent = t === currentTier;
          const isBusy = busyTier === t;
          const isDowngrade =
            TIER_ORDER.indexOf(t) < TIER_ORDER.indexOf(currentTier);

          let buttonLabel = "Switch to this plan";
          if (isCurrent) buttonLabel = "Current plan";
          else if (isBusy) buttonLabel = "Updating…";
          else if (isDowngrade) buttonLabel = "Downgrade";
          else buttonLabel = "Upgrade";

          return (
            <View
              key={t}
              style={[
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: isCurrent ? colors.primary : colors.border,
                  borderWidth: isCurrent ? 2 : 1,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.cardName,
                      { color: colors.foreground, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {info.label}
                  </Text>
                  <Text
                    style={[
                      styles.cardTagline,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {info.tagline}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text
                    style={[
                      styles.cardPrice,
                      { color: colors.foreground, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {info.price}
                  </Text>
                  {isCurrent ? (
                    <View
                      style={[
                        styles.currentBadge,
                        { backgroundColor: colors.primary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.currentBadgeText,
                          {
                            color: colors.primaryForeground,
                            fontFamily: "Inter_700Bold",
                          },
                        ]}
                      >
                        CURRENT
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.featureList}>
                {FEATURES[t].map((f, i) => (
                  <View key={i} style={styles.featureRow}>
                    <Feather name="check" size={14} color={colors.primary} />
                    <Text
                      style={[
                        styles.featureText,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_400Regular",
                        },
                      ]}
                    >
                      {f}
                    </Text>
                  </View>
                ))}
              </View>

              <Pressable
                onPress={() => void onSelect(t)}
                disabled={isCurrent || !!busyTier}
                accessibilityRole="button"
                accessibilityLabel={`${buttonLabel} - ${info.label}`}
                style={({ pressed }) => [
                  styles.cardBtn,
                  {
                    backgroundColor: isCurrent
                      ? "transparent"
                      : isDowngrade
                        ? colors.card
                        : colors.primary,
                    borderColor: isCurrent
                      ? colors.border
                      : isDowngrade
                        ? colors.border
                        : colors.primary,
                    borderWidth: 1,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.85 : isCurrent ? 0.55 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.cardBtnText,
                    {
                      color: isCurrent
                        ? colors.mutedForeground
                        : isDowngrade
                          ? colors.foreground
                          : colors.primaryForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {buttonLabel}
                </Text>
              </Pressable>
            </View>
          );
        })}

        <Text
          style={[
            styles.footnote,
            {
              color: colors.mutedForeground,
              fontFamily: "Inter_400Regular",
            },
          ]}
        >
          No payment is required during beta — your plan switches instantly.
          Real billing (Apple, Google Play, Stripe) is coming soon.
        </Text>

        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [
            styles.backBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Feather name="arrow-left" size={14} color={colors.mutedForeground} />
          <Text
            style={[
              styles.backBtnText,
              {
                color: colors.mutedForeground,
                fontFamily: "Inter_500Medium",
              },
            ]}
          >
            Back
          </Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 20,
    gap: 16,
  },
  header: {
    gap: 6,
    marginBottom: 4,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.4,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
  },
  errorBannerText: {
    fontSize: 13,
    flex: 1,
  },
  card: {
    padding: 18,
    gap: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  cardName: {
    fontSize: 20,
    lineHeight: 24,
  },
  cardTagline: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  cardPrice: {
    fontSize: 16,
  },
  currentBadge: {
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  currentBadgeText: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
  featureList: {
    gap: 6,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  featureText: {
    fontSize: 13.5,
    lineHeight: 18,
    flex: 1,
  },
  cardBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  cardBtnText: {
    fontSize: 14,
    letterSpacing: 0.2,
  },
  footnote: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 4,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  backBtnText: {
    fontSize: 13,
  },
});
