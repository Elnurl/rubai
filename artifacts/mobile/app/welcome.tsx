import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AtlasButton } from "@/components/AtlasButton";
import { AtlasLogo } from "@/components/AtlasLogo";
import { GoalCard } from "@/components/GoalCard";
import { GOAL_META, GOAL_TYPES } from "@/constants/atlas";
import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";
import type { ChatMessage, GoalType } from "@workspace/api-client-react";

export default function WelcomeScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setPendingGoalType, setOnboardingHistory } = useAtlas();
  const [selected, setSelected] = useState<GoalType | null>(null);

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 12;
  const bottomPad = isWeb ? 34 : insets.bottom + 12;

  const onContinue = async () => {
    if (!selected) return;
    await setPendingGoalType(selected);
    const opener: ChatMessage = {
      role: "assistant",
      content: GOAL_META[selected].opener,
    };
    await setOnboardingHistory([opener]);
    router.push("/onboarding");
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad, paddingBottom: bottomPad + 100 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <AtlasLogo size="md" />
        </View>

        <Animated.View entering={FadeInDown.duration(400)} style={styles.hero}>
          <Text
            style={[
              styles.eyebrow,
              { color: colors.primary, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            EXECUTION COACH
          </Text>
          <Text
            style={[
              styles.title,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            Pick the life you{"\n"}want to ship.
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            Atlas builds a real plan around your time, your money, and how you
            actually behave — then walks you to the finish, day by day.
          </Text>
        </Animated.View>

        <View style={styles.cards}>
          {GOAL_TYPES.map((g, i) => (
            <Animated.View
              key={g}
              entering={FadeInDown.delay(120 + i * 60).duration(380)}
            >
              <GoalCard
                goal={g}
                selected={selected === g}
                onPress={() => setSelected(g)}
              />
            </Animated.View>
          ))}
        </View>

        <View style={styles.note}>
          <Feather name="shield" size={14} color={colors.mutedForeground} />
          <Text
            style={[
              styles.noteText,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            Atlas adapts as you go. Skip a day and the plan softens. Stack
            wins and it pushes you.
          </Text>
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingBottom: bottomPad,
          },
        ]}
      >
        <AtlasButton
          label={selected ? `Begin with ${GOAL_META[selected].label}` : "Pick a goal to continue"}
          onPress={onContinue}
          disabled={!selected}
          icon={
            selected ? (
              <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
            ) : undefined
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: 22,
    gap: 22,
  },
  header: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  hero: {
    gap: 10,
    marginTop: 4,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 2,
  },
  title: {
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 15.5,
    lineHeight: 23,
    marginTop: 6,
  },
  cards: {
    gap: 12,
    marginTop: 8,
  },
  note: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 4,
    paddingTop: 6,
  },
  noteText: {
    fontSize: 12.5,
    lineHeight: 18,
    flex: 1,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 22,
    paddingTop: 14,
    borderTopWidth: 1,
  },
});
