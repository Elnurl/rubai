import { Feather, Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { GOAL_META, profileGoalLabel } from "@/constants/atlas";
import { useColors } from "@/hooks/useColors";
import { useAtlas } from "@/providers/AtlasProvider";

export function ActiveGoalChip() {
  const colors = useColors();
  const { t } = useTranslation();
  const { goals, activeGoal, activeGoalId, setActiveGoal } = useAtlas();
  const [open, setOpen] = useState(false);

  if (!activeGoal || goals.length < 2) return null;

  const meta = GOAL_META[activeGoal.profile.goalType];
  const label = profileGoalLabel(activeGoal.profile);

  const handleSelect = async (id: string) => {
    setOpen(false);
    if (id !== activeGoalId) {
      try {
        await setActiveGoal(id);
      } catch {
        // ignore — provider preserves the previous active goal on failure
      }
    }
  };

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.chip,
          {
            backgroundColor: colors.muted,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
        hitSlop={6}
      >
        <View style={[styles.dot, { backgroundColor: meta.accent }]} />
        <Text
          numberOfLines={1}
          style={[
            styles.label,
            { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
          ]}
        >
          {label}
        </Text>
        <Ionicons name="chevron-down" size={14} color={colors.mutedForeground} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={[
              styles.sheet,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Text
              style={[
                styles.sheetTitle,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_600SemiBold",
                },
              ]}
            >
              {t("activeGoalChip.switchGoal", "Switch goal")}
            </Text>
            <ScrollView
              style={styles.list}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              {goals.map((g) => {
                const m = GOAL_META[g.profile.goalType];
                const gLabel = profileGoalLabel(g.profile);
                const isActive = g.id === activeGoalId;
                return (
                  <Pressable
                    key={g.id}
                    onPress={() => void handleSelect(g.id)}
                    style={({ pressed }) => [
                      styles.row,
                      {
                        backgroundColor: isActive
                          ? colors.muted
                          : colors.card,
                        opacity: pressed ? 0.75 : 1,
                      },
                    ]}
                  >
                    <View style={[styles.rowDot, { backgroundColor: m.accent }]} />
                    <View style={{ flex: 1 }}>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.rowLabel,
                          {
                            color: colors.foreground,
                            fontFamily: "Inter_600SemiBold",
                          },
                        ]}
                      >
                        {gLabel}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={[
                          styles.rowSub,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_400Regular",
                          },
                        ]}
                      >
                        {m.label}
                      </Text>
                    </View>
                    {isActive ? (
                      <Feather name="check" size={16} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 200,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    fontSize: 12,
    letterSpacing: 0.2,
    flexShrink: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  sheet: {
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    maxHeight: "70%",
  },
  sheetTitle: {
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
  },
  rowDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  rowLabel: {
    fontSize: 14,
  },
  rowSub: {
    fontSize: 12,
    marginTop: 2,
  },
});
