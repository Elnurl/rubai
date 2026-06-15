import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
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
import { useSubscription, RC_OFFERING_PRO, RC_OFFERING_PREMIUM } from "@/lib/revenuecat";
import { TIER_INFO, type SubscriptionTier } from "@/types/atlas";
import i18n from "@/lib/i18n";
import { useTranslation } from "react-i18next";

const TIER_ORDER: SubscriptionTier[] = ["free", "pro", "premium"];

const TIER_FEATURES: Record<SubscriptionTier, string[]> = {
  free: [
    i18n.t("plans.featFree1", "1 active goal"),
    i18n.t("plans.featFree2", "AI-generated daily plan"),
    i18n.t("plans.featFree3", "Coach chat (Smart model)"),
    i18n.t("plans.featFree4", "Roadmap with phases"),
  ],
  pro: [
    i18n.t("plans.featPro1", "Up to 5 parallel goals"),
    i18n.t("plans.featPro2", "Behavioral profile insights"),
    i18n.t("plans.featPro3", "Smart + Fast coach models"),
    i18n.t("plans.featPro4", "Voice coach (mic + speaker)"),
    i18n.t("plans.featPro5", "Weekly performance summary"),
  ],
  premium: [
    i18n.t("plans.featPremium1", "Up to 25 goals across life areas"),
    i18n.t("plans.featPremium2", "Full Behavioral Orchestration AI"),
    i18n.t("plans.featPremium3", "Multi-model adaptive coaching"),
    i18n.t("plans.featPremium4", "Priority model access"),
    i18n.t("plans.featPremium5", "Everything in Pro"),
  ],
};

const TIER_OFFERING: Record<SubscriptionTier, string | null> = {
  free: null,
  pro: RC_OFFERING_PRO,
  premium: RC_OFFERING_PREMIUM,
};

function isKnownTier(t: string): t is SubscriptionTier {
  return (TIER_ORDER as readonly string[]).includes(t);
}

export default function PlansScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const { tier, updateSubscription } = useAtlas();
  const {
    activeTier,
    proOffering,
    premiumOffering,
    isLoading: rcLoading,
    purchase,
    restore,
    isPurchasing,
    isRestoring,
  } = useSubscription();

  const currentTier: SubscriptionTier = isKnownTier(activeTier) ? activeTier : "free";
  const [confirmTier, setConfirmTier] = useState<SubscriptionTier | null>(null);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const getPackageForTier = (tier: SubscriptionTier) => {
    if (tier === "pro") return proOffering?.availablePackages[0] ?? null;
    if (tier === "premium") return premiumOffering?.availablePackages[0] ?? null;
    return null;
  };

  const getPriceForTier = (tier: SubscriptionTier): string => {
    const pkg = getPackageForTier(tier);
    if (pkg)
      return t("plans.perMonth", "{{price}} / month", {
        price: pkg.product.priceString,
      });
    return TIER_INFO[tier].price;
  };

  const onPick = (tier: SubscriptionTier) => {
    if (tier === currentTier) {
      router.back();
      return;
    }
    if (tier === "free") {
      router.back();
      return;
    }
    setErrorMsg(null);
    setConfirmTier(tier);
  };

  const onConfirmPurchase = async () => {
    if (!confirmTier) return;
    const pkg = getPackageForTier(confirmTier);
    if (!pkg) {
      setErrorMsg(t("plans.productUnavailable", "Product not available. Please try again."));
      setConfirmTier(null);
      return;
    }
    setBusy(true);
    setConfirmTier(null);
    try {
      await purchase(pkg);
      await updateSubscription(confirmTier);
      router.back();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("plans.purchaseFailed", "Purchase failed.");
      if (!msg.toLowerCase().includes("cancel")) {
        setErrorMsg(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  const onRestore = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      await restore();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : t("plans.restoreFailed", "Restore failed."));
    } finally {
      setBusy(false);
    }
  };

  const isBusy = busy || isPurchasing || isRestoring;

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
          accessibilityLabel={t("plans.goBack", "Go back")}
        >
          <Feather name="chevron-left" size={22} color={colors.foreground} />
          <Text style={[styles.backText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
            {t("plans.back", "Back")}
          </Text>
        </Pressable>
        <Text
          style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
          maxFontSizeMultiplier={1.3}
        >
          {t("plans.headerTitle", "Choose your plan")}
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
          style={[styles.intro, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
          maxFontSizeMultiplier={1.4}
        >
          {t("plans.intro", "Pick the plan that matches how many goals you want rubai to coach you through. You can switch anytime.")}
        </Text>

        {errorMsg ? (
          <View style={[styles.errorBox, { backgroundColor: colors.card, borderColor: "#ef4444" }]}>
            <Text style={[styles.errorText, { fontFamily: "Inter_400Regular" }]}>{errorMsg}</Text>
          </View>
        ) : null}

        {TIER_ORDER.map((tier) => {
          const info = TIER_INFO[tier];
          const features = TIER_FEATURES[tier];
          const isCurrent = tier === currentTier;
          const isHighlight = tier === "pro";
          const price = rcLoading && tier !== "free" ? t("plans.loading", "Loading…") : getPriceForTier(tier);

          return (
            <View
              key={tier}
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
                    style={[styles.tierLabel, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
                    maxFontSizeMultiplier={1.3}
                  >
                    {info.label}
                  </Text>
                  <Text
                    style={[styles.tagline, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
                    maxFontSizeMultiplier={1.4}
                  >
                    {info.tagline}
                  </Text>
                </View>
                <View style={styles.cardHeadRight}>
                  <Text
                    style={[styles.price, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
                    maxFontSizeMultiplier={1.3}
                  >
                    {price}
                  </Text>
                  {isHighlight ? (
                    <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                      <Text
                        style={[styles.badgeText, { color: colors.primaryForeground, fontFamily: "Inter_700Bold" }]}
                      >
                        {t("plans.popular", "POPULAR")}
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
                      style={[styles.featureText, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}
                      maxFontSizeMultiplier={1.4}
                    >
                      {f}
                    </Text>
                  </View>
                ))}
              </View>

              <Pressable
                onPress={() => onPick(tier)}
                disabled={isBusy || rcLoading}
                style={({ pressed }) => [
                  styles.cta,
                  {
                    backgroundColor: isCurrent ? "transparent" : colors.primary,
                    borderColor: isCurrent ? colors.border : colors.primary,
                    borderWidth: isCurrent ? 1 : 0,
                    borderRadius: colors.radius,
                    opacity: pressed || (isBusy && tier !== currentTier) ? 0.7 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={isCurrent ? t("plans.currentPlan", "Current plan") : t("plans.choose", "Choose {{label}}", { label: info.label })}
              >
                {isBusy && tier !== "free" && tier === currentTier ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Text
                    style={[
                      styles.ctaText,
                      {
                        color: isCurrent ? colors.foreground : colors.primaryForeground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                    maxFontSizeMultiplier={1.3}
                  >
                    {isCurrent ? t("plans.currentPlan", "Current plan") : tier === "free" ? t("plans.downgradeFree", "Downgrade to Free") : t("plans.choose", "Choose {{label}}", { label: info.label })}
                  </Text>
                )}
              </Pressable>
            </View>
          );
        })}

        <Pressable
          onPress={onRestore}
          disabled={isBusy}
          style={styles.restoreBtn}
          accessibilityRole="button"
        >
          <Text style={[styles.restoreText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {isRestoring ? t("plans.restoring", "Restoring…") : t("plans.restorePurchases", "Restore purchases")}
          </Text>
        </Pressable>
      </ScrollView>

      <Modal
        visible={confirmTier !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setConfirmTier(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {t("plans.confirmPurchase", "Confirm Purchase")}
            </Text>
            {confirmTier ? (
              <Text style={[styles.modalBody, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {t("plans.aboutToPurchase", "You are about to purchase")}{" "}
                <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
                  {t("plans.productName", "RubAI {{label}}", { label: TIER_INFO[confirmTier]?.label })}
                </Text>{" "}
                {t("plans.for", "for")}{" "}
                <Text style={{ fontFamily: "Inter_600SemiBold", color: colors.foreground }}>
                  {getPriceForTier(confirmTier)}
                </Text>
                {__DEV__ ? t("plans.sandboxNote", "\n\nThis is a sandbox purchase — no real payment will be taken.") : ""}
              </Text>
            ) : null}
            <View style={styles.modalActions}>
              <Pressable
                onPress={() => setConfirmTier(null)}
                style={[styles.modalBtn, { borderColor: colors.border, borderWidth: 1, borderRadius: colors.radius }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                  {t("plans.cancel", "Cancel")}
                </Text>
              </Pressable>
              <Pressable
                onPress={onConfirmPurchase}
                style={[styles.modalBtn, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" }]}>
                  {t("plans.purchase", "Purchase")}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
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
  errorBox: { padding: 12, borderWidth: 1, borderRadius: 8 },
  errorText: { fontSize: 13, color: "#ef4444", lineHeight: 18 },
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
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
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
  restoreBtn: { alignItems: "center", paddingVertical: 12, marginTop: 4 },
  restoreText: { fontSize: 13 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalBox: { width: "100%", maxWidth: 360, padding: 24, gap: 16 },
  modalTitle: { fontSize: 18 },
  modalBody: { fontSize: 14, lineHeight: 21 },
  modalActions: { flexDirection: "row", gap: 12 },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  modalBtnText: { fontSize: 15 },
});
