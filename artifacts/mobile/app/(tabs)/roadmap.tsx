import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActiveGoalChip } from "@/components/ActiveGoalChip";
import { AdaptiveEngineCard } from "@/components/AdaptiveEngineCard";
import { AskCoachPill } from "@/components/AskCoachPill";
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
  const bottomTab = isWeb ? 84 : 90 + insets.bottom;

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
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [risksOpen, setRisksOpen] = useState(false);

  const latestEvolution = activeRoadmapEvolutions[0] ?? null;
  const updatedPhaseIds = useMemo(() => {
    if (!latestEvolution) return new Set<string>();
    return new Set(
      latestEvolution.phaseChanges
        .filter((p) => p.changeType === "added" || p.changeType === "modified")
        .map((p) => p.phaseId),
    );
  }, [latestEvolution]);

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
        <View style={styles.headerRow}>
          <AskCoachPill />
          <ActiveGoalChip />
        </View>

        <Text
          style={[
            styles.eyebrow,
            { color: colors.primary, fontFamily: "Inter_600SemiBold" },
          ]}
        >
          ROADMAP
        </Text>

        <SectionHeader
          title={activeRoadmap.headline}
          subtitle={`Week ${activeCurrentWeek} of ${activeRoadmap.totalWeeks}${goalLabel ? ` · ${goalLabel}` : ""}`}
        />

        <Text
          style={[
            styles.eyebrow,
            { color: colors.primary, fontFamily: "Inter_600SemiBold" },
          ]}
        >
          {activeRoadmap.totalWeeks}-WEEK ARC
        </Text>

        <View style={styles.phases}>
          {activeRoadmap.phases.map((phase, i) => {
            const status =
              activeCurrentWeek > phase.endWeek
                ? "completed"
                : activeCurrentWeek >= phase.startWeek
                  ? "active"
                  : "upcoming";
            return (
              <PhaseCard
                key={phase.id}
                phase={phase}
                index={i}
                status={status}
                updated={updatedPhaseIds.has(phase.id)}
              />
            );
          })}
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

        {/* STRATEGY — collapsible */}
        <View
          style={[
            styles.collapsibleCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <Pressable
            onPress={() => setStrategyOpen((v) => !v)}
            style={styles.collapsibleHeader}
            accessibilityRole="button"
          >
            <View style={styles.collapsibleLeft}>
              <Feather name="compass" size={15} color={colors.accent} />
              <Text
                style={[
                  styles.collapsibleLabel,
                  { color: colors.accent, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                STRATEGY
              </Text>
            </View>
            <Feather
              name={strategyOpen ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.mutedForeground}
            />
          </Pressable>
          {strategyOpen && (
            <Text
              style={[
                styles.collapsibleBody,
                { color: colors.foreground, fontFamily: "Inter_400Regular" },
              ]}
            >
              {activeRoadmap.strategy}
            </Text>
          )}
        </View>

        {/* RISKS TO WATCH — collapsible */}
        {activeRoadmap.riskAnalysis.length > 0 && (
          <View
            style={[
              styles.collapsibleCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Pressable
              onPress={() => setRisksOpen((v) => !v)}
              style={styles.collapsibleHeader}
              accessibilityRole="button"
            >
              <View style={styles.collapsibleLeft}>
                <Feather name="alert-triangle" size={15} color={colors.destructive} />
                <Text
                  style={[
                    styles.collapsibleLabel,
                    { color: colors.destructive, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  RISKS TO WATCH
                </Text>
              </View>
              <Feather
                name={risksOpen ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.mutedForeground}
              />
            </Pressable>
            {risksOpen && (
              <View style={styles.riskList}>
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
            )}
          </View>
        )}
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
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 4,
    gap: 12,
  },
  eyebrow: {
    fontSize: 10,
    letterSpacing: 1.6,
  },
  phases: {
    gap: 10,
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
    fontSize: 12.5,
    lineHeight: 17,
  },
  collapsibleCard: {
    borderWidth: 1,
    overflow: "hidden",
  },
  collapsibleHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  collapsibleLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  collapsibleLabel: {
    fontSize: 10,
    letterSpacing: 1.4,
  },
  collapsibleBody: {
    fontSize: 13.5,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  riskList: {
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  riskRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  riskDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 8,
  },
  riskText: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 19,
  },
});
