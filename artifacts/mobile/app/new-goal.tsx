import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AtlasButton } from "@/components/AtlasButton";
import { GoalCard } from "@/components/GoalCard";
import { GOAL_META, TEMPLATE_GOAL_TYPES } from "@/constants/atlas";
import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";
import { useAtlasGenerateTitle, type GoalType } from "@workspace/api-client-react";

export default function NewGoalScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { setPendingDraft, canAddMoreGoals, goalLimit } = useAtlas();
  const generateTitle = useAtlasGenerateTitle();
  const [selected, setSelected] = useState<GoalType | null>(null);
  const [customGoal, setCustomGoal] = useState("");
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 67 : insets.top + 12;
  const bottomPad = isWeb ? 34 : insets.bottom + 12;

  const customTrimmed = customGoal.trim();
  const hasCustom = customTrimmed.length > 0;
  const canContinue = (hasCustom || selected !== null) && canAddMoreGoals;

  const onContinue = async () => {
    if (!canAddMoreGoals) return;
    if (hasCustom) {
      setIsGeneratingTitle(true);
      let aiTitle = customTrimmed.split(/\s+/).slice(0, 4).join(" ") || customTrimmed;
      try {
        const res = await generateTitle.mutateAsync({
          data: { goalType: "custom", userInput: customTrimmed },
        });
        if (res.title?.trim()) aiTitle = res.title.trim();
      } catch {
        // silent fallback — first 4 words already set above
      } finally {
        setIsGeneratingTitle(false);
      }
      await setPendingDraft({
        goalType: "custom",
        goalTitle: customTrimmed,
        customGoalTitle: aiTitle,
        questions: [],
        answers: [],
        stage: "loading_questions",
      });
    } else if (selected) {
      await setPendingDraft({
        goalType: selected,
        goalTitle: GOAL_META[selected].label,
        questions: [],
        answers: [],
        stage: "loading_questions",
      });
    } else return;
    router.push("/intake");
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={[styles.backBtn, { backgroundColor: colors.muted }]}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <Text
          style={[
            styles.headerTitle,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
          {t("newGoal.headerTitle", "Add a new goal")}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: bottomPad + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!canAddMoreGoals && (
          <View
            style={[
              styles.limitBanner,
              {
                backgroundColor: colors.destructive + "1A",
                borderColor: colors.destructive,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather name="alert-triangle" size={16} color={colors.destructive} />
            <Text
              style={[
                styles.limitText,
                { color: colors.destructive, fontFamily: "Inter_500Medium" },
              ]}
            >
              {goalLimit === 1
                ? t(
                    "newGoal.limitBannerOne",
                    "You're at your plan limit of {{count}} active goal. Upgrade in Account or remove a goal first.",
                    { count: goalLimit },
                  )
                : t(
                    "newGoal.limitBannerMany",
                    "You're at your plan limit of {{count}} active goals. Upgrade in Account or remove a goal first.",
                    { count: goalLimit },
                  )}
            </Text>
          </View>
        )}

        <View
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
              {t("newGoal.describeLabel", "DESCRIBE THIS NEW GOAL")}
            </Text>
          </View>
          <TextInput
            value={customGoal}
            onChangeText={(t) => {
              setCustomGoal(t);
              if (t.trim().length > 0) setSelected(null);
            }}
            placeholder={t("newGoal.placeholder", "e.g. Get promoted to senior engineer in 9 months")}
            placeholderTextColor={colors.mutedForeground}
            multiline
            editable={canAddMoreGoals}
            style={[
              styles.customInput,
              { color: colors.foreground, fontFamily: "Inter_500Medium" },
            ]}
          />
        </View>

        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text
            style={[
              styles.dividerText,
              { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
            ]}
          >
            {t("newGoal.orPickTemplate", "OR PICK A TEMPLATE")}
          </Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        <View style={styles.cards}>
          {TEMPLATE_GOAL_TYPES.map((g) => (
            <GoalCard
              key={g}
              goal={g}
              selected={selected === g}
              onPress={() => {
                if (!canAddMoreGoals) return;
                setCustomGoal("");
                setSelected(g);
              }}
            />
          ))}
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
          label={isGeneratingTitle ? t("newGoal.namingGoal", "Naming your goal…") : t("newGoal.continueBtn", "Continue to intake")}
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    letterSpacing: -0.2,
  },
  scroll: {
    paddingHorizontal: 22,
    gap: 18,
  },
  limitBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 14,
    borderWidth: 1,
  },
  limitText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
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
    fontSize: 16,
    lineHeight: 22,
    minHeight: 60,
    textAlignVertical: "top",
    paddingTop: 4,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
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
