import { Feather } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import type { ReflectionEntry } from "@workspace/api-client-react";

type ReasonOption = {
  value: NonNullable<ReflectionEntry["reasonTag"]>;
  label: string;
  icon: React.ComponentProps<typeof Feather>["name"];
};

const COMPLETED_TAGS: ReasonOption[] = [
  { value: "easy", label: "Easy", icon: "smile" },
  { value: "just_right", label: "Just right", icon: "check-circle" },
  { value: "tough", label: "Tough", icon: "alert-triangle" },
  { value: "energized", label: "Energized", icon: "zap" },
  { value: "focused", label: "Focused", icon: "target" },
  { value: "tired", label: "Tired", icon: "moon" },
];

const SKIPPED_TAGS: ReasonOption[] = [
  { value: "no_time", label: "No time", icon: "clock" },
  { value: "tired", label: "Too tired", icon: "moon" },
  { value: "distracted", label: "Distracted", icon: "shuffle" },
  { value: "blocked", label: "Blocked", icon: "x-octagon" },
  { value: "skipped", label: "Skipped on purpose", icon: "skip-forward" },
  { value: "tough", label: "Too hard", icon: "alert-triangle" },
];

type Props = {
  visible: boolean;
  taskId: string;
  taskTitle: string;
  date: string;
  completed: boolean;
  initialReasonTag?: ReflectionEntry["reasonTag"];
  initialNote?: string;
  onClose: () => void;
  onSubmit: (entry: ReflectionEntry) => void;
};

export function ReflectionSheet({
  visible,
  taskId,
  taskTitle,
  date,
  completed,
  initialReasonTag,
  initialNote,
  onClose,
  onSubmit,
}: Props) {
  const colors = useColors();
  const [reasonTag, setReasonTag] = useState<ReflectionEntry["reasonTag"]>(initialReasonTag);
  const [note, setNote] = useState(initialNote ?? "");

  // Reset state when the sheet is reopened for a different task / day.
  useEffect(() => {
    if (visible) {
      setReasonTag(initialReasonTag);
      setNote(initialNote ?? "");
    }
  }, [visible, taskId, date, initialReasonTag, initialNote]);

  const tags = useMemo(() => (completed ? COMPLETED_TAGS : SKIPPED_TAGS), [completed]);

  const handleSave = () => {
    const entry: ReflectionEntry = {
      taskId,
      taskTitle,
      date,
      completed,
      reflectedAt: new Date().toISOString(),
      ...(reasonTag ? { reasonTag } : {}),
      ...(note.trim().length > 0 ? { note: note.trim() } : {}),
    };
    onSubmit(entry);
    onClose();
  };

  const canSave = Boolean(reasonTag) || note.trim().length > 0;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.kbWrap}
          pointerEvents="box-none"
        >
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
            <View style={styles.headerRow}>
              <View
                style={[
                  styles.statusPill,
                  {
                    backgroundColor: completed
                      ? colors.primary + "1A"
                      : colors.muted,
                  },
                ]}
              >
                <Feather
                  name={completed ? "check-circle" : "x-circle"}
                  size={12}
                  color={completed ? colors.primary : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.statusText,
                    {
                      color: completed ? colors.primary : colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {completed ? "Marked done" : "Not done"}
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>

            <Text
              style={[
                styles.title,
                { color: colors.foreground, fontFamily: "Inter_700Bold" },
              ]}
            >
              {completed ? "How did this go?" : "Why didn't this happen?"}
            </Text>
            <Text
              style={[
                styles.subtitle,
                { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
              ]}
              numberOfLines={2}
            >
              {taskTitle}
            </Text>

            <View style={styles.chipWrap}>
              {tags.map((opt) => {
                const selected = reasonTag === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setReasonTag(selected ? undefined : opt.value)}
                    style={[
                      styles.chip,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected
                          ? colors.primary + "1A"
                          : "transparent",
                      },
                    ]}
                  >
                    <Feather
                      name={opt.icon}
                      size={12}
                      color={selected ? colors.primary : colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.chipText,
                        {
                          color: selected ? colors.primary : colors.foreground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              value={note}
              onChangeText={setNote}
              multiline
              placeholder={
                completed
                  ? "Optional note — what helped, what made it click?"
                  : "Optional note — what got in the way?"
              }
              placeholderTextColor={colors.mutedForeground}
              style={[
                styles.textArea,
                {
                  borderColor: colors.border,
                  borderRadius: colors.radius,
                  color: colors.foreground,
                  backgroundColor: colors.background,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            />

            <View style={styles.actionRow}>
              <Pressable
                onPress={onClose}
                style={({ pressed }) => [
                  styles.secondaryBtn,
                  {
                    borderColor: colors.border,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.secondaryText,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  Skip
                </Text>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={!canSave}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  {
                    backgroundColor: canSave ? colors.primary : colors.muted,
                    borderRadius: colors.radius,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.primaryText,
                    {
                      color: canSave ? colors.primaryForeground : colors.mutedForeground,
                      fontFamily: "Inter_700Bold",
                    },
                  ]}
                >
                  Save reflection
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  kbWrap: {
    width: "100%",
  },
  sheet: {
    margin: 12,
    padding: 20,
    borderWidth: 1,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusText: {
    fontSize: 11,
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 18,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: -6,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 12.5,
  },
  textArea: {
    minHeight: 80,
    borderWidth: 1,
    padding: 12,
    fontSize: 14,
    textAlignVertical: "top",
    marginTop: 4,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  secondaryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: {
    fontSize: 14,
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: {
    fontSize: 14.5,
    letterSpacing: 0.2,
  },
});
