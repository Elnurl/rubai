import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
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
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";

export default function CoachMemoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { t } = useTranslation();
  const { activeCoachMemory, setActiveCoachMemory, activeGoal } = useAtlas();

  const [clearing, setClearing] = useState(false);

  const memory = activeCoachMemory;
  const facts = memory?.facts ?? [];
  const updatedAt = memory?.updatedAt
    ? new Date(memory.updatedAt).toLocaleDateString(undefined, {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const handleClear = () => {
    if (Platform.OS === "web") {
      if (window.confirm(t("coachMemory.confirmClearWeb", "Coach memory will be cleared. This cannot be undone."))) {
        void doClear();
      }
      return;
    }
    Alert.alert(
      t("coachMemory.confirmClearTitle", "Clear all memory?"),
      t("coachMemory.confirmClearBody", "RubAI will forget everything it has learned about you. This cannot be undone."),
      [
        { text: t("coachMemory.cancel", "Cancel"), style: "cancel" },
        {
          text: t("coachMemory.clearMemory", "Clear memory"),
          style: "destructive",
          onPress: () => void doClear(),
        },
      ],
    );
  };

  const doClear = async () => {
    setClearing(true);
    try {
      await setActiveCoachMemory(null);
    } finally {
      setClearing(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 8,
          paddingBottom: 48,
          paddingHorizontal: 22,
          gap: 20,
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
            style={[
              styles.headerTitle,
              { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {t("coachMemory.headerTitle", "Coach Memory")}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        {/* Explanation card */}
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.cardIconRow}>
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: colors.primary + "18" },
              ]}
            >
              <Feather name="cpu" size={18} color={colors.primary} />
            </View>
            <Text
              style={[
                styles.cardTitle,
                { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              {t("coachMemory.whatRemembers", "What RubAI remembers")}
            </Text>
          </View>
          <Text
            style={[
              styles.cardBody,
              {
                color: colors.mutedForeground,
                fontFamily: "Inter_400Regular",
              },
            ]}
          >
            {t("coachMemory.cardBody", "Your coach builds a private memory of facts and context you share across conversations. This helps it give you more relevant, personal guidance over time — without you having to repeat yourself.")}
          </Text>
        </View>

        {memory ? (
          <>
            {/* Summary section */}
            <Animated.View entering={FadeInDown.duration(280).delay(60)}>
              <Text
                style={[
                  styles.sectionLabel,
                  { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {t("coachMemory.summary", "SUMMARY")}
              </Text>
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <Text
                  style={[
                    styles.summaryText,
                    { color: colors.foreground, fontFamily: "Inter_400Regular" },
                  ]}
                >
                  {memory.summary}
                </Text>
                {updatedAt ? (
                  <Text
                    style={[
                      styles.updatedAt,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {t("coachMemory.lastUpdated", "Last updated {{updatedAt}}", { updatedAt })}
                  </Text>
                ) : null}
              </View>
            </Animated.View>

            {/* Facts section */}
            {facts.length > 0 ? (
              <Animated.View
                entering={FadeInDown.duration(280).delay(120)}
                style={{ gap: 10 }}
              >
                <Text
                  style={[
                    styles.sectionLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {t("coachMemory.rememberedFacts", "REMEMBERED FACTS ({{count}})", { count: facts.length })}
                </Text>
                <View style={styles.factsList}>
                  {facts.map((fact, i) => (
                    <Animated.View
                      key={fact}
                      entering={FadeInDown.duration(220).delay(140 + i * 30)}
                      style={[
                        styles.factRow,
                        {
                          backgroundColor: colors.card,
                          borderColor: colors.border,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.factDot,
                          { backgroundColor: colors.primary + "60" },
                        ]}
                      />
                      <Text
                        style={[
                          styles.factText,
                          {
                            color: colors.foreground,
                            fontFamily: "Inter_400Regular",
                          },
                        ]}
                      >
                        {fact}
                      </Text>
                    </Animated.View>
                  ))}
                </View>
              </Animated.View>
            ) : null}

            {/* Goal context */}
            {activeGoal?.profile?.goalType ? (
              <Animated.View entering={FadeInDown.duration(280).delay(180)}>
                <Text
                  style={[
                    styles.sectionLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {t("coachMemory.activeGoal", "ACTIVE GOAL")}
                </Text>
                <View
                  style={[
                    styles.card,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <View style={styles.goalRow}>
                    <View
                      style={[
                        styles.iconCircle,
                        { backgroundColor: colors.primary + "18" },
                      ]}
                    >
                      <Feather name="target" size={15} color={colors.primary} />
                    </View>
                    <Text
                      style={[
                        styles.goalText,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      {activeGoal.profile.goalType}
                    </Text>
                  </View>
                </View>
              </Animated.View>
            ) : null}

            {/* Clear button */}
            <Animated.View entering={FadeInDown.duration(280).delay(240)}>
              <Pressable
                onPress={handleClear}
                disabled={clearing}
                style={({ pressed }) => [
                  styles.clearBtn,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.destructive + "50",
                    opacity: pressed || clearing ? 0.7 : 1,
                  },
                ]}
              >
                <Feather
                  name="trash-2"
                  size={15}
                  color={colors.destructive}
                />
                <Text
                  style={[
                    styles.clearBtnText,
                    {
                      color: colors.destructive,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {clearing ? t("coachMemory.clearing", "Clearing…") : t("coachMemory.clearAllMemory", "Clear all memory")}
                </Text>
              </Pressable>
            </Animated.View>
          </>
        ) : (
          /* Empty state */
          <Animated.View
            entering={FadeInDown.duration(300).delay(80)}
            style={[
              styles.emptyCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.emptyIconCircle,
                { backgroundColor: colors.muted },
              ]}
            >
              <Feather name="inbox" size={28} color={colors.mutedForeground} />
            </View>
            <Text
              style={[
                styles.emptyTitle,
                { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              {t("coachMemory.emptyTitle", "No memory yet")}
            </Text>
            <Text
              style={[
                styles.emptyBody,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              {t("coachMemory.emptyBody", "Start a conversation with your coach. As you chat, RubAI will quietly build up a memory of what matters most to you.")}
            </Text>
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
  },
  headerTitle: {
    fontSize: 16,
    letterSpacing: -0.2,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  cardIconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 15,
  },
  cardBody: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 8,
  },
  summaryText: {
    fontSize: 14.5,
    lineHeight: 22,
  },
  updatedAt: {
    fontSize: 11.5,
    marginTop: 4,
  },
  factsList: {
    gap: 8,
  },
  factRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  factDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginTop: 7,
    flexShrink: 0,
  },
  factText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
  goalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  goalText: {
    flex: 1,
    fontSize: 14.5,
    lineHeight: 20,
  },
  clearBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  clearBtnText: {
    fontSize: 14.5,
  },
  emptyCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
    gap: 12,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    letterSpacing: -0.2,
  },
  emptyBody: {
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
  },
});
