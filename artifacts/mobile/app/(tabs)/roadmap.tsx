import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { EmptyState } from "@/components/EmptyState";
import { PhaseCard } from "@/components/PhaseCard";
import { SectionHeader } from "@/components/SectionHeader";
import { GOAL_META } from "@/constants/atlas";
import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";

export default function RoadmapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 8;
  const bottomTab = isWeb ? 100 : 110;
  const { roadmap, currentWeek, profile } = useAtlas();

  if (!roadmap) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <EmptyState
          icon="map"
          title="No roadmap yet"
          description="Finish onboarding and Atlas will generate your personalized roadmap."
        />
      </View>
    );
  }

  const goalLabel = profile ? GOAL_META[profile.goalType].label : "";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad, paddingBottom: bottomTab },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text
            style={[
              styles.eyebrow,
              { color: colors.primary, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            ROADMAP
          </Text>
          <SectionHeader
            title={roadmap.headline}
            subtitle={`${roadmap.totalWeeks} weeks${goalLabel ? ` • ${goalLabel}` : ""}`}
          />
          <Text
            style={[
              styles.summary,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {roadmap.summary}
          </Text>
        </View>

        <View
          style={[
            styles.strategyCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <View style={styles.strategyHeader}>
            <Feather name="compass" size={16} color={colors.accent} />
            <Text
              style={[
                styles.strategyLabel,
                { color: colors.accent, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              STRATEGY
            </Text>
          </View>
          <Text
            style={[
              styles.strategyText,
              { color: colors.foreground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {roadmap.strategy}
          </Text>
        </View>

        <View style={styles.phases}>
          {roadmap.phases.map((phase, i) => (
            <PhaseCard
              key={phase.id}
              phase={phase}
              index={i}
              isActive={
                currentWeek >= phase.startWeek && currentWeek <= phase.endWeek
              }
            />
          ))}
        </View>

        {roadmap.riskAnalysis.length > 0 && (
          <View
            style={[
              styles.risksCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <View style={styles.strategyHeader}>
              <Feather name="alert-triangle" size={16} color={colors.destructive} />
              <Text
                style={[
                  styles.strategyLabel,
                  { color: colors.destructive, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                RISKS TO WATCH
              </Text>
            </View>
            <View style={styles.risks}>
              {roadmap.riskAnalysis.map((risk, i) => (
                <View key={i} style={styles.riskRow}>
                  <View style={[styles.riskDot, { backgroundColor: colors.destructive }]} />
                  <Text
                    style={[
                      styles.riskText,
                      { color: colors.foreground, fontFamily: "Inter_400Regular" },
                    ]}
                  >
                    {risk}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: {
    paddingHorizontal: 22,
    gap: 20,
  },
  hero: {
    gap: 10,
    paddingTop: 4,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1.6,
  },
  summary: {
    fontSize: 15,
    lineHeight: 22,
  },
  strategyCard: {
    padding: 18,
    borderWidth: 1,
    gap: 10,
  },
  strategyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  strategyLabel: {
    fontSize: 11,
    letterSpacing: 1.4,
  },
  strategyText: {
    fontSize: 14.5,
    lineHeight: 21,
  },
  phases: {
    gap: 12,
  },
  risksCard: {
    padding: 18,
    borderWidth: 1,
    gap: 12,
  },
  risks: {
    gap: 10,
  },
  riskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  riskDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 8,
  },
  riskText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});
