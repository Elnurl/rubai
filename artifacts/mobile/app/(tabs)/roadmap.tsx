import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActiveGoalChip } from "@/components/ActiveGoalChip";
import { AdaptiveEngineCard } from "@/components/AdaptiveEngineCard";
import { EmptyState } from "@/components/EmptyState";
import { PhaseCard } from "@/components/PhaseCard";
import { SectionHeader } from "@/components/SectionHeader";
import { profileGoalLabel } from "@/constants/atlas";
import { useColors } from "@/hooks/useColors";
import { useEvolveRoadmap } from "@/hooks/useEvolveRoadmap";
import { useAtlas } from "@/providers/AtlasProvider";

export default function RoadmapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 8;
  const bottomTab = isWeb ? 100 : 110;
  const {
    activeRoadmap,
    activeProfile,
    activeCurrentWeek,
    activeRoadmapEvolutions,
    activeLastEvolvedAt,
    activeBehavioralProfile,
  } = useAtlas();
  const { evolve, isEvolving } = useEvolveRoadmap();
  const [evolveError, setEvolveError] = useState<string | null>(null);
  const [lastNoChangeAt, setLastNoChangeAt] = useState<string | null>(null);

  const latestEvolution = activeRoadmapEvolutions[0] ?? null;
  // Phases that the most recent evolution flagged as added or modified, so we
  // can highlight them in the list below.
  const updatedPhaseIds = useMemo(() => {
    if (!latestEvolution) return new Set<string>();
    return new Set(
      latestEvolution.phaseChanges
        .filter((p) => p.changeType === "added" || p.changeType === "modified")
        .map((p) => p.phaseId),
    );
  }, [latestEvolution]);

  // Need at least one reflection AND a learned profile before evolution makes sense.
  const canEvolve = Boolean(activeRoadmap && activeBehavioralProfile);

  const onEvolve = async () => {
    if (!canEvolve || isEvolving) return;
    setEvolveError(null);
    try {
      const res = await evolve("manual");
      if (res && !res.changed) {
        setLastNoChangeAt(new Date().toISOString());
      } else {
        setLastNoChangeAt(null);
      }
    } catch {
      setEvolveError("Couldn't evolve the roadmap right now. Try again in a moment.");
    }
  };

  if (!activeRoadmap) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <EmptyState
          icon="map"
          title="No roadmap yet"
          description="Finish intake and rubai will generate your personalized roadmap."
        />
      </View>
    );
  }

  const goalLabel = activeProfile ? profileGoalLabel(activeProfile) : "";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad, paddingBottom: bottomTab },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <Text
            style={[
              styles.eyebrow,
              { color: colors.primary, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            ROADMAP
          </Text>
          <ActiveGoalChip />
        </View>
        <View style={styles.hero}>
          <SectionHeader
            title={activeRoadmap.headline}
            subtitle={`${activeRoadmap.totalWeeks} weeks${goalLabel ? ` • ${goalLabel}` : ""}`}
          />
          <Text
            style={[
              styles.summary,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {activeRoadmap.summary}
          </Text>
        </View>

        <AdaptiveEngineCard
          lastEvolvedAt={activeLastEvolvedAt}
          latest={latestEvolution}
          isEvolving={isEvolving}
          canEvolve={canEvolve}
          onEvolve={onEvolve}
        />

        {evolveError && (
          <View
            style={[
              styles.banner,
              {
                backgroundColor: colors.destructive + "15",
                borderColor: colors.destructive,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather name="alert-circle" size={14} color={colors.destructive} />
            <Text
              style={[
                styles.bannerText,
                { color: colors.destructive, fontFamily: "Inter_500Medium" },
              ]}
            >
              {evolveError}
            </Text>
          </View>
        )}

        {lastNoChangeAt && !evolveError && (
          <View
            style={[
              styles.banner,
              {
                backgroundColor: colors.muted,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather name="check-circle" size={14} color={colors.mutedForeground} />
            <Text
              style={[
                styles.bannerText,
                { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
              ]}
            >
              Checked — your roadmap is still the right shape for now.
            </Text>
          </View>
        )}

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
            {activeRoadmap.strategy}
          </Text>
        </View>

        <View style={styles.phases}>
          {activeRoadmap.phases.map((phase, i) => (
            <PhaseCard
              key={phase.id}
              phase={phase}
              index={i}
              isActive={
                activeCurrentWeek >= phase.startWeek &&
                activeCurrentWeek <= phase.endWeek
              }
              updated={updatedPhaseIds.has(phase.id)}
            />
          ))}
        </View>

        {activeRoadmap.riskAnalysis.length > 0 && (
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
              {activeRoadmap.riskAnalysis.map((risk, i) => (
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
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
    gap: 12,
  },
  hero: {
    gap: 10,
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
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderWidth: 1,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
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
