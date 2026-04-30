import { Feather } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import type { IntakeAnswer, IntakeQuestion } from "@workspace/api-client-react";

type Props = {
  questions: IntakeQuestion[];
  initialAnswers?: IntakeAnswer[];
  onChange?: (answers: IntakeAnswer[]) => void;
};

type AnswerMap = Record<string, string>;

const OTHER_LABEL = "Other";
const OTHER_VALUE_PREFIX = "Other: ";

function isOtherEntry(s: string): boolean {
  const t = s.trim();
  return t === OTHER_LABEL || t.startsWith(OTHER_VALUE_PREFIX);
}

function otherEntryText(s: string): string {
  const t = s.trim();
  if (t.startsWith(OTHER_VALUE_PREFIX)) return t.slice(OTHER_VALUE_PREFIX.length);
  return "";
}

function buildOtherEntry(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > 0 ? `${OTHER_VALUE_PREFIX}${trimmed}` : OTHER_LABEL;
}

function splitMulti(value: string): string[] {
  return value
    .split("|")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function joinMulti(items: string[]): string {
  return items.join("|");
}

function toMap(answers?: IntakeAnswer[]): AnswerMap {
  const m: AnswerMap = {};
  if (answers) for (const a of answers) m[a.questionId] = a.value;
  return m;
}

function toAnswers(map: AnswerMap): IntakeAnswer[] {
  return Object.entries(map).map(([questionId, value]) => ({ questionId, value }));
}

function isMeaningfulAnswer(value: string): boolean {
  const items = splitMulti(value);
  if (items.length === 0) return false;
  // A bare "Other" with no description does not count as answered.
  for (const item of items) {
    if (item === OTHER_LABEL) continue;
    return true;
  }
  return false;
}

export function validateIntake(
  questions: IntakeQuestion[],
  answers: IntakeAnswer[],
): { ok: boolean; missingIds: string[] } {
  const map = toMap(answers);
  const missing: string[] = [];
  for (const q of questions) {
    if (!q.required) continue;
    const val = map[q.id] ?? "";
    if (!isMeaningfulAnswer(val)) missing.push(q.id);
  }
  return { ok: missing.length === 0, missingIds: missing };
}

export function IntakeForm({ questions, initialAnswers, onChange }: Props) {
  const colors = useColors();
  const [answers, setAnswers] = useState<AnswerMap>(() => toMap(initialAnswers));

  const update = useCallback(
    (id: string, value: string) => {
      setAnswers((prev) => {
        const next = { ...prev, [id]: value };
        onChange?.(toAnswers(next));
        return next;
      });
    },
    [onChange],
  );

  return (
    <View style={styles.list}>
      {questions.map((q, i) => (
        <View
          key={q.id}
          style={[
            styles.card,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderRadius: colors.radius,
            },
          ]}
        >
          <View style={styles.headerRow}>
            <View
              style={[styles.numWrap, { backgroundColor: colors.primary + "1A" }]}
            >
              <Text
                style={[
                  styles.numText,
                  { color: colors.primary, fontFamily: "Inter_700Bold" },
                ]}
              >
                {i + 1}
              </Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={[
                  styles.label,
                  { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {q.label}
                {q.required ? (
                  <Text style={{ color: colors.destructive }}> *</Text>
                ) : null}
              </Text>
              {q.helper ? (
                <Text
                  style={[
                    styles.helper,
                    { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
                  ]}
                >
                  {q.helper}
                </Text>
              ) : null}
            </View>
          </View>

          <FieldRenderer
            question={q}
            value={answers[q.id] ?? ""}
            onChange={(v) => update(q.id, v)}
          />
        </View>
      ))}
    </View>
  );
}

function FieldRenderer({
  question,
  value,
  onChange,
}: {
  question: IntakeQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  const colors = useColors();

  switch (question.type) {
    case "short_text":
      return (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={question.placeholder || "Type your answer"}
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.textInput,
            {
              color: colors.foreground,
              borderColor: colors.border,
              backgroundColor: colors.background,
              fontFamily: "Inter_500Medium",
            },
          ]}
        />
      );
    case "long_text":
      return (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={question.placeholder || "Type your answer"}
          placeholderTextColor={colors.mutedForeground}
          multiline
          style={[
            styles.textArea,
            {
              color: colors.foreground,
              borderColor: colors.border,
              backgroundColor: colors.background,
              fontFamily: "Inter_400Regular",
            },
          ]}
        />
      );
    case "number": {
      const unitHint = question.unit ? ` (${question.unit})` : "";
      const placeholder =
        question.placeholder ||
        (question.unit
          ? `e.g. about 30 ${question.unit}`
          : "Type your answer");
      return (
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={`${placeholder}${question.placeholder ? unitHint : ""}`}
          placeholderTextColor={colors.mutedForeground}
          multiline
          style={[
            styles.textArea,
            {
              color: colors.foreground,
              borderColor: colors.border,
              backgroundColor: colors.background,
              fontFamily: "Inter_400Regular",
              minHeight: 60,
            },
          ]}
        />
      );
    }
    case "single_select": {
      const otherSelected = isOtherEntry(value);
      const builtIn = (question.options ?? []).filter(
        (o) => o.toLowerCase() !== "other",
      );
      return (
        <View style={{ gap: 10 }}>
          <View style={styles.choices}>
            {builtIn.map((opt) => {
              const selected = !otherSelected && value === opt;
              return (
                <Pressable
                  key={opt}
                  onPress={() => onChange(opt)}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: selected ? colors.primary : colors.background,
                      borderColor: selected ? colors.primary : colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: selected ? colors.primaryForeground : colors.foreground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    {opt}
                  </Text>
                </Pressable>
              );
            })}
            <OtherChip
              selected={otherSelected}
              onPress={() => onChange(otherSelected ? "" : OTHER_LABEL)}
            />
          </View>
          {otherSelected ? (
            <OtherInput
              value={otherEntryText(value)}
              onChange={(t) => onChange(buildOtherEntry(t))}
            />
          ) : null}
        </View>
      );
    }
    case "multi_select": {
      const items = splitMulti(value);
      const otherItem = items.find(isOtherEntry);
      const otherSelected = Boolean(otherItem);
      const builtIn = (question.options ?? []).filter(
        (o) => o.toLowerCase() !== "other",
      );
      const set = new Set(items.filter((s) => !isOtherEntry(s)));

      const toggleBuiltIn = (opt: string) => {
        const next = new Set(set);
        if (next.has(opt)) next.delete(opt);
        else next.add(opt);
        const list = Array.from(next);
        if (otherItem) list.push(otherItem);
        onChange(joinMulti(list));
      };

      const toggleOther = () => {
        const list = Array.from(set);
        if (!otherSelected) list.push(OTHER_LABEL);
        onChange(joinMulti(list));
      };

      const updateOtherText = (t: string) => {
        const list = Array.from(set);
        list.push(buildOtherEntry(t));
        onChange(joinMulti(list));
      };

      return (
        <View style={{ gap: 10 }}>
          <View style={styles.choices}>
            {builtIn.map((opt) => {
              const selected = set.has(opt);
              return (
                <Pressable
                  key={opt}
                  onPress={() => toggleBuiltIn(opt)}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: selected ? colors.primary : colors.background,
                      borderColor: selected ? colors.primary : colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  {selected ? (
                    <Feather
                      name="check"
                      size={13}
                      color={colors.primaryForeground}
                      style={{ marginRight: 4 }}
                    />
                  ) : null}
                  <Text
                    style={[
                      styles.chipText,
                      {
                        color: selected ? colors.primaryForeground : colors.foreground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    {opt}
                  </Text>
                </Pressable>
              );
            })}
            <OtherChip selected={otherSelected} onPress={toggleOther} />
          </View>
          {otherSelected ? (
            <OtherInput
              value={otherEntryText(otherItem ?? "")}
              onChange={updateOtherText}
            />
          ) : null}
        </View>
      );
    }
    default:
      return null;
  }
}

function OtherChip({
  selected,
  onPress,
}: {
  selected: boolean;
  onPress: () => void;
}) {
  const colors = useColors();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.background,
          borderColor: selected ? colors.primary : colors.border,
          borderStyle: selected ? "solid" : "dashed",
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <Feather
        name={selected ? "edit-3" : "plus"}
        size={13}
        color={selected ? colors.primaryForeground : colors.mutedForeground}
        style={{ marginRight: 4 }}
      />
      <Text
        style={[
          styles.chipText,
          {
            color: selected ? colors.primaryForeground : colors.mutedForeground,
            fontFamily: "Inter_500Medium",
          },
        ]}
      >
        Other
      </Text>
    </Pressable>
  );
}

function OtherInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const colors = useColors();
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="Describe your own answer"
      placeholderTextColor={colors.mutedForeground}
      multiline
      style={[
        styles.textArea,
        {
          color: colors.foreground,
          borderColor: colors.border,
          backgroundColor: colors.background,
          fontFamily: "Inter_400Regular",
          minHeight: 70,
        },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 14,
  },
  card: {
    padding: 18,
    borderWidth: 1,
    gap: 14,
  },
  headerRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  numWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  numText: {
    fontSize: 12,
  },
  label: {
    fontSize: 15.5,
    lineHeight: 21,
  },
  helper: {
    fontSize: 13,
    lineHeight: 18,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14.5,
    lineHeight: 21,
    minHeight: 100,
    textAlignVertical: "top",
  },
  numberRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 4,
    gap: 10,
  },
  numberInput: {
    flex: 1,
    fontSize: 18,
    paddingVertical: 10,
  },
  unitText: {
    fontSize: 13,
    letterSpacing: 0.4,
  },
  choices: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
  },
  chipText: {
    fontSize: 13,
    letterSpacing: 0.2,
  },
});
