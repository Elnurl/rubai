import { Feather } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import type { RoadmapEvolutionEntry } from "@/types/atlas";

type Props = {
  lastEvolvedAt: string | null;
  latest: RoadmapEvolutionEntry | null;
  isEvolving: boolean;
  canEvolve: boolean;
  onEvolve: () => void;
};

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  return `${weeks}w ago`;
}

export function AdaptiveEngineCard({
  lastEvolvedAt,
  latest,
  isEvolving,
  canEvolve,
  onEvolve,
}: Props) {
  const colors = useColors();
  const [expanded, setExpanded] = useState(false);

  const phaseChanges = useMemo(
    () => (latest?.phaseChanges ?? []).filter((p) => p.changeType !== "unchanged"),
    [latest],
  );

  const hasHistory = Boolean(latest);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderRadius: colors.radius,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={[styles.iconCircle, { backgroundColor: colors.accent + "20" }]}>
            <Feather name="zap" size={14} color={colors.accent} />
          </View>
          <View style={styles.headerText}>
            <Text
              style={[
                styles.eyebrow,
                { color: colors.accent, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              ADAPTIVE ENGINE
            </Text>
            <Text
              style={[
                styles.lastUpdated,
                { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
              ]}
            >
              Last evolved {formatRelative(lastEvolvedAt)}
            </Text>
          </View>
        </View>
      </View>

      {hasHistory && latest && (
        <Text
          style={[
            styles.summary,
            { color: colors.foreground, fontFamily: "Inter_400Regular" },
          ]}
        >
          {latest.changeSummary}
        </Text>
      )}

      {!hasHistory && (
        <Text
          style={[
            styles.summary,
            { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
          ]}
        >
          As you reflect on tasks, rubai learns how you actually execute and
          updates this roadmap to match. Tap below to evolve it manually.
        </Text>
      )}

      {hasHistory && phaseChanges.length > 0 && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setExpanded((v) => !v)}
          style={styles.expandRow}
        >
          <Text
            style={[
              styles.expandText,
              { color: colors.primary, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {expanded ? "Hide what changed" : "View what changed"}
          </Text>
          <Feather
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={colors.primary}
          />
        </Pressable>
      )}

      {expanded && hasHistory && latest && (
        <View style={styles.changesBox}>
          {phaseChanges.map((change) => (
            <View key={`${change.phaseId}-${change.changeType}`} style={styles.changeRow}>
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
              <View style={styles.changeBody}>
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
          {latest.rationale ? (
            <View style={[styles.rationaleBox, { borderColor: colors.border }]}>
              <Text
                style={[
                  styles.rationaleLabel,
                  { color: colors.mutedForeground, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                WHY
              </Text>
              <Text
                style={[
                  styles.rationaleText,
                  { color: colors.foreground, fontFamily: "Inter_400Regular" },
                ]}
              >
                {latest.rationale}
              </Text>
            </View>
          ) : null}
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Evolve roadmap now"
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
            color={
              !canEvolve ? colors.mutedForeground : colors.primaryForeground
            }
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
          {isEvolving ? "Evolving roadmap…" : "Evolve roadmap now"}
        </Text>
      </Pressable>

      {!canEvolve && !isEvolving && (
        <Text
          style={[
            styles.helperText,
            { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
          ]}
        >
          Add a couple of reflections in Today first so rubai has signal to learn from.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    borderWidth: 1,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    gap: 2,
    flex: 1,
  },
  eyebrow: {
    fontSize: 10.5,
    letterSpacing: 1.4,
  },
  lastUpdated: {
    fontSize: 12,
  },
  summary: {
    fontSize: 14.5,
    lineHeight: 21,
  },
  expandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  expandText: {
    fontSize: 13,
  },
  changesBox: {
    gap: 12,
    paddingTop: 4,
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
  changeBody: {
    flex: 1,
    gap: 2,
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
  evolveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
  },
  evolveBtnText: {
    fontSize: 14,
    letterSpacing: 0.3,
  },
  helperText: {
    fontSize: 12.5,
    lineHeight: 18,
    textAlign: "center",
  },
});
