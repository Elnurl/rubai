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
  /** When true, renders a subtle "Updated" badge to flag a phase the AI just modified. */
  updated?: boolean;
};

export function PhaseCard({ phase, index, status, updated = false }: Props) {
  const colors = useColors();
  const isActive = status === "active";
  const isCompleted = status === "completed";
  // Every phase starts collapsed so the roadmap reads as a clean, scannable
  // list of headers instead of a wall of text. The focus + milestones only
  // appear when the user taps a card open.
  const [expanded, setExpanded] = useState(false);
  const milestoneCount = phase.milestones.length;

  const chevronRotation = useSharedValue(0);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value}deg` }],
  }));

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    chevronRotation.value = withTiming(next ? 180 : 0, { duration: 180 });
  };

  const milestoneRingColor = isActive
    ? colors.primary
    : colors.mutedForeground + "88";

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(320)}
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: isActive ? colors.primary : colors.border,
          borderRadius: colors.radius,
          borderWidth: isActive ? 1.5 : 1,
        },
        isActive && {
          shadowColor: colors.primary,
          shadowOpacity: 0.18,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 0 },
          elevation: 3,
        },
      ]}
    >
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${phase.title}, ${expanded ? "collapse" : "expand"}`}
        android_ripple={{ color: colors.muted }}
        style={({ pressed }) => [styles.header, pressed && { opacity: 0.7 }]}
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
            {phase.title}
          </Text>
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
          <Animated.View style={chevronStyle}>
            <Feather
              name="chevron-down"
              size={20}
              color={colors.mutedForeground}
            />
          </Animated.View>
        </View>

        {(isActive || isCompleted) && (
          <View style={styles.statusRow}>
            {isActive ? (
              <View style={[styles.nowChip, { backgroundColor: colors.primary }]}>
                <Text
                  style={[
                    styles.chipText,
                    {
                      color: colors.primaryForeground,
                      fontFamily: "Inter_700Bold",
                    },
                  ]}
                >
                  NOW
                </Text>
              </View>
            ) : (
              <View
                style={[
                  styles.doneChip,
                  {
                    borderColor: colors.primary,
                    backgroundColor: colors.primary + "15",
                  },
                ]}
              >
                <Feather name="check" size={11} color={colors.primary} />
                <Text
                  style={[
                    styles.chipText,
                    { color: colors.primary, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  DONE
                </Text>
              </View>
            )}
          </View>
        )}

        <Text
          style={[
            styles.weeks,
            { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
          ]}
          numberOfLines={1}
        >
          Week {phase.startWeek} — Week {phase.endWeek}
          {milestoneCount > 0
            ? ` · ${milestoneCount} milestone${milestoneCount === 1 ? "" : "s"}`
            : ""}
        </Text>
      </Pressable>

      {expanded && (
        <Animated.View entering={FadeIn.duration(180)} style={styles.body}>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
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
                    style={[styles.milestoneRing, { borderColor: milestoneRingColor }]}
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
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 18,
    gap: 10,
  },
  header: {
    gap: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  title: {
    flex: 1,
    fontSize: 15.5,
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  nowChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  doneChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
  weeks: {
    fontSize: 11.5,
    letterSpacing: 0.3,
  },
  body: {
    gap: 14,
    paddingTop: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    width: "100%",
  },
  focus: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  milestones: {
    gap: 16,
  },
  milestoneRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  milestoneRing: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
    marginTop: 2,
  },
  milestoneText: {
    flex: 1,
    gap: 4,
  },
  milestoneTitle: {
    fontSize: 14,
    lineHeight: 19,
  },
  milestoneDescription: {
    fontSize: 12,
    lineHeight: 17,
  },
  weekTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  weekTagText: {
    fontSize: 11,
    letterSpacing: 0.3,
  },
});
