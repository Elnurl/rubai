import type { UserBehavioralState } from "@workspace/db";
import { MODEL_SMART, MODEL_FAST } from "./aiConfig";

/**
 * Subscription tier from the users table.
 * "free"    → basic coaching, fast model only
 * "pro"     → smart model + energy/procrastination awareness
 * "premium" → full multi-signal orchestration (energy + mood + cognitive load + flow)
 */
export type SubscriptionTier = "free" | "pro" | "premium";

export interface OrchestrationConfig {
  /** Primary model to use for this coach turn */
  model: string;
  /**
   * Tone directive injected into the system prompt.
   * e.g. "Be warm and encouraging" | "Be direct and push" | "Be gentle"
   */
  tone: string;
  /**
   * Response depth directive.
   * "concise" | "detailed" | "step_by_step"
   */
  depth: string;
  /**
   * Focus directive — what the coach should prioritise.
   * "one_step" | "big_picture" | "reflection" | "momentum"
   */
  focus: string;
  /**
   * Optional paragraph appended to the system prompt with behaviorally
   * derived instructions. Null when orchestration is not active (free tier).
   */
  behavioralAddendum: string | null;
}

/**
 * Build an orchestration config from the user's behavioral state and tier.
 *
 * Free tier:   MODEL_FAST, no behavioral shaping
 * Pro tier:    MODEL_SMART + energy/procrastination-aware tone
 * Premium:     Full orchestration — all signals → model + tone + depth + focus
 */
export function buildOrchestrationConfig(
  state: UserBehavioralState,
  tier: SubscriptionTier,
): OrchestrationConfig {
  // ── Free tier — minimal, fast ────────────────────────────────
  if (tier === "free") {
    return {
      model: MODEL_FAST,
      tone: "Be warm and supportive.",
      depth: "concise",
      focus: "one_step",
      behavioralAddendum: null,
    };
  }

  // ── Pro tier — smart model + energy + procrastination ────────
  if (tier === "pro") {
    const energyLow = state.energyLevel < 0.35;
    const procHigh = state.procrastinationRisk === "high";

    const tone = energyLow
      ? "Be gentle and encouraging — the user is low-energy today."
      : procHigh
        ? "Be firm but compassionate — acknowledge difficulty, then redirect to action."
        : "Be warm, direct, and energising.";

    const focus = procHigh ? "one_step" : state.flowDetected ? "momentum" : "big_picture";

    return {
      model: MODEL_SMART,
      tone,
      depth: energyLow ? "concise" : "detailed",
      focus,
      behavioralAddendum:
        `BEHAVIORAL SIGNAL (Pro): Energy=${(state.energyLevel * 100).toFixed(0)}%, ` +
        `Procrastination risk=${state.procrastinationRisk}, ` +
        `Flow=${state.flowDetected ? "yes" : "no"}. ` +
        tone,
    };
  }

  // ── Premium tier — full multi-signal orchestration ───────────
  const energyLow = state.energyLevel < 0.35;
  const energyHigh = state.energyLevel > 0.75;
  const moodNeg = state.moodScore < -0.3;
  const moodPos = state.moodScore > 0.3;
  const loadHigh = state.cognitiveLoad > 0.7;
  const procHigh = state.procrastinationRisk === "high";
  const procMed = state.procrastinationRisk === "medium";

  // Model: stay on SMART (Premium always gets full model)
  const model = MODEL_SMART;

  // Tone
  let tone: string;
  if (moodNeg && energyLow) {
    tone = "Be deeply empathetic and validating first — only then gently redirect to action.";
  } else if (state.flowDetected) {
    tone = "Match the user's momentum — be energising, fast-paced, celebrate their flow state.";
  } else if (procHigh && moodPos) {
    tone = "Channel their positive energy into overcoming procrastination — be direct and action-focused.";
  } else if (loadHigh) {
    tone = "Keep it simple and calming — the user is cognitively overloaded. One thing at a time.";
  } else if (energyHigh && moodPos) {
    tone = "Be ambitious and stretching — this user is in peak state, push for breakthrough.";
  } else {
    tone = "Be balanced, warm, and precise — ground every point in their real context.";
  }

  // Depth
  const depth: "concise" | "detailed" | "step_by_step" =
    loadHigh || energyLow ? "concise" : procHigh ? "step_by_step" : "detailed";

  // Focus
  const focus: "one_step" | "big_picture" | "reflection" | "momentum" =
    state.flowDetected
      ? "momentum"
      : procHigh
        ? "one_step"
        : loadHigh
          ? "reflection"
          : energyHigh
            ? "big_picture"
            : "one_step";

  // Peak hours context
  const peakHoursArr = (state.peakHours as number[]) ?? [];
  const peakContext =
    peakHoursArr.length > 0
      ? ` User's peak productivity hours: ${peakHoursArr.join(", ")}h.`
      : "";

  const behavioralAddendum =
    `BEHAVIORAL ORCHESTRATION (Premium): ` +
    `Energy=${(state.energyLevel * 100).toFixed(0)}%, ` +
    `Mood=${state.moodScore >= 0 ? "+" : ""}${state.moodScore.toFixed(2)}, ` +
    `CognitiveLoad=${(state.cognitiveLoad * 100).toFixed(0)}%, ` +
    `ProcrastinationRisk=${state.procrastinationRisk}, ` +
    `Flow=${state.flowDetected ? "ACTIVE" : "off"}, ` +
    `MotivationType=${state.motivationType}.${peakContext} ` +
    `Directive: ${tone} Depth: ${depth}. Focus: ${focus}.`;

  return {
    model,
    tone,
    depth,
    focus,
    behavioralAddendum,
  };
}
