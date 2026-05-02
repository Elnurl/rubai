import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
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
import { TIER_INFO, type SubscriptionTier } from "@/types/atlas";

const TIER_ORDER: SubscriptionTier[] = ["free", "pro", "premium"];

const TIER_FEATURES: Record<SubscriptionTier, string[]> = {
  free: [
    "1 active goal",
    "AI-generated daily plan",
    "Coach chat (Smart model)",
    "Roadmap with phases",
  ],
  pro: [
    "Up to 5 parallel goals",
    "Behavioral profile insights",
    "Smart + Fast coach models",
    "Voice coach (mic + speaker)",
    "Weekly performance summary",
  ],
  premium: [
    "Up to 25 goals across life areas",
    "Adaptive AI re-evaluation",
    "Deep behavioral analysis",
    "Priority model access",
    "Everything in Pro",
  ],
};

function isKnownTier(t: string): t is SubscriptionTier {
  return (TIER_ORDER as readonly string[]).includes(t);
}

export default function PlansScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { tier, updateSubscription } = useAtlas();
  const currentTier: SubscriptionTier = isKnownTier(tier) ? tier : "free";
  const [busy, setBusy] = useState<SubscriptionTier | null>(null);

  const onPick = async (next: SubscriptionTier) => {
    if (next === currentTier) {
      router.back();
      return;
    }
    setBusy(next);
    try {
      await updateSubscription(next);
      router.back();
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: isWeb ? 16 : insets.top + 8,
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Feather name="chevron-left" size={22} color={colors.foreground} />
          <Text
            style={[
              styles.backText,
              { color: colors.foreground, fontFamily: "Inter_500Medium" },
            ]}
          >
            Back
          </Text>
        </Pressable>
        <Text
          style={[
            styles.headerTitle,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
          maxFontSizeMultiplier={1.3}
        >
          Choose your plan
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: 40 + (isWeb ? 0 : insets.bottom) },
        ]}
      >
        <Text
          style={[
            styles.intro,
            { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
          ]}
          maxFontSizeMultiplier={1.4}
        >
          Pick the plan that matches how many goals you want rubai to coach you
          through. You can switch anytime.
        </Text>

        {TIER_ORDER.map((t) => {
          const info = TIER_INFO[t];
          const features = TIER_FEATURES[t];
          const isCurrent = t === currentTier;
          const isHighlight = t === "pro";
          const isBusy = busy === t;

          return (
            <View
              key={t}
              style={[
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: isHighlight ? colors.primary : colors.border,
                  borderWidth: isHighlight ? 2 : 1,
                  borderRadius: colors.radius,
                },
              ]}
            >
              <View style={styles.cardHead}>
                <View style={styles.cardHeadLeft}>
                  <Text
                    style={[
                      styles.tierLabel,
                      { color: colors.foreground, fontFamily: "Inter_700Bold" },
                    ]}
                    maxFontSizeMultiplier={1.3}
                  >
                    {info.label}
                  </Text>
                  <Text
                    style={[
                      styles.tagline,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                    maxFontSizeMultiplier={1.4}
                  >
                    {info.tagline}
                  </Text>
                </View>
                <View style={styles.cardHeadRight}>
                  <Text
                    style={[
                      styles.price,
                      { color: colors.foreground, fontFamily: "Inter_700Bold" },
                    ]}
                    maxFontSizeMultiplier={1.3}
                  >
                    {info.price}
                  </Text>
                  {isHighlight ? (
                    <View
                      style={[
                        styles.badge,
                        { backgroundColor: colors.primary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          {
                            color: colors.primaryForeground,
                            fontFamily: "Inter_700Bold",
                          },
                        ]}
                      >
                        POPULAR
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.features}>
                {features.map((f) => (
                  <View key={f} style={styles.featureRow}>
                    <Feather name="check" size={16} color={colors.primary} />
                    <Text
                      style={[
                        styles.featureText,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_400Regular",
                        },
                      ]}
                      maxFontSizeMultiplier={1.4}
                    >
                      {f}
                    </Text>
                  </View>
                ))}
              </View>

              <Pressable
                onPress={() => void onPick(t)}
                disabled={busy !== null}
                style={({ pressed }) => [
                  styles.cta,
                  {
                    backgroundColor: isCurrent ? "transparent" : colors.primary,
                    borderColor: isCurrent ? colors.border : colors.primary,
                    borderWidth: isCurrent ? 1 : 0,
                    borderRadius: colors.radius,
                    opacity: pressed || (busy !== null && !isBusy) ? 0.85 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={
                  isCurrent ? "Current plan" : `Choose ${info.label}`
                }
              >
                <Text
                  style={[
                    styles.ctaText,
                    {
                      color: isCurrent
                        ? colors.foreground
                        : colors.primaryForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                  maxFontSizeMultiplier={1.3}
                >
                  {isCurrent
                    ? "Current plan"
                    : isBusy
                      ? "Switching…"
                      : `Choose ${info.label}`}
                </Text>
              </Pressable>
            </View>
          );
        })}

        <Text
          style={[
            styles.disclaimer,
            { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
          ]}
          maxFontSizeMultiplier={1.4}
        >
          Plan switching is currently a preview. No payment is taken — your
          selection just updates rubai's UI for this session.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 4,
    paddingVertical: 6,
    minWidth: 72,
  },
  backText: { fontSize: 15 },
  headerTitle: { fontSize: 17, flex: 1, textAlign: "center" },
  headerSpacer: { width: 72 },
  container: { padding: 20, gap: 16 },
  intro: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
  card: { padding: 18, gap: 14 },
  cardHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  cardHeadLeft: { flex: 1, gap: 4 },
  cardHeadRight: { alignItems: "flex-end", gap: 6 },
  tierLabel: { fontSize: 22 },
  tagline: { fontSize: 13, lineHeight: 18 },
  price: { fontSize: 18 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  badgeText: { fontSize: 10, letterSpacing: 0.5 },
  features: { gap: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featureText: { fontSize: 14, flex: 1 },
  cta: {
    paddingVertical: 13,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  ctaText: { fontSize: 15 },
  disclaimer: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
    textAlign: "center",
    paddingHorizontal: 12,
  },
});
