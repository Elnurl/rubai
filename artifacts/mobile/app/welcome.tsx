import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AtlasButton } from "@/components/AtlasButton";
import { AtlasLogo } from "@/components/AtlasLogo";
import { GoalCard } from "@/components/GoalCard";
import { GOAL_META, TEMPLATE_GOAL_TYPES } from "@/constants/atlas";
import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";
import { useAtlasGenerateTitle, type GoalType } from "@workspace/api-client-react";

import i18n from "@/lib/i18n";

const PLACEHOLDERS = [
  i18n.t("welcome.placeholder1", "Launch my freelance design studio by October"),
  i18n.t("welcome.placeholder2", "Run my first half marathon in 6 months"),
  i18n.t("welcome.placeholder3", "Read 30 books and journal weekly this year"),
  i18n.t("welcome.placeholder4", "Move to Berlin and find a job by June"),
  i18n.t("welcome.placeholder5", "Save 15,000 for a down payment in 9 months"),
];

export default function WelcomeScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setPendingDraft } = useAtlas();
  const generateTitle = useAtlasGenerateTitle();
  const [selected, setSelected] = useState<GoalType | null>(null);
  const [customGoal, setCustomGoal] = useState("");
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [placeholder] = useState(
    () => PLACEHOLDERS[Math.floor(Math.random() * PLACEHOLDERS.length)],
  );

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 12;
  const bottomPad = isWeb ? 34 : insets.bottom + 12;

  const customGoalTrimmed = customGoal.trim();
  const hasCustom = customGoalTrimmed.length > 0;
  const canContinue = hasCustom || selected !== null;

  const onPickTemplate = (g: GoalType) => {
    setCustomGoal("");
    setSelected(g);
  };

  const onCustomChange = (text: string) => {
    setCustomGoal(text);
    if (text.trim().length > 0) setSelected(null);
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
        // silent fallback — first 4 words already set above
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

  const buttonLabel = hasCustom
    ? t("welcome.buildPlanBtn", "Build my plan")
    : selected
      ? t("welcome.continueWith", "Continue with {{label}}", {
          label: GOAL_META[selected].label,
        })
      : t("welcome.describeOrPick", "Describe a goal or pick a template");

  return (
    <KeyboardAvoidingView
      behavior="padding"
      keyboardVerticalOffset={0}
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: topPad, paddingBottom: bottomPad + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
            {t("welcome.eyebrow", "EXECUTION COACH")}
          </Text>
          <Text
            style={[
              styles.title,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            {t("welcome.title", "What do you want\nto make happen?")}
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {t(
              "welcome.subtitle",
              "Tell rubai any goal — career, fitness, study, money, creative, personal — and it will generate a smart intake form, then build a real plan around your time and how you actually behave.",
            )}
          </Text>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(100).duration(400)}
          style={[
            styles.customCard,
            {
              backgroundColor: colors.card,
              borderColor: hasCustom ? colors.primary : colors.border,
              borderWidth: hasCustom ? 2 : 1,
              borderRadius: colors.radius,
            },
          ]}
        >
          <View style={styles.customLabelRow}>
            <View
              style={[styles.customIconWrap, { backgroundColor: colors.primary + "1A" }]}
            >
              <Feather name="target" size={16} color={colors.primary} />
            </View>
            <Text
              style={[
                styles.customLabel,
                { color: colors.primary, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              {t("welcome.yourGoalLabel", "YOUR GOAL")}
            </Text>
          </View>
          <TextInput
            value={customGoal}
            onChangeText={onCustomChange}
            placeholder={placeholder}
            placeholderTextColor={colors.mutedForeground}
            multiline
            style={[
              styles.customInput,
              { color: colors.foreground, fontFamily: "Inter_500Medium" },
            ]}
          />
          <Text
            style={[
              styles.customHint,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {t(
              "welcome.customHint",
              "Be specific if you can. rubai will generate a tailored intake form for your exact goal.",
            )}
          </Text>
        </Animated.View>

        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text
            style={[
              styles.dividerText,
              { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
            ]}
          >
            {t("welcome.orPickTemplate", "OR PICK A TEMPLATE")}
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        <View style={styles.cards}>
          {TEMPLATE_GOAL_TYPES.map((g, i) => (
            <Animated.View
              key={g}
              entering={FadeInDown.delay(160 + i * 50).duration(380)}
            >
              <GoalCard
                goal={g}
                selected={selected === g}
                onPress={() => onPickTemplate(g)}
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
            {t(
              "welcome.noteText",
              "rubai adapts as you go. Skip a day and the plan softens. Stack wins and it pushes you.",
            )}
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
          label={isGeneratingTitle ? t("welcome.namingGoal", "Naming your goal…") : buttonLabel}
          onPress={onContinue}
          disabled={!canContinue}
          loading={isGeneratingTitle}
          icon={
            canContinue && !isGeneratingTitle ? (
              <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
            ) : undefined
          }
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
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
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
  },
  customCard: {
    padding: 18,
    gap: 10,
  },
  customLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  customIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  customLabel: {
    fontSize: 11,
    letterSpacing: 1.6,
  },
  customInput: {
    fontSize: 17,
    lineHeight: 24,
    minHeight: 70,
    textAlignVertical: "top",
    paddingTop: 4,
  },
  customHint: {
    fontSize: 12.5,
    lineHeight: 18,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 10.5,
    letterSpacing: 1.8,
  },
  cards: {
    gap: 12,
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
