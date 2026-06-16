import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AtlasLogo } from "@/components/AtlasLogo";
import { GOAL_META, TEMPLATE_GOAL_TYPES } from "@/constants/atlas";
import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";
import { useAtlasGenerateTitle, type GoalType } from "@workspace/api-client-react";

const EXAMPLE_PROMPTS = [
  "Get promoted in 9 months",
  "Run a half marathon by June",
  "Save $15,000 this year",
  "Ship a side project in 60 days",
];

export default function WelcomeScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setPendingDraft, goals } = useAtlas();
  const generateTitle = useAtlasGenerateTitle();

  const [selected, setSelected] = useState<GoalType | null>(null);
  const [customGoal, setCustomGoal] = useState("");
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 12 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom + 8;

  const placeholders = useMemo(
    () => [
      t("welcome.placeholder1", "Launch my freelance design studio by October"),
      t("welcome.placeholder2", "Run my first half marathon in 6 months"),
      t("welcome.placeholder3", "Read 30 books and journal weekly this year"),
      t("welcome.placeholder4", "Move to Berlin and find a job by June"),
      t("welcome.placeholder5", "Save 15,000 for a down payment in 9 months"),
    ],
    [t],
  );
  const placeholderIndexRef = useRef(Math.floor(Math.random() * 5));
  const placeholder = placeholders[placeholderIndexRef.current];

  const customGoalTrimmed = customGoal.trim();
  const hasCustom = customGoalTrimmed.length > 0;
  const canSend = hasCustom || selected !== null;

  const onPickTemplate = (g: GoalType) => {
    setCustomGoal("");
    setSelected(g === selected ? null : g);
    inputRef.current?.blur();
  };

  const onCustomChange = (text: string) => {
    setCustomGoal(text);
    if (text.trim().length > 0) setSelected(null);
  };

  const onExamplePress = (text: string) => {
    setCustomGoal(text);
    setSelected(null);
    inputRef.current?.focus();
  };

  const onContinue = async () => {
    if (hasCustom) {
      setIsGeneratingTitle(true);
      let aiTitle = customGoalTrimmed.split(/\s+/).slice(0, 4).join(" ") || customGoalTrimmed;
      try {
        const res = await generateTitle.mutateAsync({
          data: { goalType: "custom", userInput: customGoalTrimmed },
        });
        if (res.title?.trim()) aiTitle = res.title.trim();
      } catch {
        // silent fallback
      } finally {
        setIsGeneratingTitle(false);
      }
      await setPendingDraft({
        goalType: "custom",
        goalTitle: customGoalTrimmed,
        customGoalTitle: aiTitle,
        questions: [],
        answers: [],
        stage: "loading_questions",
      });
      router.push("/intake");
      return;
    }
    if (!selected) return;
    await setPendingDraft({
      goalType: selected,
      goalTitle: GOAL_META[selected].label,
      questions: [],
      answers: [],
      stage: "loading_questions",
    });
    router.push("/intake");
  };

  const recentGoals = goals.slice(0, 3);

  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={0}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <AtlasLogo size="md" />
        <Pressable
          style={[styles.avatarBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
          hitSlop={8}
        >
          <Feather name="settings" size={16} color={colors.mutedForeground} />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Greeting */}
        <Animated.View entering={FadeInDown.duration(350)} style={styles.greetingBlock}>
          <Text style={[styles.greeting, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {t("welcome.title", "Hi, what goal do you\nwant to crush?")}
          </Text>
        </Animated.View>

        {/* ── MAIN INPUT BOX ── */}
        <Animated.View entering={FadeInDown.delay(80).duration(350)} style={styles.inputWrap}>
          <View
            style={[
              styles.inputBox,
              {
                backgroundColor: colors.card,
                borderColor: inputFocused ? colors.primary : colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <TextInput
              ref={inputRef}
              value={customGoal}
              onChangeText={onCustomChange}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder={placeholder}
              placeholderTextColor={colors.mutedForeground}
              multiline
              style={[
                styles.textInput,
                { color: colors.foreground, fontFamily: "Inter_400Regular" },
              ]}
            />

            {/* Action bar */}
            <View style={[styles.actionBar, { borderTopColor: colors.border }]}>
              {/* Left: attach */}
              <Pressable
                style={[styles.actionBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                hitSlop={6}
              >
                <Feather name="paperclip" size={16} color={colors.mutedForeground} />
              </Pressable>

              <View style={styles.actionSpacer} />

              {/* Right: mic */}
              <Pressable
                style={[styles.actionBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
                hitSlop={6}
              >
                <Feather name="mic" size={16} color={colors.mutedForeground} />
              </Pressable>

              {/* Right: send */}
              <Pressable
                onPress={onContinue}
                disabled={!canSend}
                style={[
                  styles.sendBtn,
                  {
                    backgroundColor: canSend ? colors.primary : colors.border,
                    borderRadius: 8,
                  },
                ]}
                hitSlop={6}
              >
                {isGeneratingTitle ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Feather
                    name="arrow-up"
                    size={16}
                    color={canSend ? colors.primaryForeground : colors.mutedForeground}
                  />
                )}
              </Pressable>
            </View>
          </View>
        </Animated.View>

        {/* ── CATEGORY CHIPS (horizontal scroll) ── */}
        <Animated.View entering={FadeInDown.delay(140).duration(350)}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRow}
          >
            {TEMPLATE_GOAL_TYPES.map((g) => {
              const meta = GOAL_META[g];
              const isSelected = selected === g;
              return (
                <Pressable
                  key={g}
                  onPress={() => onPickTemplate(g)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: isSelected ? colors.primary + "18" : colors.card,
                      borderColor: isSelected ? colors.primary : colors.border,
                      borderRadius: 10,
                    },
                  ]}
                >
                  <Ionicons
                    name={meta.icon as React.ComponentProps<typeof Ionicons>["name"]}
                    size={20}
                    color={isSelected ? colors.primary : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.chipLabel,
                      {
                        color: isSelected ? colors.primary : colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    {meta.label.split(" ")[0]}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Animated.View>

        {/* ── EXAMPLE PROMPTS ── */}
        <Animated.View entering={FadeInDown.delay(200).duration(350)} style={styles.exampleSection}>
          <Text style={[styles.exampleLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
            {t("welcome.exampleLabel", "Try an example prompt")}
          </Text>
          <View style={styles.exampleChips}>
            {EXAMPLE_PROMPTS.map((ex) => (
              <Pressable
                key={ex}
                onPress={() => onExamplePress(ex)}
                style={[
                  styles.exampleChip,
                  { backgroundColor: colors.card, borderColor: colors.border, borderRadius: 8 },
                ]}
              >
                <Text style={[styles.exampleChipText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {ex}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* ── RECENT GOALS ── */}
        {recentGoals.length > 0 && (
          <Animated.View entering={FadeIn.delay(260).duration(350)} style={styles.recentSection}>
            <View style={styles.recentHeader}>
              <Text style={[styles.recentTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {t("welcome.recentGoals", "Your recent goals")}
              </Text>
              <Pressable onPress={() => router.push("/(tabs)/goals")}>
                <Text style={[styles.viewAll, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
                  {t("welcome.viewAll", "View All →")}
                </Text>
              </Pressable>
            </View>
            {recentGoals.map((goal) => {
              const meta = GOAL_META[goal.profile?.goalType ?? "custom"];
              const label =
                goal.profile?.goalType === "custom" && goal.profile?.customGoalTitle
                  ? goal.profile.customGoalTitle
                  : meta.label;
              const totalWeeks = goal.roadmap?.totalWeeks;
              const sub = goal.roadmap
                ? t("welcome.roadmapWeeks", "{{n}}-week plan · Active", { n: totalWeeks ?? "?" })
                : t("welcome.inProgress", "In progress");

              return (
                <Pressable
                  key={goal.id}
                  style={[
                    styles.recentGoalRow,
                    { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius },
                  ]}
                  onPress={() => router.push("/(tabs)/goals")}
                >
                  <View style={[styles.recentIcon, { backgroundColor: meta.accent + "18", borderRadius: 8 }]}>
                    <Ionicons
                      name={meta.icon as React.ComponentProps<typeof Ionicons>["name"]}
                      size={18}
                      color={meta.accent}
                    />
                  </View>
                  <View style={styles.recentText}>
                    <Text numberOfLines={1} style={[styles.recentGoalTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                      {label}
                    </Text>
                    <Text style={[styles.recentGoalSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                      {sub}
                    </Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </Pressable>
              );
            })}
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  scroll: {
    paddingHorizontal: 16,
    gap: 16,
    paddingTop: 24,
  },

  greetingBlock: {
    paddingHorizontal: 4,
  },
  greeting: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.6,
    textAlign: "center",
  },

  inputWrap: {},
  inputBox: {
    borderWidth: 1.5,
    overflow: "hidden",
  },
  textInput: {
    fontSize: 15,
    lineHeight: 22,
    minHeight: 72,
    maxHeight: 160,
    textAlignVertical: "top",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  actionSpacer: { flex: 1 },
  sendBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },

  chipsRow: {
    paddingHorizontal: 2,
    gap: 8,
    flexDirection: "row",
  },
  chip: {
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    gap: 5,
  },
  chipLabel: {
    fontSize: 11,
    letterSpacing: 0.2,
  },

  exampleSection: { gap: 10 },
  exampleLabel: { fontSize: 12, fontWeight: "500" },
  exampleChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  exampleChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  exampleChipText: { fontSize: 12 },

  recentSection: { gap: 10 },
  recentHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recentTitle: { fontSize: 14 },
  viewAll: { fontSize: 12 },
  recentGoalRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
    borderWidth: 1,
  },
  recentIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  recentText: { flex: 1 },
  recentGoalTitle: { fontSize: 13, marginBottom: 2 },
  recentGoalSub: { fontSize: 11 },
});
