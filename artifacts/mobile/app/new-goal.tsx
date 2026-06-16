import { Feather, Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  const [inputFocused, setInputFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 12 : insets.top;
  const bottomPad = isWeb ? 34 : insets.bottom + 8;

  const customTrimmed = customGoal.trim();
  const hasCustom = customTrimmed.length > 0;
  const canSend = (hasCustom || selected !== null) && canAddMoreGoals;

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
        // silent fallback
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

  const onPickTemplate = (g: GoalType) => {
    if (!canAddMoreGoals) return;
    setCustomGoal("");
    setSelected(g === selected ? null : g);
    inputRef.current?.blur();
  };

  const onExamplePress = (text: string) => {
    if (!canAddMoreGoals) return;
    setCustomGoal(text);
    setSelected(null);
    inputRef.current?.focus();
  };

  return (
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.root, { backgroundColor: colors.background }]}
    >
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          {t("newGoal.headerTitle", "Add a new goal")}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad + 32 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Limit banner */}
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
            <Text style={[styles.limitText, { color: colors.destructive, fontFamily: "Inter_500Medium" }]}>
              {goalLimit === 1
                ? t("newGoal.limitBannerOne", "You're at your plan limit of {{count}} active goal. Upgrade in Account or remove a goal first.", { count: goalLimit })
                : t("newGoal.limitBannerMany", "You're at your plan limit of {{count}} active goals. Upgrade in Account or remove a goal first.", { count: goalLimit })}
            </Text>
          </View>
        )}

        {/* ── MAIN INPUT BOX ── */}
        <View
          style={[
            styles.inputBox,
            {
              backgroundColor: colors.card,
              borderColor: inputFocused ? colors.primary : colors.border,
              borderRadius: colors.radius,
              opacity: canAddMoreGoals ? 1 : 0.5,
            },
          ]}
        >
          <TextInput
            ref={inputRef}
            value={customGoal}
            onChangeText={(text) => {
              setCustomGoal(text);
              if (text.trim().length > 0) setSelected(null);
            }}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder={t("newGoal.placeholder", "e.g. Get promoted to senior engineer in 9 months")}
            placeholderTextColor={colors.mutedForeground}
            multiline
            editable={canAddMoreGoals}
            style={[
              styles.textInput,
              { color: colors.foreground, fontFamily: "Inter_400Regular" },
            ]}
          />

          {/* Action bar */}
          <View style={[styles.actionBar, { borderTopColor: colors.border }]}>
            {/* + attach */}
            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
              hitSlop={6}
              disabled={!canAddMoreGoals}
            >
              <Feather name="paperclip" size={16} color={colors.mutedForeground} />
            </Pressable>

            <View style={{ flex: 1 }} />

            {/* Mic */}
            <Pressable
              style={[styles.actionBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
              hitSlop={6}
              disabled={!canAddMoreGoals}
            >
              <Feather name="mic" size={16} color={colors.mutedForeground} />
            </Pressable>

            {/* Send ↑ */}
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

        {/* ── CATEGORY CHIPS (horizontal scroll) ── */}
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
                    opacity: canAddMoreGoals ? 1 : 0.5,
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

        {/* ── EXAMPLE PROMPTS ── */}
        {canAddMoreGoals && (
          <View style={styles.exampleSection}>
            <Text style={[styles.exampleLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              {t("newGoal.exampleLabel", "Try an example prompt")}
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
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    letterSpacing: -0.2,
  },

  scroll: {
    paddingHorizontal: 16,
    paddingTop: 20,
    gap: 16,
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

  inputBox: {
    borderWidth: 1.5,
    overflow: "hidden",
  },
  textInput: {
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
    maxHeight: 180,
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
  sendBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },

  chipsRow: {
    gap: 8,
    flexDirection: "row",
    paddingHorizontal: 2,
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
  exampleLabel: { fontSize: 12 },
  exampleChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  exampleChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  exampleChipText: { fontSize: 12 },
});
