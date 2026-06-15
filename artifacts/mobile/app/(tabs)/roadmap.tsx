import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ActiveGoalChip } from "@/components/ActiveGoalChip";
import { AskCoachPill } from "@/components/AskCoachPill";
import { EmptyState } from "@/components/EmptyState";
import { PhaseCard } from "@/components/PhaseCard";
import { SectionHeader } from "@/components/SectionHeader";
import { profileGoalLabel } from "@/constants/atlas";
import { useColors } from "@/hooks/useColors";
import { useEvolveRoadmap } from "@/hooks/useEvolveRoadmap";
import i18n from "@/lib/i18n";
import { useAtlas } from "@/providers/AtlasProvider";

function formatRelative(iso: string | null): string {
  if (!iso) return i18n.t("roadmap.never", "Never");
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return i18n.t("roadmap.justNow", "Just now");
  if (minutes < 60) return i18n.t("roadmap.minutesAgo", "{{minutes}}m ago", { minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return i18n.t("roadmap.hoursAgo", "{{hours}}h ago", { hours });
  const days = Math.round(hours / 24);
  if (days < 7) return i18n.t("roadmap.daysAgo", "{{days}}d ago", { days });
  const weeks = Math.round(days / 7);
  return i18n.t("roadmap.weeksAgo", "{{weeks}}w ago", { weeks });
}

export default function RoadmapScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 8;
  const bottomTab = isWeb ? 74 : 70 + insets.bottom;

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
  // All three collapsible sections: Adaptive Engine open by default.
  const [adaptiveOpen, setAdaptiveOpen] = useState(true);
  const [strategyOpen, setStrategyOpen] = useState(false);
  const [risksOpen, setRisksOpen] = useState(false);
  // Sub-expand for phase changes inside the adaptive section.
  const [changesOpen, setChangesOpen] = useState(false);

  const latestEvolution = activeRoadmapEvolutions[0] ?? null;
  const updatedPhaseIds = useMemo(() => {
    if (!latestEvolution) return new Set<string>();
    return new Set(
      latestEvolution.phaseChanges
        .filter((p) => p.changeType === "added" || p.changeType === "modified")
        .map((p) => p.phaseId),
    );
  }, [latestEvolution]);

  const phaseChanges = useMemo(
    () => (latestEvolution?.phaseChanges ?? []).filter((p) => p.changeType !== "unchanged"),
    [latestEvolution],
  );

  const canEvolve = Boolean(activeRoadmap && activeBehavioralProfile);
  const hasHistory = Boolean(latestEvolution);

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
      setEvolveError(t("roadmap.evolveError", "Couldn't evolve the roadmap right now. Try again in a moment."));
    }
  };

  if (!activeRoadmap) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: topPad }]}>
        <EmptyState
          icon="map"
          title={t("roadmap.emptyTitle", "No roadmap yet")}
          description={t("roadmap.emptyDesc", "Finish intake and rubai will generate your personalized roadmap.")}
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
          {t("roadmap.eyebrow", "ROADMAP")}
        </Text>

        <SectionHeader
          title={activeRoadmap.headline}
          subtitle={goalLabel
            ? t("roadmap.weekOfWithGoal", "Week {{week}} of {{total}} · {{goal}}", { week: activeCurrentWeek, total: activeRoadmap.totalWeeks, goal: goalLabel })
            : t("roadmap.weekOf", "Week {{week}} of {{total}}", { week: activeCurrentWeek, total: activeRoadmap.totalWeeks })}
        />

        <Text
          style={[
            styles.eyebrow,
            { color: colors.primary, fontFamily: "Inter_600SemiBold" },
          ]}
        >
          {t("roadmap.weekArc", "{{weeks}}-WEEK ARC", { weeks: activeRoadmap.totalWeeks })}
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

        {/* ── ADAPTIVE ENGINE — collapsible, open by default ── */}
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
            onPress={() => setAdaptiveOpen((v) => !v)}
            style={styles.collapsibleHeader}
            accessibilityRole="button"
          >
            <View style={styles.collapsibleLeft}>
              <Feather name="zap" size={15} color={colors.accent} />
              <View style={{ gap: 1 }}>
                <Text
                  style={[
                    styles.collapsibleLabel,
                    { color: colors.accent, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  {t("roadmap.adaptiveEngine", "ADAPTIVE ENGINE")}
                </Text>
                <Text
                  style={[
                    styles.collapsibleSub,
                    { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
                  ]}
                >
                  {t("roadmap.lastEvolved", "Last evolved {{when}}", { when: formatRelative(activeLastEvolvedAt) })}
                </Text>
              </View>
            </View>
            <Feather
              name={adaptiveOpen ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.mutedForeground}
            />
          </Pressable>

          {adaptiveOpen && (
            <View style={styles.adaptiveBody}>
              {/* Description / last change summary */}
              {hasHistory && latestEvolution ? (
                <Text
                  style={[
                    styles.collapsibleBody,
                    { color: colors.foreground, fontFamily: "Inter_400Regular" },
                  ]}
                >
                  {latestEvolution.changeSummary}
                </Text>
              ) : (
                <Text
                  style={[
                    styles.collapsibleBody,
                    { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
                  ]}
                >
                  {t("roadmap.adaptiveEmpty", "As you reflect on tasks, rubai learns how you actually execute and updates this roadmap to match.")}
                </Text>
              )}

              {/* Phase changes sub-expand */}
              {hasHistory && phaseChanges.length > 0 && (
                <>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setChangesOpen((v) => !v)}
                    style={styles.subExpandRow}
                  >
                    <Text
                      style={[
                        styles.subExpandText,
                        { color: colors.primary, fontFamily: "Inter_600SemiBold" },
                      ]}
                    >
                      {changesOpen ? t("roadmap.hideChanges", "Hide what changed") : t("roadmap.viewChanges", "View what changed")}
                    </Text>
                    <Feather
                      name={changesOpen ? "chevron-up" : "chevron-down"}
                      size={15}
                      color={colors.primary}
                    />
                  </Pressable>

                  {changesOpen && (
                    <View style={styles.changesBox}>
                      {phaseChanges.map((change) => (
                        <View
                          key={`${change.phaseId}-${change.changeType}`}
                          style={styles.changeRow}
                        >
                          <View
                            style={[
                              styles.changeBadge,
                              {
                                backgroundColor:
                                  change.changeType === "added"
                                    ? colors.primary + "20"
                                    : change.changeType === "removed"
                                      ? colors.destructive + "20"
                                      : colors.accent + "20",
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.changeBadgeText,
                                {
                                  color:
                                    change.changeType === "added"
                                      ? colors.primary
                                      : change.changeType === "removed"
                                        ? colors.destructive
                                        : colors.accent,
                                  fontFamily: "Inter_600SemiBold",
                                },
                              ]}
                            >
                              {change.changeType.toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text
                              style={[
                                styles.changeTitle,
                                { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
                              ]}
                            >
                              {change.phaseTitle}
                            </Text>
                            <Text
                              style={[
                                styles.changeSummary,
                                { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
                              ]}
                            >
                              {change.summary}
                            </Text>
                          </View>
                        </View>
                      ))}
                      {latestEvolution?.rationale ? (
                        <View
                          style={[styles.rationaleBox, { borderColor: colors.border }]}
                        >
                          <Text
                            style={[
                              styles.rationaleLabel,
                              {
                                color: colors.mutedForeground,
                                fontFamily: "Inter_600SemiBold",
                              },
                            ]}
                          >
                            {t("roadmap.why", "WHY")}
                          </Text>
                          <Text
                            style={[
                              styles.rationaleText,
                              { color: colors.foreground, fontFamily: "Inter_400Regular" },
                            ]}
                          >
                            {latestEvolution.rationale}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  )}
                </>
              )}

              {/* Error / no-change banners */}
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
                    {t("roadmap.noChange", "Checked — your roadmap is still the right shape for now.")}
                  </Text>
                </View>
              )}

              {/* Evolve button */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("roadmap.evolveNowA11y", "Evolve roadmap now")}
                disabled={!canEvolve || isEvolving}
                onPress={onEvolve}
                style={({ pressed }) => [
                  styles.evolveBtn,
                  {
                    backgroundColor:
                      !canEvolve || isEvolving ? colors.muted : colors.primary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                {isEvolving ? (
                  <ActivityIndicator size="small" color={colors.primaryForeground} />
                ) : (
                  <Feather
                    name="refresh-cw"
                    size={14}
                    color={!canEvolve ? colors.mutedForeground : colors.primaryForeground}
                  />
                )}
                <Text
                  style={[
                    styles.evolveBtnText,
                    {
                      color:
                        !canEvolve || isEvolving
                          ? colors.mutedForeground
                          : colors.primaryForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {isEvolving ? t("roadmap.evolving", "Evolving roadmap…") : t("roadmap.evolveNow", "Evolve roadmap now")}
                </Text>
              </Pressable>

              {!canEvolve && !isEvolving && (
                <Text
                  style={[
                    styles.helperText,
                    { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
                  ]}
                >
                  {t("roadmap.evolveHelper", "Add a couple of reflections in Today first so rubai has signal to learn from.")}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* ── STRATEGY — collapsible ── */}
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
                {t("roadmap.strategy", "STRATEGY")}
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

        {/* ── RISKS TO WATCH — collapsible ── */}
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
                  {t("roadmap.risks", "RISKS TO WATCH")}
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
    flex: 1,
  },
  collapsibleLabel: {
    fontSize: 10,
    letterSpacing: 1.4,
  },
  collapsibleSub: {
    fontSize: 11,
  },
  collapsibleBody: {
    fontSize: 13.5,
    lineHeight: 20,
    paddingHorizontal: 14,
    paddingBottom: 4,
  },
  adaptiveBody: {
    gap: 12,
    paddingBottom: 14,
  },
  subExpandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
  },
  subExpandText: {
    fontSize: 13,
  },
  changesBox: {
    gap: 12,
    paddingHorizontal: 14,
  },
  changeRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
  },
  changeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    marginTop: 2,
  },
  changeBadgeText: {
    fontSize: 9.5,
    letterSpacing: 1.2,
  },
  changeTitle: {
    fontSize: 14,
  },
  changeSummary: {
    fontSize: 13,
    lineHeight: 19,
  },
  rationaleBox: {
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 4,
  },
  rationaleLabel: {
    fontSize: 10,
    letterSpacing: 1.3,
  },
  rationaleText: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderWidth: 1,
    marginHorizontal: 14,
  },
  bannerText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
  },
  evolveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginHorizontal: 14,
  },
  evolveBtnText: {
    fontSize: 14.5,
    letterSpacing: 0.3,
  },
  helperText: {
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: 14,
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
