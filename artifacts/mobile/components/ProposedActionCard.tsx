import { Feather } from "@expo/vector-icons";
import React from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useColors } from "@/hooks/useColors";
import type { ProposedCoachAction } from "@workspace/api-client-react";

type Props = {
  action: ProposedCoachAction;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * Inline chat card the coach uses when it wants to MODIFY the user's plan.
 * It must be explicit and reversible — the change only happens after the
 * user taps Confirm. Cancel just dismisses the card.
 */
export function ProposedActionCard({ action, pending, onConfirm, onCancel }: Props) {
  const colors = useColors();
  const { t } = useTranslation();

  // Per-kind subtitle gives the user a concrete preview of the change so they
  // know exactly what they're agreeing to. label/rationale are model-authored
  // copy; the subtitle is structural so the UI never lies about the action.
  const subtitle = (() => {
    switch (action.kind) {
      case "addTaskToday":
        if (action.task) {
          return t("proposedActionCard.addTask", "Add: {{title}} ({{minutes}} min)", { title: action.task.title, minutes: action.task.durationMinutes });
        }
        return t("proposedActionCard.addTaskGeneric", "Add a new task to today");
      case "removeTaskToday":
        return action.taskTitle ? t("proposedActionCard.removeTask", "Remove: {{title}}", { title: action.taskTitle }) : t("proposedActionCard.removeTaskGeneric", "Remove a task from today");
      case "renameGoal":
        return action.newTitle ? t("proposedActionCard.renameGoal", "Rename goal to \"{{title}}\"", { title: action.newTitle }) : t("proposedActionCard.renameGoalGeneric", "Rename your goal");
      case "lightenToday": {
        const n = action.removeTaskIds?.length ?? 0;
        return n === 1
          ? t("proposedActionCard.dropTaskOne", "Drop {{count}} task from today", { count: n })
          : t("proposedActionCard.dropTaskOther", "Drop {{count}} tasks from today", { count: n });
      }
      // exhaustive guard — keeps TS satisfied if a new kind appears via codegen
      // before the UI is updated.
      default:
        return "";
    }
  })();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.primary },
      ]}
      testID={`proposed-action-${action.kind}`}
    >
      <View style={styles.header}>
        <Feather name="zap" size={16} color={colors.primary} />
        <Text
          style={[
            styles.eyebrow,
            { color: colors.primary, fontFamily: "Inter_700Bold" },
          ]}
        >
          {t("proposedActionCard.eyebrow", "PROPOSED CHANGE")}
        </Text>
      </View>
      <Text
        style={[styles.label, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
      >
        {action.label}
      </Text>
      {subtitle ? (
        <Text
          style={[
            styles.subtitle,
            { color: colors.foreground, fontFamily: "Inter_500Medium" },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
      <Text
        style={[
          styles.rationale,
          { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
        ]}
      >
        {action.rationale}
      </Text>
      <View style={styles.actions}>
        <Pressable
          onPress={onCancel}
          disabled={pending}
          style={[
            styles.btn,
            styles.cancelBtn,
            { borderColor: colors.border, opacity: pending ? 0.6 : 1 },
          ]}
          testID="proposed-action-cancel"
        >
          <Text
            style={[
              styles.btnText,
              { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {t("proposedActionCard.cancel", "Cancel")}
          </Text>
        </Pressable>
        <Pressable
          onPress={onConfirm}
          disabled={pending}
          style={[
            styles.btn,
            styles.confirmBtn,
            { backgroundColor: colors.primary, opacity: pending ? 0.6 : 1 },
          ]}
          testID="proposed-action-confirm"
        >
          {pending ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <Text
              style={[
                styles.btnText,
                {
                  color: colors.primaryForeground,
                  fontFamily: "Inter_700Bold",
                },
              ]}
            >
              {t("proposedActionCard.confirm", "Confirm")}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  eyebrow: {
    fontSize: 11,
    letterSpacing: 1,
  },
  label: {
    fontSize: 16,
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  rationale: {
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtn: {
    borderWidth: 1,
    backgroundColor: "transparent",
  },
  confirmBtn: {},
  btnText: {
    fontSize: 14,
  },
});
