import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { useColors } from "@/hooks/useColors";
import type { RoadmapPhase } from "@workspace/api-client-react";

export type PhaseStatus = "completed" | "active" | "upcoming";

type Props = {
  phase: RoadmapPhase;
  index: number;
  status: PhaseStatus;
  /** Hide the connecting line beneath the marker for the last phase. */
  isLast?: boolean;
  /** When true, renders a subtle "Updated" badge to flag a phase the AI just modified. */
  updated?: boolean;
};

export function PhaseCard({
  phase,
  index,
  status,
  isLast = false,
  updated = false,
}: Props) {
  const colors = useColors();
  const isActive = status === "active";
  const isCompleted = status === "completed";
  const milestoneCount = phase.milestones.length;
  const hasMilestones = milestoneCount > 0;
  // Active phase opens its milestones by default. Other phases stay
  // collapsed so the timeline reads as a quick scannable list — matching
  // the design reference.
  const [expanded, setExpanded] = useState(isActive);

  const chevronRotation = useSharedValue(isActive ? 180 : 0);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value}deg` }],
  }));

  const toggle = () => {
    if (!hasMilestones) return;
    const next = !expanded;
    setExpanded(next);
    chevronRotation.value = withTiming(next ? 180 : 0, { duration: 180 });
  };

  // Tiny dot on the rail — bright primary for active, muted ring for the
  // rest, filled primary for completed.
  const dotBg = isActive
    ? colors.primary
    : isCompleted
      ? colors.primary
      : colors.card;
  const dotBorder = isActive || isCompleted ? colors.primary : colors.border;

  const connectorColor = isCompleted ? colors.primary : colors.border;

  // "Week N" if single-week phase, "Week N – M" otherwise.
  const weekLabel =
    phase.startWeek === phase.endWeek
      ? `Week ${phase.startWeek}`
      : `Week ${phase.startWeek}–${phase.endWeek}`;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(320)}
      style={styles.row}
    >
      {/* Left rail — small dot, line down to next phase */}
      <View style={styles.rail}>
        <View
          style={[
            styles.dot,
            {
              backgroundColor: dotBg,
              borderColor: dotBorder,
            },
            isActive && {
              shadowColor: colors.primary,
              shadowOpacity: 0.45,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 0 },
              elevation: 4,
            },
          ]}
        />
        {!isLast && (
          <View
            style={[styles.connector, { backgroundColor: connectorColor }]}
          />
        )}
      </View>

      {/* Card */}
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderColor: isActive ? colors.primary : colors.border,
            borderRadius: colors.radius,
            borderWidth: isActive ? 1.5 : 1,
          },
        ]}
      >
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${weekLabel} ${phase.title}, ${expanded ? "collapse" : "expand"}`}
          android_ripple={{ color: colors.muted }}
          style={({ pressed }) => [
            styles.header,
            pressed && hasMilestones && { opacity: 0.7 },
          ]}
        >
          <View style={styles.titleRow}>
            <Text
              style={[
                styles.title,
                { color: colors.foreground, fontFamily: "Inter_700Bold" },
              ]}
              numberOfLines={expanded ? undefined : 2}
              ellipsizeMode="tail"
            >
              <Text style={{ color: colors.foreground }}>
                {weekLabel}
              </Text>
              <Text style={{ color: colors.mutedForeground }}> · </Text>
              {phase.title}
            </Text>
            <View style={styles.headerChips}>
              {updated && (
                <View
                  style={[
                    styles.updatedChip,
                    {
                      borderColor: colors.accent,
                      backgroundColor: colors.accent + "15",
                    },
                  ]}
                >
                  <Feather name="zap" size={10} color={colors.accent} />
                  <Text
                    style={[
                      styles.chipText,
                      { color: colors.accent, fontFamily: "Inter_600SemiBold" },
                    ]}
                  >
                    UPDATED
                  </Text>
                </View>
              )}
              {isActive && (
                <View
                  style={[
                    styles.activeChip,
                    { backgroundColor: colors.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: colors.primaryForeground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    NOW
                  </Text>
                </View>
              )}
              {isCompleted && (
                <View
                  style={[
                    styles.doneChip,
                    {
                      borderColor: colors.primary,
                      backgroundColor: colors.primary + "15",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: colors.primary,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    DONE
                  </Text>
                </View>
              )}
              {hasMilestones && (
                <Animated.View style={chevronStyle}>
                  <Feather
                    name="chevron-down"
                    size={18}
                    color={colors.mutedForeground}
                  />
                </Animated.View>
              )}
            </View>
          </View>

          {phase.focus ? (
            <Text
              style={[
                styles.focus,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              {phase.focus}
            </Text>
          ) : null}
        </Pressable>

        {expanded && hasMilestones && (
          <Animated.View entering={FadeIn.duration(180)} style={styles.body}>
            {phase.milestones.map((m) => (
              <View key={m.id} style={styles.milestoneRow}>
                <View
                  style={[
                    styles.milestoneDot,
                    {
                      backgroundColor: isActive
                        ? colors.primary
                        : colors.mutedForeground + "55",
                    },
                  ]}
                />
                <View style={styles.milestoneText}>
                  <Text
                    style={[
                      styles.milestoneTitle,
                      {
                        color: colors.foreground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    {m.title}
                  </Text>
                  <Text
                    style={[
                      styles.milestoneDescription,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {m.description}
                  </Text>
                  <View style={styles.weekTag}>
                    <Feather
                      name="calendar"
                      size={11}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.weekTagText,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      Week {m.weekNumber}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </Animated.View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const DOT_SIZE = 12;
const RAIL_WIDTH = 28;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  rail: {
    width: RAIL_WIDTH,
    alignItems: "center",
    paddingTop: 18,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 2,
  },
  connector: {
    width: 2,
    flex: 1,
    marginTop: 4,
    marginBottom: -16,
    borderRadius: 1,
  },
  card: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    marginLeft: 2,
  },
  header: {
    gap: 6,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: -0.1,
  },
  headerChips: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 1,
  },
  activeChip: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  doneChip: {
    paddingHorizontal: 9,
    paddingVertical: 2.5,
    borderRadius: 999,
    borderWidth: 1,
  },
  updatedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 9.5,
    letterSpacing: 1.2,
  },
  focus: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  body: {
    gap: 12,
    paddingTop: 6,
  },
  milestoneRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  milestoneDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 7,
  },
  milestoneText: {
    flex: 1,
    gap: 3,
  },
  milestoneTitle: {
    fontSize: 14,
  },
  milestoneDescription: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  weekTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  weekTagText: {
    fontSize: 11,
    letterSpacing: 0.3,
  },
});
