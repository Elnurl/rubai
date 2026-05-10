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
  // Active phase is open by default — that's the one the user actually
  // needs to read right now. Everything else is collapsed to keep the
  // roadmap scannable instead of an overwhelming wall of text.
  const [expanded, setExpanded] = useState(isActive);
  const milestoneCount = phase.milestones.length;

  const chevronRotation = useSharedValue(isActive ? 180 : 0);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value}deg` }],
  }));

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    chevronRotation.value = withTiming(next ? 180 : 0, { duration: 180 });
  };

  // Marker visual states
  const markerBg = isActive
    ? colors.primary
    : isCompleted
      ? colors.primary + "22"
      : colors.card;
  const markerBorder = isActive
    ? colors.primary
    : isCompleted
      ? colors.primary
      : colors.border;
  const markerFg = isActive
    ? colors.primaryForeground
    : isCompleted
      ? colors.primary
      : colors.mutedForeground;

  // Connector line: solid primary if the phase ABOVE this connector is
  // completed (i.e. progress has flowed through it), muted otherwise.
  const connectorColor = isCompleted ? colors.primary : colors.border;

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(320)}
      style={styles.row}
    >
      {/* Left rail — marker on top, line down to next phase */}
      <View style={styles.rail}>
        <View
          style={[
            styles.marker,
            {
              backgroundColor: markerBg,
              borderColor: markerBorder,
            },
            isActive && {
              shadowColor: colors.primary,
              shadowOpacity: 0.35,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 0 },
              elevation: 4,
            },
          ]}
        >
          {isCompleted ? (
            <Feather name="check" size={16} color={markerFg} />
          ) : (
            <Text
              style={[
                styles.markerText,
                { color: markerFg, fontFamily: "Inter_700Bold" },
              ]}
            >
              {String(index + 1).padStart(2, "0")}
            </Text>
          )}
        </View>
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
            borderWidth: isActive ? 2 : 1,
          },
        ]}
      >
        <Pressable
          onPress={toggle}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`${phase.title}, ${expanded ? "collapse" : "expand"}`}
          android_ripple={{ color: colors.muted }}
          style={({ pressed }) => [
            styles.header,
            pressed && { opacity: 0.7 },
          ]}
        >
          <View style={styles.headerText}>
            <Text
              style={[
                styles.title,
                { color: colors.foreground, fontFamily: "Inter_700Bold" },
              ]}
              numberOfLines={2}
            >
              {phase.title}
            </Text>
            <Text
              style={[
                styles.weeks,
                { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
              ]}
            >
              Week {phase.startWeek} – Week {phase.endWeek}
              {milestoneCount > 0
                ? ` • ${milestoneCount} milestone${milestoneCount === 1 ? "" : "s"}`
                : ""}
            </Text>
          </View>
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
                style={[styles.activeChip, { backgroundColor: colors.primary }]}
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
            <Animated.View style={chevronStyle}>
              <Feather
                name="chevron-down"
                size={20}
                color={colors.mutedForeground}
              />
            </Animated.View>
          </View>
        </Pressable>

        {expanded && (
          <Animated.View entering={FadeIn.duration(180)} style={styles.body}>
            <Text
              style={[
                styles.focus,
                { color: colors.foreground, fontFamily: "Inter_400Regular" },
              ]}
            >
              {phase.focus}
            </Text>

            {milestoneCount > 0 && (
              <View style={styles.milestones}>
                {phase.milestones.map((m) => (
                  <View key={m.id} style={styles.milestoneRow}>
                    <View
                      style={[
                        styles.dot,
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
              </View>
            )}
          </Animated.View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

const MARKER_SIZE = 36;
const RAIL_WIDTH = 44;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  rail: {
    width: RAIL_WIDTH,
    alignItems: "center",
    paddingTop: 14,
  },
  marker: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    borderRadius: MARKER_SIZE / 2,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  markerText: {
    fontSize: 12,
    letterSpacing: 1,
  },
  connector: {
    width: 2,
    flex: 1,
    marginTop: 6,
    marginBottom: -16,
    borderRadius: 1,
  },
  card: {
    flex: 1,
    padding: 14,
    gap: 12,
    marginLeft: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 16,
    lineHeight: 21,
  },
  weeks: {
    fontSize: 12,
    letterSpacing: 0.3,
  },
  headerChips: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  activeChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  doneChip: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  updatedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 10,
    letterSpacing: 1.4,
  },
  body: {
    gap: 14,
    paddingTop: 4,
  },
  focus: {
    fontSize: 14.5,
    lineHeight: 21,
  },
  milestones: {
    gap: 12,
  },
  milestoneRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 7,
  },
  milestoneText: {
    flex: 1,
    gap: 3,
  },
  milestoneTitle: {
    fontSize: 14.5,
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
