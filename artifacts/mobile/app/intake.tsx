import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AtlasButton } from "@/components/AtlasButton";
import { AtlasLogo } from "@/components/AtlasLogo";
import { IntakeForm, validateIntake } from "@/components/IntakeForm";
import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";
import {
  useAtlasIntakeQuestions,
  useAtlasIntakeSubmit,
  type IntakeAnswer,
} from "@workspace/api-client-react";

export default function IntakeScreen() {
  const colors = useColors();
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
  } = useAtlas();

  const fetchQuestions = useAtlasIntakeQuestions();
  const submit = useAtlasIntakeSubmit();
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
      const res = await submit.mutateAsync({
        data: {
          goalType: pendingDraft.goalType,
          goalTitle: pendingDraft.goalTitle,
          questions: pendingDraft.questions,
          answers: pendingDraft.answers,
        },
      });
      const profile = {
        ...res.profile,
        goalType: pendingDraft.goalType,
        customGoalTitle:
          pendingDraft.goalType === "custom" ? pendingDraft.customGoalTitle : undefined,
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
    <KeyboardAvoidingView
      behavior="padding"
      style={[styles.root, { backgroundColor: colors.background }]}
    >
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

      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: bottomPad + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <Text
            style={[
              styles.eyebrow,
              { color: colors.primary, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            INTAKE FORM
          </Text>
          <Text
            style={[
              styles.title,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            {pendingDraft.goalTitle}
          </Text>
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
              RubAI is designing your intake form
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
              Couldn't reach the planner. Try again.
            </Text>
            <AtlasButton
              label="Retry"
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
                  Please answer the {missing.length} highlighted question
                  {missing.length === 1 ? "" : "s"}.
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
      </ScrollView>

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
          <AtlasButton
            label={submit.isPending ? "Building your profile" : "Build my plan"}
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
  title: {
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.6,
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
