import { describe, it, expect } from "vitest";
import {
  coachResponseValidator,
  intakeQuestionsValidator,
  pickStreamFallbackReply,
} from "./atlas";

const baseValidCoach = {
  reply: "Salam, bu gün necə hiss edirsən?",
  suggestedReplies: ["Yaxşı", "Pis", "Orta"],
  actionSuggestion: null,
  memoryUpdate: null,
  proposedAction: null,
};

const validQuestion = {
  id: "q1",
  label: "Məqsədin nədir?",
  helper: "",
  type: "short_text" as const,
  placeholder: "",
  options: [],
  unit: "",
  required: true,
};

describe("coachResponseValidator — Phase 3 wire-bound regressions", () => {
  it("accepts a well-formed coach response", () => {
    expect(() => coachResponseValidator.parse(baseValidCoach)).not.toThrow();
  });

  it("rejects suggestedReplies longer than 3 items", () => {
    const tooMany = {
      ...baseValidCoach,
      suggestedReplies: ["a", "b", "c", "d"],
    };
    expect(() => coachResponseValidator.parse(tooMany)).toThrow();
  });

  it("rejects a suggestedReplies item longer than 50 characters", () => {
    const tooLong = {
      ...baseValidCoach,
      suggestedReplies: ["x".repeat(51)],
    };
    expect(() => coachResponseValidator.parse(tooLong)).toThrow();
  });

  it("accepts boundary values: exactly 3 items, exactly 50 chars each", () => {
    const boundary = {
      ...baseValidCoach,
      suggestedReplies: ["x".repeat(50), "y".repeat(50), "z".repeat(50)],
    };
    expect(() => coachResponseValidator.parse(boundary)).not.toThrow();
  });
});

describe("intakeQuestionsValidator — Phase 3 wire-bound regressions", () => {
  const buildPayload = (count: number) => ({
    introMessage: "Salam!",
    questions: Array.from({ length: count }, (_, i) => ({
      ...validQuestion,
      id: `q${i + 1}`,
    })),
  });

  it("accepts 6 questions (lower bound)", () => {
    expect(() => intakeQuestionsValidator.parse(buildPayload(6))).not.toThrow();
  });

  it("accepts 10 questions (upper bound)", () => {
    expect(() => intakeQuestionsValidator.parse(buildPayload(10))).not.toThrow();
  });

  it("rejects 5 questions (below lower bound)", () => {
    expect(() => intakeQuestionsValidator.parse(buildPayload(5))).toThrow();
  });

  it("rejects 11 questions (above upper bound)", () => {
    expect(() => intakeQuestionsValidator.parse(buildPayload(11))).toThrow();
  });

  it("rejects 0 questions", () => {
    expect(() => intakeQuestionsValidator.parse(buildPayload(0))).toThrow();
  });
});

describe("pickStreamFallbackReply — /coach/stream parse-failure path", () => {
  it("returns the parsedJson unchanged when parse succeeded", () => {
    const parsed = { reply: "AI structured reply", suggestedReplies: ["a"] };
    const result = pickStreamFallbackReply(parsed, "ignored stream text", false);
    expect(result).toBe(parsed);
  });

  it("returns parsedJson unchanged when parse failed but streamedReply is empty", () => {
    const parsed = {};
    const result = pickStreamFallbackReply(parsed, "", true);
    expect(result).toBe(parsed);
  });

  it("returns parsedJson unchanged when parse failed but streamedReply is whitespace-only", () => {
    const parsed = {};
    const result = pickStreamFallbackReply(parsed, "   \n\t  ", true);
    expect(result).toBe(parsed);
  });

  it("returns { reply: streamedReply } when parse failed and streamedReply is non-empty", () => {
    const parsed = {};
    const streamed = "Salam, bu gün üçün üç tapşırıq təklif edim.";
    const result = pickStreamFallbackReply(parsed, streamed, true);
    expect(result).toEqual({ reply: streamed });
    // Crucially, this is NOT the generic English fallback that
    // normalizeCoachOutput({}) would otherwise produce.
    expect(result.reply).not.toMatch(/I'm here\. Tell me/i);
  });

  it("preserves streamed reply text even if parsed had a (rejected) reply field", () => {
    // Simulating: validator rejected, parsedJson was reset to {} before
    // calling the helper. The helper should never pick parsed.reply when
    // parseFailed is true and streamedReply has content.
    const parsed = { reply: "junk that failed validation" };
    const streamed = "Real user-visible streamed text";
    const result = pickStreamFallbackReply(parsed, streamed, true);
    expect(result).toEqual({ reply: streamed });
  });
});
