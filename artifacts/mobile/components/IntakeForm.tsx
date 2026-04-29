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

function toMap(answers?: IntakeAnswer[]): AnswerMap {
  const m: AnswerMap = {};
  if (answers) for (const a of answers) m[a.questionId] = a.value;
  return m;
}

function toAnswers(map: AnswerMap): IntakeAnswer[] {
  return Object.entries(map).map(([questionId, value]) => ({ questionId, value }));
}

export function validateIntake(
  questions: IntakeQuestion[],
  answers: IntakeAnswer[],
): { ok: boolean; missingIds: string[] } {
  const map = toMap(answers);
  const missing: string[] = [];
  for (const q of questions) {
    if (!q.required) continue;
    const val = map[q.id]?.trim() ?? "";
    if (val.length === 0) missing.push(q.id);
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
    case "number":
      return (
        <View
          style={[
            styles.numberRow,
            {
              borderColor: colors.border,
              backgroundColor: colors.background,
              borderRadius: 12,
            },
          ]}
        >
          <TextInput
            value={value}
            onChangeText={(t) => onChange(t.replace(/[^0-9]/g, ""))}
            placeholder={question.placeholder || "0"}
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
            style={[
              styles.numberInput,
              { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
            ]}
          />
          {question.unit ? (
            <Text
              style={[
                styles.unitText,
                { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
              ]}
            >
              {question.unit}
            </Text>
          ) : null}
        </View>
      );
    case "single_select":
      return (
        <View style={styles.choices}>
          {(question.options ?? []).map((opt) => {
            const selected = value === opt;
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
        </View>
      );
    case "multi_select": {
      const set = new Set(
        value
          .split("|")
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      );
      const toggle = (opt: string) => {
        const next = new Set(set);
        if (next.has(opt)) next.delete(opt);
        else next.add(opt);
        onChange(Array.from(next).join("|"));
      };
      return (
        <View style={styles.choices}>
          {(question.options ?? []).map((opt) => {
            const selected = set.has(opt);
            return (
              <Pressable
                key={opt}
                onPress={() => toggle(opt)}
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
        </View>
      );
    }
    default:
      return null;
  }
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
