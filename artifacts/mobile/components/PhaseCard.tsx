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

type Props = {
  phase: RoadmapPhase;
  index: number;
  isActive: boolean;
  /** When true, renders a subtle "Updated" badge to flag a phase the AI just modified. */
  updated?: boolean;
};

export function PhaseCard({ phase, index, isActive, updated = false }: Props) {
  const colors = useColors();
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

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(320)}
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
        <View
          style={[
            styles.indexBadge,
            {
              backgroundColor: isActive ? colors.primary : colors.muted,
            },
          ]}
        >
          <Text
            style={[
              styles.indexText,
              {
                color: isActive ? colors.primaryForeground : colors.mutedForeground,
                fontFamily: "Inter_700Bold",
              },
            ]}
          >
            {String(index + 1).padStart(2, "0")}
          </Text>
        </View>
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
            {milestoneCount > 0 ? ` • ${milestoneCount} milestone${milestoneCount === 1 ? "" : "s"}` : ""}
          </Text>
        </View>
        <View style={styles.headerChips}>
          {updated && (
            <View
              style={[
                styles.updatedChip,
                { borderColor: colors.accent, backgroundColor: colors.accent + "15" },
              ]}
            >
              <Feather name="zap" size={10} color={colors.accent} />
              <Text
                style={[
                  styles.activeChipText,
                  { color: colors.accent, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                UPDATED
              </Text>
            </View>
          )}
          {isActive && (
            <View style={[styles.activeChip, { backgroundColor: colors.primary }]}>
              <Text
                style={[
                  styles.activeChipText,
                  { color: colors.primaryForeground, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                NOW
              </Text>
            </View>
          )}
          <Animated.View style={chevronStyle}>
            <Feather name="chevron-down" size={20} color={colors.mutedForeground} />
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
                      { backgroundColor: isActive ? colors.primary : colors.mutedForeground + "55" },
                    ]}
                  />
                  <View style={styles.milestoneText}>
                    <Text
                      style={[
                        styles.milestoneTitle,
                        { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
                      ]}
                    >
                      {m.title}
                    </Text>
                    <Text
                      style={[
                        styles.milestoneDescription,
                        { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
                      ]}
                    >
                      {m.description}
                    </Text>
                    <View style={styles.weekTag}>
                      <Feather name="calendar" size={11} color={colors.mutedForeground} />
                      <Text
                        style={[
                          styles.weekTagText,
                          { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
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
    padding: 16,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  indexBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  indexText: {
    fontSize: 14,
    letterSpacing: 1.5,
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
  updatedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  activeChipText: {
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
    width: 9,
    height: 9,
    borderRadius: 5,
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
