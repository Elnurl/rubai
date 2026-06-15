import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AtlasButton } from "@/components/AtlasButton";
import { AtlasLogo } from "@/components/AtlasLogo";
import { IntakeForm, validateIntake } from "@/components/IntakeForm";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";
import {
  useAtlasGenerateTitle,
  useAtlasIntakeQuestions,
  useAtlasIntakeSubmit,
  type IntakeAnswer,
} from "@workspace/api-client-react";

export default function IntakeScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const topPad = isWeb ? 24 : insets.top + 8;
  const bottomPad = isWeb ? 34 : insets.bottom + 12;

  const {
    pendingDraft,
    setPendingDraft,
    attachPendingQuestions,
    attachPendingProfile,
    updatePendingAnswers,
    account,
  } = useAtlas();

  const fetchQuestions = useAtlasIntakeQuestions();
  const submit = useAtlasIntakeSubmit();
  const generateTitle = useAtlasGenerateTitle();
  const requestedRef = useRef(false);
  const [missing, setMissing] = useState<string[]>([]);

  // Bail back to welcome if we got here without a draft.
  useEffect(() => {
    if (!pendingDraft) {
      router.replace("/welcome");
    }
  }, [pendingDraft, router]);

  // Generate the intake questionnaire on mount.
  useEffect(() => {
    if (!pendingDraft) return;
    if (pendingDraft.questions.length > 0) return;
    if (requestedRef.current) return;
    if (pendingDraft.stage !== "loading_questions") return;
    requestedRef.current = true;
    fetchQuestions
      .mutateAsync({
        data: {
          goalType: pendingDraft.goalType,
          goalTitle: pendingDraft.goalTitle,
          ...(account.preferredLanguage ? { preferredLanguage: account.preferredLanguage } : {}),
        },
      })
      .then((res) => {
        void attachPendingQuestions(res.questions, res.introMessage);
      })
      .catch(() => {
        requestedRef.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingDraft?.goalType, pendingDraft?.goalTitle]);

  if (!pendingDraft) return null;

  const onAnswersChange = (answers: IntakeAnswer[]) => {
    void updatePendingAnswers(answers);
    if (missing.length > 0) {
      const stillMissing = answers.filter(
        (a) => missing.includes(a.questionId) && a.value.trim().length === 0,
      );
      setMissing(stillMissing.map((a) => a.questionId));
    }
  };

  const onSubmit = async () => {
    const result = validateIntake(pendingDraft.questions, pendingDraft.answers);
    if (!result.ok) {
      setMissing(result.missingIds);
      return;
    }
    setMissing([]);
    try {
      // For custom goals, kick off an AI title refinement in PARALLEL with
      // intake-submit so we don't add extra wall-clock latency before the
      // generating screen. Pass the first 2-3 answers as `intent` so the
      // model has more than just the raw goal blurb to work with.
      const isCustom = pendingDraft.goalType === "custom";
      const rawCustomInput =
        pendingDraft.customGoalTitle?.trim() || pendingDraft.goalTitle?.trim() || "";

      const titlePromise: Promise<string | null> = isCustom && rawCustomInput.length > 0
        ? generateTitle
            .mutateAsync({
              data: {
                goalType: pendingDraft.goalType,
                userInput: rawCustomInput,
                intent: pendingDraft.answers
                  .slice(0, 3)
                  .map((a) => a.value)
                  .filter((v) => v && v.trim().length > 0)
                  .join(" | ")
                  .slice(0, 400),
              },
            })
            .then((r) => r.title?.trim() || null)
            .catch(() => null)
        : Promise.resolve(null);

      const [res, refinedTitle] = await Promise.all([
        submit.mutateAsync({
          data: {
            goalType: pendingDraft.goalType,
            goalTitle: pendingDraft.goalTitle,
            questions: pendingDraft.questions,
            answers: pendingDraft.answers,
            ...(account.preferredLanguage ? { preferredLanguage: account.preferredLanguage } : {}),
          },
        }),
        titlePromise,
      ]);

      // Use the AI-refined title as the display name on the new goal record.
      // Keep the raw user input intact via goalStatement (set by intake-submit)
      // so behavioural prompts can still reference how the user phrased it.
      // If generate-title failed/returned null, use the first 4 words of the
      // raw description as a fallback — never show a full paragraph as a title.
      const rawFallback = rawCustomInput.trim().split(/\s+/).slice(0, 4).join(" ");
      const finalCustomTitle =
        isCustom && refinedTitle && refinedTitle.length > 0
          ? refinedTitle
          : isCustom
            ? (rawFallback || pendingDraft.customGoalTitle)
            : undefined;

      const profile = {
        ...res.profile,
        goalType: pendingDraft.goalType,
        customGoalTitle: finalCustomTitle,
      };
      // Persist the synthesised profile so the generating screen can recover
      // it on resume even if route params are lost.
      await attachPendingProfile(profile, res.followUp);
      router.replace({
        pathname: "/generating",
        params: { profile: JSON.stringify(profile) },
      });
    } catch {
      // ignore - shows error UI via mutation state
    }
  };

  const isLoadingQuestions = fetchQuestions.isPending && pendingDraft.questions.length === 0;
  const hasError = fetchQuestions.isError && pendingDraft.questions.length === 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad }]}>
        <Pressable
          onPress={async () => {
            await setPendingDraft(null);
            router.replace("/welcome");
          }}
          hitSlop={10}
          style={[styles.backBtn, { backgroundColor: colors.muted }]}
        >
          <Feather name="x" size={18} color={colors.foreground} />
        </Pressable>
        <AtlasLogo size="sm" />
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: bottomPad + 140 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={140}
        extraKeyboardSpace={20}
      >
        <View style={styles.hero}>
          <Text
            style={[
              styles.eyebrow,
              { color: colors.primary, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {t("intake.eyebrow", "INTAKE FORM")}
          </Text>
          {/* Show the user's goal as a chat bubble, not a large heading. */}
          <View style={[styles.userBubble, { backgroundColor: colors.primary + "18", borderColor: colors.primary + "30" }]}>
            <Text
              style={[
                styles.bubbleText,
                { color: colors.foreground, fontFamily: "Inter_400Regular" },
              ]}
            >
              {pendingDraft.goalTitle}
            </Text>
          </View>
          {pendingDraft.introMessage ? (
            <Animated.Text
              entering={FadeIn.duration(400)}
              style={[
                styles.intro,
                { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
              ]}
            >
              {pendingDraft.introMessage}
            </Animated.Text>
          ) : null}
        </View>

        {isLoadingQuestions ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
            <Text
              style={[
                styles.loadingText,
                { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
              ]}
            >
              {t("intake.loadingText", "rubai is designing your intake form")}
            </Text>
          </View>
        ) : hasError ? (
          <View
            style={[
              styles.errorCard,
              {
                backgroundColor: colors.destructive + "1A",
                borderColor: colors.destructive,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Text
              style={[
                styles.errorText,
                { color: colors.destructive, fontFamily: "Inter_500Medium" },
              ]}
            >
              {t("intake.errorText", "Couldn't reach the planner. Try again.")}
            </Text>
            <AtlasButton
              label={t("intake.retryBtn", "Retry")}
              variant="secondary"
              onPress={() => {
                requestedRef.current = false;
                fetchQuestions.reset();
                if (pendingDraft) {
                  void setPendingDraft({ ...pendingDraft, stage: "loading_questions" });
                }
              }}
            />
          </View>
        ) : pendingDraft.questions.length > 0 ? (
          <>
            {missing.length > 0 ? (
              <View
                style={[
                  styles.missingBanner,
                  {
                    backgroundColor: colors.destructive + "1A",
                    borderColor: colors.destructive,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <Feather name="alert-circle" size={14} color={colors.destructive} />
                <Text
                  style={[
                    styles.missingText,
                    { color: colors.destructive, fontFamily: "Inter_500Medium" },
                  ]}
                >
                  {missing.length === 1
                    ? t(
                        "intake.missingBannerOne",
                        "Please answer the {{count}} highlighted question.",
                        { count: missing.length },
                      )
                    : t(
                        "intake.missingBannerMany",
                        "Please answer the {{count}} highlighted questions.",
                        { count: missing.length },
                      )}
                </Text>
              </View>
            ) : null}
            <IntakeForm
              questions={pendingDraft.questions}
              initialAnswers={pendingDraft.answers}
              onChange={onAnswersChange}
            />
          </>
        ) : null}
      </KeyboardAwareScrollViewCompat>

      {pendingDraft.questions.length > 0 ? (
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
          {missing.length > 0 ? (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                paddingHorizontal: 4,
                paddingBottom: 8,
              }}
            >
              <Feather
                name="alert-circle"
                size={13}
                color={colors.destructive}
              />
              <Text
                style={{
                  flex: 1,
                  color: colors.destructive,
                  fontFamily: "Inter_500Medium",
                  fontSize: 12.5,
                  lineHeight: 17,
                }}
              >
                {missing.length === 1
                  ? t(
                      "intake.footerMissingOne",
                      "1 required question is missing — scroll up to find the highlighted card.",
                    )
                  : t(
                      "intake.footerMissingMany",
                      "{{count}} required questions are missing — scroll up to find them.",
                      { count: missing.length },
                    )}
              </Text>
            </View>
          ) : null}
          <AtlasButton
            label={submit.isPending ? t("intake.buildingProfile", "Building your profile") : t("intake.buildPlanBtn", "Build my plan")}
            onPress={onSubmit}
            loading={submit.isPending}
            disabled={submit.isPending}
            icon={
              submit.isPending ? undefined : (
                <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
              )
            }
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingBottom: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    paddingHorizontal: 22,
    gap: 18,
  },
  hero: {
    gap: 8,
    marginTop: 4,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 2,
  },
  userBubble: {
    alignSelf: "flex-end",
    borderWidth: 1,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "90%",
  },
  bubbleText: {
    fontSize: 14.5,
    lineHeight: 21,
  },
  intro: {
    fontSize: 14.5,
    lineHeight: 21,
    marginTop: 4,
  },
  loading: {
    paddingVertical: 60,
    alignItems: "center",
    gap: 14,
  },
  loadingText: {
    fontSize: 13.5,
    letterSpacing: 0.2,
  },
  errorCard: {
    padding: 18,
    borderWidth: 1,
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
  },
  missingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderWidth: 1,
  },
  missingText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
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
