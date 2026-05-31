import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import multer from "multer";
import { z } from "zod";
import { toFile } from "openai/uploads";
import { zodResponseFormat } from "openai/helpers/zod";
import { openai } from "@workspace/integrations-openai-ai-server";
import { db, usersTable } from "@workspace/db";
import { logBehavioralEvent } from "../lib/behavioralEvents";
import {
  getBehavioralState,
  recomputeBehavioralStateAsync,
} from "../lib/behavioralAnalytics";
import {
  buildOrchestrationConfig,
  type SubscriptionTier,
} from "../lib/behavioralOrchestration";
import { trackedCreate, trackedStream } from "../lib/aiUsage";
import {
  parseAndValidate,
  strictJsonCompletion,
  StrictJsonError,
} from "../lib/strictJson";
import {
  MODEL_SMART,
  MODEL_FAST,
  MODEL_VISION,
  ModerationError,
  moderateOrThrow,
  pickCoachModel,
} from "../lib/aiConfig";
import { ReplyTextExtractor } from "../lib/replyTextExtractor";
import {
  hashKey as cacheHashKey,
  getCached,
  setCached,
} from "../lib/dailyPlanCache";
import { sendPushTo } from "../lib/pushScheduler";
import { retrieveRelevantContext } from "../lib/ragRetrieval";
import {
  AtlasOnboardingChatBody as atlasOnboardingChatBody,
  AtlasGenerateRoadmapBody as atlasGenerateRoadmapBody,
  AtlasGenerateDailyPlanBody as atlasGenerateDailyPlanBody,
  AtlasCoachBody as atlasCoachBody,
  AtlasAdaptPlanBody as atlasAdaptPlanBody,
  AtlasIntakeQuestionsBody as atlasIntakeQuestionsBody,
  AtlasIntakeSubmitBody as atlasIntakeSubmitBody,
  AtlasGenerateTitleBody as atlasGenerateTitleBody,
  AtlasBehavioralProfileBody as atlasBehavioralProfileBody,
  AtlasEvolveRoadmapBody as atlasEvolveRoadmapBody,
  AtlasRegisterPushTokenBody as atlasRegisterPushTokenBody,
  AtlasAnalyzeReflectionImageBody as atlasAnalyzeReflectionImageBody,
} from "@workspace/api-zod";

// Shared reflection-line builder. Used by buildCoachContext, behavioural
// profile and evolve-roadmap so the AI sees voice transcripts and the
// pre-computed image analysis from `/atlas/analyze-reflection-image`
// uniformly across every prompt.
function formatReflectionLine(
  r: {
    taskTitle: string;
    date: string;
    completed: boolean;
    reasonTag?: string | null;
    note?: string | null;
    noteAudioTranscript?: string | null;
    noteImageAnalysis?: string | null;
  },
  bullet: string,
): string {
  const status = r.completed ? "done" : "skipped";
  const reason = r.reasonTag ? ` [${r.reasonTag}]` : "";
  const note = r.note ? ` — "${r.note}"` : "";
  const voice = r.noteAudioTranscript
    ? ` [voice note: "${r.noteAudioTranscript}"]`
    : "";
  const image = r.noteImageAnalysis
    ? ` [photo: ${r.noteImageAnalysis}]`
    : "";
  return `${bullet}${r.date} • ${status} • ${r.taskTitle}${reason}${note}${voice}${image}`;
}

function summarizeLearnedProfile(p: unknown): string {
  if (!p || typeof p !== "object") return "";
  const lp = p as {
    summary?: string;
    consistencyLevel?: string;
    workloadTolerance?: string;
    motivationTrend?: string;
    focusStyle?: string;
    learningPreference?: string;
    peakHours?: string[];
    failurePatterns?: string[];
    strengths?: string[];
    recommendedAdjustments?: string[];
  };
  const lines: string[] = [];
  if (lp.summary) lines.push(`Summary: ${lp.summary}`);
  const traits: string[] = [];
  if (lp.consistencyLevel) traits.push(`consistency=${lp.consistencyLevel}`);
  if (lp.workloadTolerance) traits.push(`workload=${lp.workloadTolerance}`);
  if (lp.motivationTrend) traits.push(`motivation=${lp.motivationTrend}`);
  if (lp.focusStyle) traits.push(`focus=${lp.focusStyle}`);
  if (lp.learningPreference) traits.push(`learning=${lp.learningPreference}`);
  if (traits.length > 0) lines.push(`Traits: ${traits.join(", ")}`);
  if (lp.peakHours && lp.peakHours.length > 0)
    lines.push(`Peak hours: ${lp.peakHours.join(", ")}`);
  if (lp.strengths && lp.strengths.length > 0)
    lines.push(`Strengths: ${lp.strengths.join("; ")}`);
  if (lp.failurePatterns && lp.failurePatterns.length > 0)
    lines.push(`Failure patterns to avoid: ${lp.failurePatterns.join("; ")}`);
  if (lp.recommendedAdjustments && lp.recommendedAdjustments.length > 0)
    lines.push(`Recommended adjustments: ${lp.recommendedAdjustments.join("; ")}`);
  return lines.join("\n");
}

const router: IRouter = Router();

// Local alias kept so the existing `model: MODEL` call sites don't need
// to change. Source of truth lives in `lib/aiConfig.ts` (env-driven).
const MODEL = MODEL_SMART;
// `MODEL_FAST` and `MODEL_VISION` are re-exported via the import above
// so the rest of this file can use them unchanged.
void MODEL_FAST;
void MODEL_VISION;

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // Whisper hard cap
});

/**
 * Multer middleware errors (oversize file, malformed multipart) are
 * delivered via the next(err) channel and otherwise fall through to the
 * generic Express error handler. Wrap the upload so we always respond with
 * a structured JSON 4xx the mobile client can show.
 */
function audioUploadMiddleware(field: string) {
  const handler = audioUpload.single(field);
  return (
    req: import("express").Request,
    res: import("express").Response,
    next: import("express").NextFunction,
  ) => {
    handler(req, res, (err) => {
      if (!err) return next();
      const code = (err as { code?: string }).code;
      const status = code === "LIMIT_FILE_SIZE" ? 413 : 400;
      const message =
        code === "LIMIT_FILE_SIZE"
          ? "Audio file exceeds the 25MB limit."
          : err instanceof Error
            ? err.message
            : "Upload failed.";
      res.status(status).json({ error: message });
    });
  };
}

const goalLabels: Record<string, string> = {
  ielts: "IELTS Preparation",
  car: "Buying a Car",
  programming: "Learning Programming",
  fitness: "Fitness Goals",
  finance: "Financial Improvement",
};

function resolveGoalLabel(goalType: string, customGoalTitle?: string | null): string {
  if (goalType === "custom") {
    const trimmed = customGoalTitle?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : "Custom Goal";
  }
  return goalLabels[goalType] ?? "Custom Goal";
}

const onboardingPersona = (goalType: string, customGoalTitle?: string | null) => {
  const label = resolveGoalLabel(goalType, customGoalTitle);
  const isCustom = goalType === "custom";
  return `You are rabai — a strategic, no-fluff AI execution coach inside a mobile app.
The user has selected the goal: ${label}.${isCustom ? " This is a user-defined goal, so you must figure out the right shape of the plan from the conversation itself — do not assume any specific domain." : ""}

Your job in this onboarding conversation is to deeply understand the user so the system can build a realistic, personalized roadmap. Ask ONE focused question at a time. Be warm but precise. Avoid generic chit-chat. Avoid emojis.

You must learn:
- their concrete goal statement and target deadline
- current skill / starting point for ${label}
- realistic time available per day (in minutes)
- financial condition relevant to this goal
- productivity patterns (when they focus best)
- consistency level and recent track record
- constraints and limitations (work, family, environment)

Rules:
- Ask one question at a time. Reference what they've already told you.
- After 6 to 8 substantive exchanges (you've collected enough to build a real plan), do NOT ask another question. Instead respond with a final confirmation message that summarizes what you understood, in one short paragraph.
- The system, not you, decides when the data is structured. Just keep the conversation flowing.
- Never use markdown headings, bullet lists, or numbered lists. Speak conversationally.
- Keep replies under 70 words.`;
};

// POST /atlas/session-start
// Lightweight endpoint — logs a session_started behavioral event and triggers
// an async state recompute. Called fire-and-forget from the coach tab on focus.
router.post("/session-start", async (req, res) => {
  if (typeof req.userId === "number") {
    logBehavioralEvent(req.userId, "session_started", {
      hourOfDay: new Date().getHours(),
    });
    recomputeBehavioralStateAsync(req.userId);
  }
  res.status(204).end();
});

router.post("/onboarding-chat", async (req, res) => {
  const parsed = atlasOnboardingChatBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { goalType, customGoalTitle, history } = parsed.data;

  try {
    const messages = [
      { role: "system" as const, content: onboardingPersona(goalType, customGoalTitle) },
      ...history.map((m: { role: string; content: string }) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
    ];

    // First — generate the next conversational reply
    const conversational = await trackedCreate(req, {
      model: MODEL,
      max_completion_tokens: 400,
      messages,
    });
    const nextMessage = conversational.choices[0]?.message?.content?.trim() ?? "";

    // Then — decide whether enough data has been collected to build a plan
    const userTurns = history.filter(
      (m: { role: string }) => m.role === "user",
    ).length;
    if (userTurns < 5) {
      res.json({ message: nextMessage, isComplete: false, profile: null });
      return;
    }

    const parsedExtraction = (await strictJsonCompletion(
      req,
      {
        model: MODEL,
        max_completion_tokens: 1500,
        response_format: zodResponseFormat(
          profileExtractorValidator,
          "onboarding_extraction",
        ),
        messages: [
          {
            role: "system",
            content: `You analyze an onboarding chat and decide if enough has been gathered to build a realistic roadmap for the goal: ${resolveGoalLabel(goalType, customGoalTitle)}.

If sufficient data is present (concrete goal, timeline, current level, daily time, productivity window, constraints), set isComplete=true and produce a structured profile. Otherwise isComplete=false and profile=null.

When isComplete=true, set nextMessage to a brief confirmation (under 60 words, conversational, no lists, no emojis) summarizing what rabai understood and announcing the roadmap is being built.

When isComplete=false, set nextMessage to: ${JSON.stringify(nextMessage)}`,
          },
          {
            role: "user",
            content: JSON.stringify({ goalType, history }),
          },
        ],
      },
      profileExtractorValidator,
    )) as {
      isComplete: boolean;
      nextMessage: string;
      profile:
        | null
        | {
            goalStatement: string;
            currentLevel: string;
            availableTimePerDayMinutes: number;
            financialCondition: string;
            productivityPattern: string;
            consistencyLevel: string;
            constraints: string[];
            targetTimelineWeeks: number;
            notes: string;
          };
    };

    res.json({
      message: parsedExtraction.nextMessage || nextMessage,
      isComplete: parsedExtraction.isComplete,
      profile: parsedExtraction.profile
        ? {
            goalType,
            ...(goalType === "custom" && customGoalTitle
              ? { customGoalTitle }
              : {}),
            ...parsedExtraction.profile,
          }
        : null,
    });
  } catch (err) {
    if (err instanceof StrictJsonError && err.kind === "refusal") {
      req.log.warn({ details: err.details }, "onboarding-chat refusal from model");
      res.status(400).json({ error: "Model refused to respond" });
      return;
    }
    req.log.error({ err }, "onboarding-chat failed");
    res.status(500).json({ error: "AI request failed" });
  }
});

router.post("/roadmap", async (req, res) => {
  const parsed = atlasGenerateRoadmapBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { profile } = parsed.data;

  try {
    const data = await strictJsonCompletion(
      req,
      {
        model: MODEL,
        max_completion_tokens: 4000,
        response_format: zodResponseFormat(roadmapValidator, "roadmap"),
        messages: [
          {
            role: "system",
            content: `You are rabai — an AI strategic execution coach. Build a personalized, realistic roadmap for whatever goal the user has set, in any domain (fitness, study, career, life-design, creative work, finance, relationships, side-projects — anything).

Constraints:
- 3 to 5 phases. Each phase 2-6 weeks, with 2-4 milestones.
- Total duration must respect targetTimelineWeeks.
- Tasks/milestones must be CONCRETE and real-world (e.g. "Take a full IELTS mock listening test", "Submit your portfolio to 5 design studios", "Cook 3 different sourdough loaves this week"), never abstract.
- Phase ids: phase-1, phase-2, ... Milestone ids: m-1-1, m-1-2, ...
- Headline: 6-9 words, motivating and specific to this exact goal.
- Strategy: 1 short paragraph (under 70 words) explaining the approach.
- riskAnalysis: 2-4 short bullet strings identifying realistic obstacles for THIS user.
- Adapt difficulty to the stated current level, available time, and consistency.
- No emojis. No markdown.
- LANGUAGE RULE: Write ALL text (headline, strategy, riskAnalysis, phase titles, focus text, milestone titles and descriptions) in the same language as the user's goal. Match the language of the user's profile data exactly.`,
          },
          {
            role: "user",
            content: `Build a roadmap for this user profile (goal: ${resolveGoalLabel(profile.goalType, profile.customGoalTitle)}):\n${JSON.stringify(profile, null, 2)}`,
          },
        ],
      },
      roadmapValidator,
    );
    res.json({ goalType: profile.goalType, ...data });
  } catch (err) {
    if (err instanceof StrictJsonError && err.kind === "refusal") {
      req.log.warn({ details: err.details }, "roadmap refusal from model");
      res.status(400).json({ error: "Model refused to respond" });
      return;
    }
    req.log.error({ err }, "roadmap generation failed");
    res.status(500).json({ error: "AI request failed" });
  }
});

router.post("/daily-plan", async (req, res) => {
  const parsed = atlasGenerateDailyPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { profile, roadmap, behavioral, learnedProfile, date, currentWeek, calendarContext } = parsed.data;
  const learnedSummary = summarizeLearnedProfile(learnedProfile);
  const calendarBlock =
    calendarContext && calendarContext.trim().length > 0
      ? `\n\nTODAY'S CALENDAR (schedule around these existing commitments; suggest concrete time slots in coachNote when helpful):\n${calendarContext.trim()}`
      : "";

  // Cache key encodes everything that can change the plan output. If the
  // client re-asks for the same date with the same inputs we serve the
  // previous plan instead of paying for a regeneration. Cache hits are
  // intentionally NOT recorded in `ai_usage` — they aren't AI calls.
  const cacheKey = cacheHashKey({
    userId: req.userId ?? "anon",
    date,
    currentWeek,
    profile,
    roadmap,
    behavioral,
    learnedProfile,
    calendarContext: calendarContext ?? "",
  });
  const cached = getCached<Record<string, unknown>>(cacheKey);
  if (cached) {
    req.log.info({ cacheKey }, "daily-plan cache hit");
    res.json({ date, ...cached });
    return;
  }

  try {
    const data = await strictJsonCompletion(
      req,
      {
        model: MODEL,
        max_completion_tokens: 2500,
        response_format: zodResponseFormat(dailyPlanValidator, "daily_plan"),
        messages: [
          {
            role: "system",
            content: `You are rabai. Generate today's actionable execution plan for the user.

Rules:
- 3 to 5 tasks. Each task practical, real-world, finishable today.
- Total duration must respect availableTimePerDayMinutes (be realistic, leave buffer).
- Match tasks to the active roadmap phase for week ${currentWeek}.
- Adapt difficulty using the behavioral data — if completionRate is below 0.5 or streak is 0, simplify and use shorter tasks.
- If a LEARNED PROFILE block is provided, weight it heavily: respect the user's peak hours when ordering, calibrate intensity to workloadTolerance and consistencyLevel, lean into known strengths, and structure tasks to avoid the listed failure patterns. Apply any recommendedAdjustments unless they conflict with safety or the active phase.
- Task ids must be unique and short (e.g. "t-1", "t-2").
- focusOfTheDay: 5-9 word headline.
- coachNote: 1-2 sentence personal nudge from rabai referencing the user's recent behaviour or learned profile.
- No emojis. No markdown.
- LANGUAGE RULE: Write ALL text (task titles, focusOfTheDay, coachNote) in the same language as the user's profile and goal data.`,
          },
          {
            role: "user",
            content: `Date: ${date}\nProfile: ${JSON.stringify(profile)}\nRoadmap: ${JSON.stringify(roadmap)}\nBehavioral snapshot: ${JSON.stringify(behavioral)}${learnedSummary ? `\n\nLEARNED PROFILE:\n${learnedSummary}` : ""}${calendarBlock}`,
          },
        ],
      },
      dailyPlanValidator,
    );
    setCached(cacheKey, data);
    res.json({ date, ...data });
  } catch (err) {
    if (err instanceof StrictJsonError && err.kind === "refusal") {
      req.log.warn({ details: err.details }, "daily-plan refusal from model");
      res.status(400).json({ error: "Model refused to respond" });
      return;
    }
    req.log.error({ err }, "daily-plan generation failed");
    res.status(500).json({ error: "AI request failed" });
  }
});

type CoachContextInput = {
  profile: { goalType: string; goalStatement: string; availableTimePerDayMinutes: number };
  roadmap: { headline: string; strategy: string; totalWeeks: number };
  todayPlan?: { date: string; focusOfTheDay: string; tasks: { title: string }[] } | undefined;
  behavioral: {
    currentStreakDays: number;
    completionRate: number;
    completedTaskTitles: string[];
    missedTaskTitles: string[];
  };
  learnedProfile?: unknown;
  currentWeek?: number | undefined;
  currentPhase?: {
    title: string;
    focus: string;
    startWeek: number;
    endWeek: number;
    weekIntoPhase: number;
  } | null | undefined;
  recentReflections?: {
    taskTitle: string;
    date: string;
    completed: boolean;
    reasonTag?: string | null;
    note?: string | null;
    noteAudioTranscript?: string | null;
    noteImageAnalysis?: string | null;
  }[];
  recentEvolutions?: {
    evolvedAt: string;
    trigger: string;
    changeSummary: string;
  }[];
  coachMemory?: { summary: string; facts: string[] } | null | undefined;
};

function buildCoachContext(input: CoachContextInput): string {
  const {
    profile,
    roadmap,
    todayPlan,
    behavioral,
    learnedProfile,
    currentWeek,
    currentPhase,
    recentReflections = [],
    recentEvolutions = [],
    coachMemory,
  } = input;

  const blocks: string[] = [];

  blocks.push(
    `GOAL: ${profile.goalStatement} (${profile.goalType}). Daily budget: ${profile.availableTimePerDayMinutes} min.`,
  );

  blocks.push(
    `ROADMAP: "${roadmap.headline}" — ${roadmap.totalWeeks}-week plan. Strategy: ${roadmap.strategy}`,
  );

  if (currentPhase) {
    blocks.push(
      `CURRENT PHASE: "${currentPhase.title}" (weeks ${currentPhase.startWeek}–${currentPhase.endWeek}, week ${currentPhase.weekIntoPhase} into this phase). Focus: ${currentPhase.focus}.${currentWeek ? ` Overall: week ${currentWeek} of ${roadmap.totalWeeks}.` : ""}`,
    );
  } else if (currentWeek) {
    blocks.push(`CURRENT WEEK: ${currentWeek} of ${roadmap.totalWeeks}.`);
  }

  if (todayPlan) {
    blocks.push(
      `TODAY (${todayPlan.date}) — focus: ${todayPlan.focusOfTheDay}. Tasks: ${todayPlan.tasks.map((t) => t.title).join(" | ") || "none"}.`,
    );
  } else {
    blocks.push("TODAY: no daily plan generated yet.");
  }

  blocks.push(
    `RECENT BEHAVIOUR: ${behavioral.currentStreakDays}-day streak, ${(behavioral.completionRate * 100).toFixed(0)}% completion. Recently completed: ${behavioral.completedTaskTitles.slice(0, 5).join("; ") || "none"}. Recently missed: ${behavioral.missedTaskTitles.slice(0, 5).join("; ") || "none"}.`,
  );

  if (recentReflections.length > 0) {
    const lines = recentReflections
      .slice(0, 5)
      .map((r) => formatReflectionLine(r, "  • "))
      .join("\n");
    blocks.push(`RECENT REFLECTIONS (most recent last):\n${lines}`);
  }

  if (recentEvolutions.length > 0) {
    const lines = recentEvolutions
      .slice(0, 3)
      .map((e) => `  • ${e.evolvedAt} (${e.trigger}): ${e.changeSummary}`)
      .join("\n");
    blocks.push(`RECENT ROADMAP EVOLUTIONS:\n${lines}`);
  }

  const learnedSummary = summarizeLearnedProfile(learnedProfile);
  if (learnedSummary) {
    blocks.push(`LEARNED PROFILE:\n${learnedSummary}`);
  }

  if (coachMemory && (coachMemory.summary || coachMemory.facts.length > 0)) {
    const factLines =
      coachMemory.facts.length > 0
        ? `\nFACTS YOU KNOW:\n${coachMemory.facts.map((f) => `  • ${f}`).join("\n")}`
        : "";
    blocks.push(
      `LONG-TERM COACH MEMORY:\n${coachMemory.summary || "(no summary yet)"}${factLines}`,
    );
  }

  return blocks.join("\n\n");
}


// ─────────────────────────────────────────────────────────────────────────────
// Phase 3: Zod is the SINGLE source of truth for every structured AI call.
// `zodResponseFormat(validator, name)` (OpenAI helper) converts each schema
// into the strict JSON-schema OpenAI expects on the wire (additionalProperties
// false, every property required, `.nullable()` → `type:[..., "null"]`) AND
// the SAME validator runs at runtime inside `strictJsonCompletion`, so the
// shape used to constrain the model and the shape parsed afterwards can never
// drift. Anthropic failover routes through the same validators — failures
// there are real shape mismatches worth surfacing, not validator looseness.
//
// Hard rules for editing these:
// - Never use `.optional()` (would emit a property as not-required, which
//   OpenAI strict mode rejects). Use `.nullable()` for fields that may be
//   absent in semantics, and have the model pass `null`.
// - Never use `.passthrough()` (the JSON schema sets additionalProperties
//   false, so unknown keys would be rejected on the wire anyway).
// - Keep enums in sync with downstream consumers (normalizeCoachOutput etc).
// ─────────────────────────────────────────────────────────────────────────────

const coachActionSuggestionValidator = z
  .object({
    // "none" is accepted from the model and normalized to null downstream so
    // the client only ever sees a concrete actionable kind or null.
    kind: z.enum([
      "evolve_roadmap",
      "refresh_insights",
      "reflect_on_task",
      "none",
    ]),
    label: z.string(),
    rationale: z.string(),
  })
  .nullable();

const coachMemoryUpdateValidator = z
  .object({
    summary: z.string(),
    newFacts: z.array(z.string()),
  })
  .nullable();

const coachTaskShape = z.object({
  title: z.string(),
  description: z.string(),
  durationMinutes: z.number().int(),
  category: z.string(),
  priority: z.enum(["critical", "high", "normal"]),
});

const coachProposedTaskValidator = coachTaskShape.nullable();

// Partial edit for an existing task — every field nullable so the model can
// patch only what changed. Strict-mode still requires each key present.
const coachTaskPatchValidator = z
  .object({
    title: z.string().nullable(),
    description: z.string().nullable(),
    durationMinutes: z.number().int().nullable(),
    category: z.string().nullable(),
    priority: z.enum(["critical", "high", "normal"]).nullable(),
  })
  .nullable();

// A single calendar event the coach can add on the user's behalf.
const coachCalendarEventValidator = z
  .object({
    title: z.string(),
    notes: z.string().nullable(),
    startISO: z.string().nullable(),
    durationMinutes: z.number().int().nullable(),
  })
  .nullable();

const coachProposedActionValidator = z
  .object({
    kind: z.enum([
      "addTaskToday",
      "addTasksToday",
      "removeTaskToday",
      "editTaskToday",
      "renameGoal",
      "lightenToday",
      "regenerateDay",
      "syncToCalendar",
      "addCalendarEvent",
      "none",
    ]),
    label: z.string(),
    rationale: z.string(),
    // Strict-mode requires every property to appear in `required`, so every
    // action carries every payload field — populate the ones relevant to the
    // chosen kind, leave the others null/empty.
    task: coachProposedTaskValidator,
    tasks: z.array(coachTaskShape),
    taskPatch: coachTaskPatchValidator,
    taskId: z.string().nullable(),
    taskTitle: z.string().nullable(),
    newTitle: z.string().nullable(),
    removeTaskIds: z.array(z.string()),
    event: coachCalendarEventValidator,
  })
  .nullable();

// Reply may be empty in degenerate cases — normalizeCoachOutput tolerates it.
// `suggestedReplies` keeps the original wire-schema bounds (≤3 tap-targets,
// ≤50 chars each) — these are length/count constraints OpenAI strict mode
// preserves, and runtime Zod enforces them on Anthropic failover output too.
export const coachResponseValidator = z.object({
  reply: z.string(),
  suggestedReplies: z.array(z.string().max(50)).max(3),
  actionSuggestion: coachActionSuggestionValidator,
  memoryUpdate: coachMemoryUpdateValidator,
  proposedAction: coachProposedActionValidator,
});

// Shared description of the proposedAction vocabulary, embedded verbatim into
// BOTH the /coach and /coach/stream system prompts so the model sees the exact
// same action set in either path. The mobile app applies these INSTANTLY and
// shows an Undo affordance — the copy below tells the model to speak as if the
// change is already done.
const PROPOSED_ACTION_RULES = `- "proposedAction": include ONLY when the user is asking you to MODIFY their plan, goal, or calendar in THIS turn. The mobile app APPLIES it immediately and shows the user a short "Undo", so you MAY speak as if it's already done (e.g. "Done — added a 10-min walk to today. Tap undo if that's off."). 'label' is a 2-5 word summary; 'rationale' is one concrete sentence tied to their context. Pick EXACTLY one kind and set the unused payload fields to null/[]:
    • addTaskToday — add ONE task to TODAY. Fill 'task' (title ≤6 words, description, durationMinutes, category, priority).
    • addTasksToday — add SEVERAL tasks to TODAY at once. Fill 'tasks' with 2-8 items, same shape as 'task'. Use when the user lists multiple things.
    • editTaskToday — change an EXISTING today task. Fill 'taskId' + 'taskTitle' from the TODAY tasks list and 'taskPatch' with ONLY the fields to change (leave the rest null).
    • removeTaskToday — drop ONE specific task. Fill 'taskId' + 'taskTitle' from TODAY's tasks.
    • lightenToday — the day is too heavy / they have limited time. Fill 'removeTaskIds' with the lowest-priority task ids to cut.
    • regenerateDay — they want a fresh or different plan for today. No payload.
    • renameGoal — rename the current goal. Fill 'newTitle' (2-5 words, Title Case).
    • syncToCalendar — put TODAY's tasks on their calendar. No payload; the app writes each task as an event.
    • addCalendarEvent — add ONE meeting/event to their calendar. Fill 'event' (title; notes or null; startISO in ISO-8601 if a specific time is implied else null; durationMinutes or null).
  Otherwise return null. Only act when they clearly ask. Reply text and the action must agree. Never repeat an action you already performed on the previous turn. When you reference a behavioral pattern (peak hours, consistency, momentum), state it plainly in 'reply' rather than only pointing them elsewhere.`;

/**
 * Stream fallback resolver. Pulled out as a pure exported helper so the
 * `/coach/stream` end-of-stream degradation path is unit-testable: when the
 * accumulated SSE JSON fails to parse/validate, we MUST keep the reply text
 * the user already saw stream-in instead of replacing it with
 * `normalizeCoachOutput({})`'s generic English fallback.
 */
export function pickStreamFallbackReply(
  parsedJson: CoachRawOutput,
  streamedReply: string,
  parseFailed: boolean,
): CoachRawOutput {
  if (parseFailed && streamedReply.trim().length > 0) {
    return { reply: streamedReply };
  }
  return parsedJson;
}

const profileFieldsValidator = z.object({
  goalStatement: z.string(),
  currentLevel: z.string(),
  availableTimePerDayMinutes: z.number().int(),
  financialCondition: z.string(),
  productivityPattern: z.string(),
  consistencyLevel: z.string(),
  constraints: z.array(z.string()),
  targetTimelineWeeks: z.number().int(),
  notes: z.string(),
});

const profileExtractorValidator = z.object({
  isComplete: z.boolean(),
  nextMessage: z.string(),
  profile: profileFieldsValidator.nullable(),
});

const roadmapMilestoneValidator = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  weekNumber: z.number().int(),
});

const roadmapPhaseValidator = z.object({
  id: z.string(),
  title: z.string(),
  focus: z.string(),
  startWeek: z.number().int(),
  endWeek: z.number().int(),
  milestones: z.array(roadmapMilestoneValidator),
});

const roadmapValidator = z.object({
  headline: z.string(),
  summary: z.string(),
  totalWeeks: z.number().int(),
  strategy: z.string(),
  riskAnalysis: z.array(z.string()),
  phases: z.array(roadmapPhaseValidator),
});

const dailyPlanTaskValidator = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  durationMinutes: z.number().int(),
  category: z.string(),
  priority: z.enum(["critical", "high", "normal"]),
});

const dailyPlanValidator = z.object({
  focusOfTheDay: z.string(),
  coachNote: z.string(),
  tasks: z.array(dailyPlanTaskValidator),
});

const adaptValidator = z.object({
  difficultyAdjustment: z.enum(["easier", "same", "harder"]),
  adjustments: z.array(z.string()),
  encouragement: z.string(),
});

const generateTitleValidator = z.object({
  title: z.string(),
});

const intakeQuestionValidator = z.object({
  id: z.string(),
  label: z.string(),
  helper: z.string(),
  type: z.enum([
    "short_text",
    "long_text",
    "single_select",
    "multi_select",
    "number",
  ]),
  placeholder: z.string(),
  options: z.array(z.string()),
  unit: z.string(),
  required: z.boolean(),
});

// `questions` keeps the original wire-schema bounds (6-10) — these
// length/count constraints are preserved by zod-to-json-schema under OpenAI
// strict mode, and runtime Zod enforces them on Anthropic failover output
// too. strictJsonCompletion's single retry handles the rare case where the
// model emits a count outside the bound.
export const intakeQuestionsValidator = z.object({
  introMessage: z.string(),
  questions: z.array(intakeQuestionValidator).min(6).max(10),
});

const intakeProfileValidator = z.object({
  profile: profileFieldsValidator,
  followUp: z.string(),
});

const behavioralProfileFieldsValidator = z.object({
  summary: z.string(),
  consistencyLevel: z.enum([
    "very_low",
    "low",
    "moderate",
    "high",
    "very_high",
  ]),
  workloadTolerance: z.enum(["light", "moderate", "heavy"]),
  motivationTrend: z.enum(["rising", "steady", "declining"]),
  focusStyle: z.string(),
  learningPreference: z.string(),
  peakHours: z.array(z.string()),
  failurePatterns: z.array(z.string()),
  strengths: z.array(z.string()),
  recommendedAdjustments: z.array(z.string()),
});

const behavioralProfileValidator = z.object({
  profile: behavioralProfileFieldsValidator,
  aiInsight: z.string(),
});

const roadmapPhaseChangeValidator = z.object({
  phaseId: z.string(),
  phaseTitle: z.string(),
  changeType: z.enum(["added", "removed", "modified", "unchanged"]),
  summary: z.string(),
});

const roadmapEvolutionValidator = z.object({
  evolvedRoadmap: roadmapValidator,
  hasChanged: z.boolean(),
  changeSummary: z.string(),
  phaseChanges: z.array(roadmapPhaseChangeValidator),
  rationale: z.string(),
});

router.post("/coach", async (req, res) => {
  const parsed = atlasCoachBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const {
    profile,
    roadmap,
    todayPlan,
    behavioral,
    learnedProfile,
    currentWeek,
    currentPhase,
    recentReflections,
    recentEvolutions,
    coachMemory,
    history,
    message,
    modelChoice,
    attachmentNote,
    attachmentImage,
    calendarContext,
  } = parsed.data;

  // Run the user's text through OpenAI moderation BEFORE we spend tokens
  // on a smart-model coach turn or feed potentially abusive content into
  // the system prompt. Moderation network failures fall through silently
  // (logged inside the helper) so safety telemetry can never take the
  // coach offline.
  try {
    await moderateOrThrow(message);
  } catch (err) {
    if (err instanceof ModerationError) {
      req.log.warn(
        { categories: err.categories },
        "coach input blocked by moderation",
      );
      res.status(400).json({
        error:
          "I can't respond to that message. Try rephrasing it focused on your goal.",
      });
      return;
    }
    throw err;
  }

  // Validate any attached image before we hand bytes to the vision model.
  // We only accept the formats gpt-4o reliably supports and cap the
  // decoded size to keep latency + spend bounded.
  const ALLOWED_IMAGE_MIMES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ]);
  const MAX_DECODED_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
  if (attachmentImage?.base64Data || attachmentImage?.mimeType) {
    if (
      !attachmentImage.mimeType ||
      !ALLOWED_IMAGE_MIMES.has(attachmentImage.mimeType)
    ) {
      res.status(415).json({
        error: "Unsupported image type. Use JPEG, PNG, WebP, or GIF.",
      });
      return;
    }
    if (!attachmentImage.base64Data) {
      res.status(400).json({ error: "Image attachment is missing data." });
      return;
    }
    // base64 is ~4/3 the size of the decoded payload.
    const decodedBytes = Math.floor((attachmentImage.base64Data.length * 3) / 4);
    if (decodedBytes > MAX_DECODED_IMAGE_BYTES) {
      res.status(413).json({
        error: "Image is too large. Please attach an image under 5 MB.",
      });
      return;
    }
  }

  // If the user attached an image this turn, build a multimodal user
  // message so the vision model can actually look at it. Otherwise fall
  // back to the plain text path (with an optional acknowledgement note
  // for non-image attachments).
  const hasImage = !!attachmentImage?.base64Data && !!attachmentImage?.mimeType;
  const userMessageText = hasImage
    ? `${message}\n\n[The user attached an image. Describe what you see briefly in your reply, then connect it to their goal.]`
    : attachmentNote
    ? `${message}\n\n[The user also attached: ${attachmentNote}. Acknowledge it in one short sentence — you can't see its contents.]`
    : message;
  // Mixed content type the OpenAI chat API accepts on user messages. Kept
  // inline so we don't have to pull the SDK's namespace into this file.
  const userMessageContent: string | Array<
    | { type: "text"; text: string }
    | {
        type: "image_url";
        image_url: { url: string; detail?: "low" | "high" | "auto" };
      }
  > = hasImage
    ? [
        { type: "text", text: userMessageText },
        {
          type: "image_url",
          image_url: {
            url: `data:${attachmentImage!.mimeType};base64,${attachmentImage!.base64Data}`,
            detail: "low",
          },
        },
      ]
    : userMessageText;

  // ── Behavioral Orchestration ──────────────────────────────────────────────
  // Fetch the user's tier + pre-computed behavioral state, then derive
  // an OrchestrationConfig (model, tone, depth, focus, addendum).
  // Both queries are fire-forget safe: on failure we fall back to defaults.
  const [userRecord] = await db
    .select({ tier: usersTable.tier })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1)
    .catch(() => [{ tier: "free" as string }]);

  const tier = (userRecord?.tier ?? "free") as SubscriptionTier;
  const behavioralStateCoach = await getBehavioralState(req.userId!).catch(
    () => ({
      userId: req.userId!,
      energyLevel: 0.5,
      moodScore: 0.0,
      cognitiveLoad: 0.5,
      procrastinationRisk: "low" as const,
      flowDetected: false,
      peakHours: [],
      motivationType: "balanced",
      updatedAt: new Date(),
    }),
  );
  const orchConfig = buildOrchestrationConfig(behavioralStateCoach, tier);

  try {
    const contextBlock = buildCoachContext({
      profile: {
        goalType: profile.goalType,
        goalStatement: profile.goalStatement,
        availableTimePerDayMinutes: profile.availableTimePerDayMinutes,
      },
      roadmap: {
        headline: roadmap.headline,
        strategy: roadmap.strategy,
        totalWeeks: roadmap.totalWeeks,
      },
      todayPlan: todayPlan
        ? {
            date: todayPlan.date,
            focusOfTheDay: todayPlan.focusOfTheDay,
            tasks: todayPlan.tasks.map((t) => ({ title: t.title })),
          }
        : undefined,
      behavioral,
      learnedProfile,
      currentWeek,
      currentPhase,
      recentReflections,
      recentEvolutions,
      coachMemory,
    });

    const systemContext = `You are rabai — a strategic AI execution coach inside a mobile app. The user has come to you for guidance.

Speak conversationally, with warmth and precision. EVERY reply must ground itself in the real context below — reference the current phase, today's tasks, a recent reflection, a learned trait, or a known fact, not generic advice. Push back gently when they make excuses, celebrate small wins, name the pattern you see.

Hard rules:
- "reply" is plain prose. No markdown, headings, bullets, or emojis. Under 110 words unless they explicitly ask for detail.
- "suggestedReplies": 0-3 short follow-ups (<= 50 chars each) that THIS user would plausibly want to send next given THIS context. Each must reference something concrete (a phase name, a reflection reason, a fact). If nothing fits, return [].
- "actionSuggestion": include only when one of these app actions is genuinely warranted right now:
    • evolve_roadmap — they have ≥3 reflections since the last evolution AND the conversation surfaces a real mismatch with the plan.
    • refresh_insights — they're asking about themselves / patterns / "what should I focus on" and the learned profile feels stale.
    • reflect_on_task — they mentioned a specific task they did or skipped and haven't reflected on it.
  Otherwise return null. Don't suggest the same action two turns in a row.
${PROPOSED_ACTION_RULES}
- "memoryUpdate": include ONLY when the user revealed something durable in THIS message (a constraint, preference, life event, identity statement). Otherwise null. The summary you write replaces the prior summary; keep it ≤ 3 sentences. newFacts must not duplicate existing facts.
- If the user goes off-topic, steer back to their goal in one sentence.

CONTEXT:
${contextBlock}${
      calendarContext && calendarContext.trim().length > 0
        ? `\n\nTODAY'S CALENDAR:\n${calendarContext.trim()}`
        : ""
    }${
      typeof req.userId === "number"
        ? await retrieveRelevantContext(req, req.userId, message)
            .then((b) =>
              b
                ? `\n\nRELEVANT MEMORY (semantic retrieval — surface only when it directly helps):\n${b}`
                : "",
            )
            .catch(() => "")
        : ""
    }${orchConfig.behavioralAddendum ? `\n\n${orchConfig.behavioralAddendum}` : ""}`;

    const parsedJson = await strictJsonCompletion(
      req,
      {
        // Vision turns always use the vision model regardless of tier.
        // Otherwise the orchestration config owns model selection.
        model: hasImage ? MODEL_VISION : orchConfig.model,
        max_completion_tokens: 1200,
        response_format: zodResponseFormat(coachResponseValidator, "coach_reply"),
        messages: [
          { role: "system", content: systemContext },
          ...history.map((m: { role: string; content: string }) => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          })),
          { role: "user", content: userMessageContent },
        ],
      },
      coachResponseValidator,
    );
    const normalized = normalizeCoachOutput(
      parsedJson as CoachRawOutput,
      todayPlan,
    );
    res.json(normalized);

    // Fire-and-forget: log event + trigger behavioral state recompute.
    // These must come AFTER the response so they never delay the user.
    if (typeof req.userId === "number") {
      logBehavioralEvent(req.userId, "message_sent", {
        messageLength: message.length,
      });
      recomputeBehavioralStateAsync(req.userId);
    }
  } catch (err) {
    if (err instanceof StrictJsonError && err.kind === "refusal") {
      req.log.warn({ details: err.details }, "coach refusal from model");
      res.status(400).json({ error: "Model refused to respond" });
      return;
    }
    req.log.error({ err }, "coach request failed");
    res.status(500).json({ error: "AI request failed" });
  }
});

// Shared post-processing for both /coach and /coach/stream so the two
// endpoints stay byte-identical in what they return. Centralizing the
// clamps + sanitization here also means the trust boundary against
// model output (no phantom taskIds, no oversized chips, no unknown
// action kinds) is enforced in exactly one place.
type CoachRawOutput = {
  reply?: string;
  suggestedReplies?: string[];
  actionSuggestion?: { kind: string; label: string; rationale: string } | null;
  memoryUpdate?: { summary?: string; newFacts?: string[] } | null;
  proposedAction?: {
    kind: string;
    label?: string;
    rationale?: string;
    task?: {
      title?: string;
      description?: string;
      durationMinutes?: number;
      category?: string;
      priority?: "critical" | "high" | "normal";
    } | null;
    tasks?: Array<{
      title?: string;
      description?: string;
      durationMinutes?: number;
      category?: string;
      priority?: "critical" | "high" | "normal";
    }>;
    taskPatch?: {
      title?: string | null;
      description?: string | null;
      durationMinutes?: number | null;
      category?: string | null;
      priority?: "critical" | "high" | "normal" | null;
    } | null;
    taskId?: string | null;
    taskTitle?: string | null;
    newTitle?: string | null;
    removeTaskIds?: string[];
    event?: {
      title?: string;
      notes?: string | null;
      startISO?: string | null;
      durationMinutes?: number | null;
    } | null;
  } | null;
};

function normalizeCoachOutput(
  parsedJson: CoachRawOutput,
  todayPlan: { tasks?: Array<{ id: string }> } | undefined,
) {
  const suggestedReplies = (parsedJson.suggestedReplies ?? [])
    .slice(0, 3)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 50);

  const actionSuggestion =
    parsedJson.actionSuggestion &&
    ["evolve_roadmap", "refresh_insights", "reflect_on_task"].includes(
      parsedJson.actionSuggestion.kind,
    )
      ? parsedJson.actionSuggestion
      : null;

  const memoryUpdate = parsedJson.memoryUpdate
    ? {
        summary: (parsedJson.memoryUpdate.summary ?? "").slice(0, 600),
        newFacts: (parsedJson.memoryUpdate.newFacts ?? [])
          .slice(0, 5)
          .map((f) => f.trim())
          .filter((f) => f.length > 0 && f.length <= 140),
      }
    : null;

  const todayTaskIds = new Set(
    (todayPlan?.tasks ?? []).map((t: { id: string }) => t.id),
  );
  const clampNewTask = (t: {
    title?: string;
    description?: string;
    durationMinutes?: number;
    category?: string;
    priority?: "critical" | "high" | "normal";
  }) => ({
    id: `task_${crypto.randomUUID()}`,
    title: (t.title ?? "").trim().slice(0, 120),
    description: (t.description ?? "").trim().slice(0, 1000),
    durationMinutes: Math.min(
      240,
      Math.max(5, Math.round(t.durationMinutes || 15)),
    ),
    category: (t.category ?? "general").trim().slice(0, 60),
    priority: (t.priority && ["critical", "high", "normal"].includes(t.priority)
      ? t.priority
      : "normal") as "critical" | "high" | "normal",
  });

  const proposedAction = (() => {
    const a = parsedJson.proposedAction;
    if (!a || a.kind === "none") return null;
    const label = (a.label ?? "").trim().slice(0, 80);
    const rationale = (a.rationale ?? "").trim().slice(0, 240);
    if (!label || !rationale) return null;
    // Strict-mode parity: every action carries every payload field so the
    // wire shape is uniform regardless of kind. `empty` provides the null/[]
    // defaults; each case overrides only the fields it owns.
    const empty = {
      label,
      rationale,
      task: null as ReturnType<typeof clampNewTask> | null,
      tasks: [] as ReturnType<typeof clampNewTask>[],
      taskPatch: null as {
        title: string | null;
        description: string | null;
        durationMinutes: number | null;
        category: string | null;
        priority: "critical" | "high" | "normal" | null;
      } | null,
      taskId: null as string | null,
      taskTitle: null as string | null,
      newTitle: null as string | null,
      removeTaskIds: [] as string[],
      event: null as {
        title: string;
        notes: string | null;
        startISO: string | null;
        durationMinutes: number | null;
      } | null,
    };
    switch (a.kind) {
      case "addTaskToday": {
        const t = a.task;
        if (!t || !t.title?.trim()) return null;
        return { kind: "addTaskToday" as const, ...empty, task: clampNewTask(t) };
      }
      case "addTasksToday": {
        const tasks = (a.tasks ?? [])
          .filter((t) => t && t.title?.trim())
          .slice(0, 8)
          .map((t) => clampNewTask(t));
        if (tasks.length === 0) return null;
        return { kind: "addTasksToday" as const, ...empty, tasks };
      }
      case "removeTaskToday": {
        const id = (a.taskId ?? "").trim();
        if (!id || !todayTaskIds.has(id)) return null;
        return {
          kind: "removeTaskToday" as const,
          ...empty,
          taskId: id,
          taskTitle: (a.taskTitle ?? "").trim().slice(0, 120) || null,
        };
      }
      case "editTaskToday": {
        const id = (a.taskId ?? "").trim();
        if (!id || !todayTaskIds.has(id)) return null;
        const p = a.taskPatch;
        if (!p) return null;
        const patch = {
          title:
            p.title != null && p.title.trim()
              ? p.title.trim().slice(0, 120)
              : null,
          description:
            p.description != null ? p.description.trim().slice(0, 1000) : null,
          durationMinutes:
            p.durationMinutes != null
              ? Math.min(240, Math.max(5, Math.round(p.durationMinutes)))
              : null,
          category:
            p.category != null && p.category.trim()
              ? p.category.trim().slice(0, 60)
              : null,
          priority:
            p.priority && ["critical", "high", "normal"].includes(p.priority)
              ? p.priority
              : null,
        };
        if (
          !patch.title &&
          patch.description == null &&
          patch.durationMinutes == null &&
          !patch.category &&
          !patch.priority
        ) {
          return null;
        }
        return {
          kind: "editTaskToday" as const,
          ...empty,
          taskId: id,
          taskTitle: (a.taskTitle ?? "").trim().slice(0, 120) || null,
          taskPatch: patch,
        };
      }
      case "renameGoal": {
        const newTitle = (a.newTitle ?? "").trim().slice(0, 60);
        if (newTitle.length < 2) return null;
        return { kind: "renameGoal" as const, ...empty, newTitle };
      }
      case "lightenToday": {
        const ids = (a.removeTaskIds ?? [])
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && todayTaskIds.has(s));
        if (ids.length === 0) return null;
        return { kind: "lightenToday" as const, ...empty, removeTaskIds: ids };
      }
      case "regenerateDay": {
        return { kind: "regenerateDay" as const, ...empty };
      }
      case "syncToCalendar": {
        if (todayTaskIds.size === 0) return null;
        return { kind: "syncToCalendar" as const, ...empty };
      }
      case "addCalendarEvent": {
        const e = a.event;
        if (!e || !e.title?.trim()) return null;
        return {
          kind: "addCalendarEvent" as const,
          ...empty,
          event: {
            title: e.title.trim().slice(0, 120),
            notes: e.notes != null ? e.notes.trim().slice(0, 1000) : null,
            startISO:
              e.startISO != null && e.startISO.trim()
                ? e.startISO.trim()
                : null,
            durationMinutes:
              e.durationMinutes != null
                ? Math.min(480, Math.max(10, Math.round(e.durationMinutes)))
                : null,
          },
        };
      }
      default:
        return null;
    }
  })();

  const reply =
    typeof parsedJson.reply === "string" && parsedJson.reply.trim().length > 0
      ? parsedJson.reply.trim()
      : "I'm here. Tell me a bit more about what you want to tackle next.";

  return { reply, suggestedReplies, actionSuggestion, memoryUpdate, proposedAction };
}

// ─────────────────────────────────────────────────────────────────────────────
// Streaming coach endpoint.
//
// Same inputs, same response schema, same moderation + model selection
// as POST /coach — but emits the assistant `reply` text as it arrives
// over Server-Sent Events so the mobile UI can render token-by-token.
// Structured fields (suggestedReplies, proposedAction, memoryUpdate,
// actionSuggestion) arrive in a single `final` event after the JSON
// object closes, then a `done` event terminates the stream.
//
// Event shapes (one JSON object per `data:` line):
//   { type: "delta", text: string }    // new reply text
//   { type: "final", reply, suggestedReplies, actionSuggestion,
//                    memoryUpdate, proposedAction }
//   { type: "error", error: string }   // recoverable failure mid-stream
//   { type: "done" }                    // terminator (no more events)
//
// The non-streaming /coach endpoint is preserved for backward
// compatibility and as a fallback when the client cannot consume SSE
// (e.g. older RN runtimes without fetch streaming).
// ─────────────────────────────────────────────────────────────────────────────
router.post("/coach/stream", async (req, res) => {
  const parsed = atlasCoachBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const {
    profile,
    roadmap,
    todayPlan,
    behavioral,
    learnedProfile,
    currentWeek,
    currentPhase,
    recentReflections,
    recentEvolutions,
    coachMemory,
    history,
    message,
    modelChoice,
    attachmentNote,
    attachmentImage,
    calendarContext,
  } = parsed.data;

  // Pre-flight moderation BEFORE we open the SSE stream so a flagged
  // input can still be returned as a clean 400 JSON error (the client
  // hasn't started consuming text/event-stream yet).
  try {
    await moderateOrThrow(message);
  } catch (err) {
    if (err instanceof ModerationError) {
      req.log.warn(
        { categories: err.categories },
        "coach (stream) input blocked by moderation",
      );
      res.status(400).json({
        error:
          "I can't respond to that message. Try rephrasing it focused on your goal.",
      });
      return;
    }
    throw err;
  }

  // Image validation — same guards as /coach.
  const ALLOWED_IMAGE_MIMES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
  ]);
  const MAX_DECODED_IMAGE_BYTES = 5 * 1024 * 1024;
  if (attachmentImage?.base64Data || attachmentImage?.mimeType) {
    if (
      !attachmentImage.mimeType ||
      !ALLOWED_IMAGE_MIMES.has(attachmentImage.mimeType)
    ) {
      res.status(415).json({
        error: "Unsupported image type. Use JPEG, PNG, WebP, or GIF.",
      });
      return;
    }
    if (!attachmentImage.base64Data) {
      res.status(400).json({ error: "Image attachment is missing data." });
      return;
    }
    const decodedBytes = Math.floor((attachmentImage.base64Data.length * 3) / 4);
    if (decodedBytes > MAX_DECODED_IMAGE_BYTES) {
      res.status(413).json({
        error: "Image is too large. Please attach an image under 5 MB.",
      });
      return;
    }
  }

  const hasImage = !!attachmentImage?.base64Data && !!attachmentImage?.mimeType;
  const userMessageText = hasImage
    ? `${message}\n\n[The user attached an image. Describe what you see briefly in your reply, then connect it to their goal.]`
    : attachmentNote
    ? `${message}\n\n[The user also attached: ${attachmentNote}. Acknowledge it in one short sentence — you can't see its contents.]`
    : message;
  const userMessageContent: string | Array<
    | { type: "text"; text: string }
    | {
        type: "image_url";
        image_url: { url: string; detail?: "low" | "high" | "auto" };
      }
  > = hasImage
    ? [
        { type: "text", text: userMessageText },
        {
          type: "image_url",
          image_url: {
            url: `data:${attachmentImage!.mimeType};base64,${attachmentImage!.base64Data}`,
            detail: "low",
          },
        },
      ]
    : userMessageText;

  // ── Behavioral Orchestration (stream) ────────────────────────────────────
  const [userRecordStream] = await db
    .select({ tier: usersTable.tier })
    .from(usersTable)
    .where(eq(usersTable.id, req.userId!))
    .limit(1)
    .catch(() => [{ tier: "free" as string }]);

  const tierStream = (userRecordStream?.tier ?? "free") as SubscriptionTier;
  const behavioralStateStream = await getBehavioralState(req.userId!).catch(
    () => ({
      userId: req.userId!,
      energyLevel: 0.5,
      moodScore: 0.0,
      cognitiveLoad: 0.5,
      procrastinationRisk: "low" as const,
      flowDetected: false,
      peakHours: [],
      motivationType: "balanced",
      updatedAt: new Date(),
    }),
  );
  const orchConfigStream = buildOrchestrationConfig(
    behavioralStateStream,
    tierStream,
  );

  const contextBlock = buildCoachContext({
    profile: {
      goalType: profile.goalType,
      goalStatement: profile.goalStatement,
      availableTimePerDayMinutes: profile.availableTimePerDayMinutes,
    },
    roadmap: {
      headline: roadmap.headline,
      strategy: roadmap.strategy,
      totalWeeks: roadmap.totalWeeks,
    },
    todayPlan: todayPlan
      ? {
          date: todayPlan.date,
          focusOfTheDay: todayPlan.focusOfTheDay,
          tasks: todayPlan.tasks.map((t) => ({ title: t.title })),
        }
      : undefined,
    behavioral,
    learnedProfile,
    currentWeek,
    currentPhase,
    recentReflections,
    recentEvolutions,
    coachMemory,
  });

  const systemContext = `You are rabai — a strategic AI execution coach inside a mobile app. The user has come to you for guidance.

Speak conversationally, with warmth and precision. EVERY reply must ground itself in the real context below — reference the current phase, today's tasks, a recent reflection, a learned trait, or a known fact, not generic advice. Push back gently when they make excuses, celebrate small wins, name the pattern you see.

Hard rules:
- "reply" is plain prose. No markdown, headings, bullets, or emojis. Under 110 words unless they explicitly ask for detail.
- "suggestedReplies": 0-3 short follow-ups (<= 50 chars each).
- "actionSuggestion" / "memoryUpdate": same rules as the non-streaming /coach endpoint.
${PROPOSED_ACTION_RULES}

CONTEXT:
${contextBlock}${
    calendarContext && calendarContext.trim().length > 0
      ? `\n\nTODAY'S CALENDAR:\n${calendarContext.trim()}`
      : ""
  }${
    typeof req.userId === "number"
      ? await retrieveRelevantContext(req, req.userId, message)
          .then((b) =>
            b
              ? `\n\nRELEVANT MEMORY (semantic retrieval — surface only when it directly helps):\n${b}`
              : "",
          )
          .catch(() => "")
      : ""
  }${orchConfigStream.behavioralAddendum ? `\n\n${orchConfigStream.behavioralAddendum}` : ""}`;

  // SSE headers. `X-Accel-Buffering: no` disables nginx-style proxy
  // buffering so chunks reach the client in real time even behind a
  // reverse proxy. flushHeaders() so the client knows the stream is
  // open before we wait on the first OpenAI chunk.
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const writeEvent = (payload: unknown): void => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  // If the client disconnects mid-stream, we want to bail out of the
  // for-await loop so OpenAI tokens stop being charged. The flag is
  // checked between chunks; the in-flight chunk just completes.
  let aborted = false;
  req.on("close", () => {
    if (!res.writableEnded) aborted = true;
  });

  const extractor = new ReplyTextExtractor();
  let accumulated = "";
  // Mirror of every reply token actually emitted to the client. If end-of-
  // stream parse/validation fails (more likely now that Phase 3 strict Zod
  // rejects shape regressions), we use this as the canonical `reply` in the
  // final SSE event so the persisted chat history matches what the user saw,
  // instead of replacing it with normalizeCoachOutput's generic fallback.
  let streamedReply = "";
  let refusalAccumulated = "";

  // Fire-and-forget behavioral event logging — before the stream starts so
  // it's captured even if the client disconnects mid-stream.
  if (typeof req.userId === "number") {
    logBehavioralEvent(req.userId, "message_sent", {
      messageLength: message.length,
    });
    recomputeBehavioralStateAsync(req.userId);
  }

  try {
    const stream = trackedStream(req, {
      stream: true,
      model: hasImage ? MODEL_VISION : orchConfigStream.model,
      max_completion_tokens: 1200,
      response_format: zodResponseFormat(coachResponseValidator, "coach_reply"),
      messages: [
        { role: "system", content: systemContext },
        ...history.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user", content: userMessageContent },
      ],
    });

    for await (const chunk of stream) {
      if (aborted) break;
      const choice = chunk.choices[0];
      const delta = choice?.delta?.content;
      // OpenAI streams safety refusals in delta.refusal. Accumulate so we
      // can surface them as a typed refusal at end-of-stream instead of
      // silently degrading to an empty fallback reply.
      const refusalDelta = (
        choice?.delta as { refusal?: string | null } | undefined
      )?.refusal;
      if (typeof refusalDelta === "string" && refusalDelta.length > 0) {
        refusalAccumulated += refusalDelta;
      }
      if (typeof delta === "string" && delta.length > 0) {
        accumulated += delta;
        const replyDelta = extractor.feed(delta);
        if (replyDelta.length > 0) {
          streamedReply += replyDelta;
          writeEvent({ type: "delta", text: replyDelta });
        }
      }
    }

    if (aborted) {
      // Client gave up — best-effort end the response and stop.
      res.end();
      return;
    }

    // End of stream. Parse + Zod-validate the full JSON object we
    // accumulated and run the SAME normalization as the non-streaming
    // /coach handler so the mobile UI sees identical semantics (clamps,
    // whitelisted action kinds, fresh server-issued task IDs, taskId
    // membership checks against todayPlan, etc.). Streaming cannot
    // retry mid-flight, so on parse/validation failure we degrade
    // gracefully — the user already saw the streamed reply tokens via
    // ReplyTextExtractor; the final event simply lacks structured
    // action fields.
    let parsedJson: CoachRawOutput = {};
    let parseFailed = false;
    try {
      parsedJson = parseAndValidate(
        accumulated,
        refusalAccumulated.length > 0 ? refusalAccumulated : null,
        coachResponseValidator,
      ) as CoachRawOutput;
    } catch (parseErr) {
      const kind =
        parseErr instanceof StrictJsonError ? parseErr.kind : "unknown";
      req.log.warn(
        { parseErr, kind },
        "coach stream output failed parse/validate",
      );
      // Refusals deserve a distinct SSE signal so the mobile UI can show a
      // proper "model declined to respond" state instead of an empty turn.
      if (parseErr instanceof StrictJsonError && parseErr.kind === "refusal") {
        if (!res.writableEnded) {
          try {
            writeEvent({ type: "error", error: "Model refused to respond" });
            writeEvent({ type: "done" });
          } catch {
            // client likely disconnected
          }
          res.end();
        }
        return;
      }
      parseFailed = true;
    }
    // Inject the already-streamed reply text as the canonical reply when
    // parse/validation fails — otherwise normalizeCoachOutput({}) would
    // overwrite the user-visible turn with a generic "I'm here. Tell me a
    // bit more…" fallback even though the user saw a real streamed answer.
    // Only structured fields (action, memory, etc) degrade to null.
    parsedJson = pickStreamFallbackReply(parsedJson, streamedReply, parseFailed);
    const normalized = normalizeCoachOutput(parsedJson, todayPlan);

    writeEvent({
      type: "final",
      ...normalized,
    });
    writeEvent({ type: "done" });
    res.end();
  } catch (err) {
    req.log.error({ err }, "coach stream failed");
    // Best-effort: emit an error event the client can render, then end.
    if (!res.writableEnded) {
      try {
        writeEvent({ type: "error", error: "AI request failed" });
        writeEvent({ type: "done" });
      } catch {
        // ignore — client likely already disconnected
      }
      res.end();
    }
  }
});

router.post("/adapt", async (req, res) => {
  const parsed = atlasAdaptPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { profile, roadmap, behavioral } = parsed.data;

  try {
    const data = await strictJsonCompletion(
      req,
      {
        model: MODEL,
        max_completion_tokens: 700,
        response_format: zodResponseFormat(adaptValidator, "adaptation"),
        messages: [
          {
            role: "system",
            content: `You are rabai's adaptive planning engine. Based on behavioural data, decide whether to make the plan easier, keep it the same, or push harder. Provide 2-4 concrete adjustments (short imperative phrases, no markdown, no emojis) and a brief 1-sentence encouragement.`,
          },
          {
            role: "user",
            content: `Profile: ${JSON.stringify(profile)}\nRoadmap headline: ${roadmap.headline}\nBehavioural snapshot: ${JSON.stringify(behavioral)}`,
          },
        ],
      },
      adaptValidator,
    );
    res.json(data);
  } catch (err) {
    if (err instanceof StrictJsonError && err.kind === "refusal") {
      req.log.warn({ details: err.details }, "adapt refusal from model");
      res.status(400).json({ error: "Model refused to respond" });
      return;
    }
    req.log.error({ err }, "adapt request failed");
    res.status(500).json({ error: "AI request failed" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Intake form: the AI generates a tailored questionnaire and then converts the
// answers into a UserProfile. This replaces the old one-question-at-a-time
// chat flow for users who prefer to fill everything in a single screen.
// ─────────────────────────────────────────────────────────────────────────────



/**
 * Refine a raw user goal description into a short, brand-neutral title.
 * Used by the create-goal flow so a custom goal like "I want to clean me from
 * my bad habbits" becomes a clean display title like "Break Daily Trigger
 * Loops" before it lands on the goal record.
 *
 * Template goals (ielts, fitness, etc.) already have polished labels so the
 * mobile client only invokes this for `goalType === "custom"`.
 */

router.post("/generate-title", async (req, res) => {
  const parsed = atlasGenerateTitleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { goalType, userInput, intent } = parsed.data;
  const trimmed = userInput.trim();
  if (trimmed.length === 0) {
    res.status(400).json({ error: "userInput is required." });
    return;
  }
  // When AI is unavailable, fall back to the first 4 words of the raw input
  // (rather than 60 chars of raw text, which just shows a truncated description).
  const wordFallback = trimmed.split(/\s+/).slice(0, 4).join(" ");

  try {
    // /generate-title intentionally soft-fails: any error (including refusal,
    // parse, or validation failure) falls back to the first few words of the
    // user input so the create-goal flow never hard-blocks. We still go through
    // strictJsonCompletion so we get the single retry on parse/validation
    // failure for free, which improves the success rate before falling back.
    const parsedJson = await strictJsonCompletion(
      req,
      {
        model: MODEL_FAST,
        response_format: zodResponseFormat(
          generateTitleValidator,
          "generated_title",
        ),
        messages: [
          {
            role: "system",
            content: `You convert a user's raw goal description into a SHORT, brand-neutral display title for their goal record.

Rules:
- 2 to 5 words. NO more than 5 words.
- Write in the SAME LANGUAGE as the user's input. If the input is in Azerbaijani, the title must be in Azerbaijani. If in Russian, in Russian. If in English, in English. Never translate.
- Title Case (capitalise each word as appropriate for the detected language).
- No punctuation, no emojis, no quotes, no trailing period.
- Capture the *outcome*, not the process. ("Break Daily Trigger Loops", not "Try to Quit Bad Habits".)
- Use the user's actual intent — if they said "lose 20 lbs", the title is "Lose 20 Pounds" (or the equivalent in the user's language).
- If the input is gibberish or ambiguous, fall back to a 2-3 word generic title in the same language.
- Goal category hint: ${goalType}. (Custom means the user wrote it themselves.)
- Never refer to the assistant or the app. Just the goal.`,
          },
          {
            role: "user",
            content: `User input: "${trimmed}"${intent ? `\nExtra context: ${intent}` : ""}\n\nReturn the refined title (2-5 words, in the same language as the input).`,
          },
        ],
      },
      generateTitleValidator,
    );
    const title =
      typeof parsedJson.title === "string" && parsedJson.title.trim().length > 0
        ? parsedJson.title.trim().slice(0, 60)
        : wordFallback;
    res.json({ title });
  } catch (err) {
    req.log.error({ err }, "generate-title request failed");
    // Soft-fail with the first few words of the input (not 60 chars of raw
    // description) so the goals list doesn't show a truncated paragraph.
    res.json({ title: wordFallback });
  }
});

router.post("/intake-questions", async (req, res) => {
  const parsed = atlasIntakeQuestionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { goalType, goalTitle } = parsed.data;
  const label = resolveGoalLabel(goalType, goalType === "custom" ? goalTitle : undefined);

  try {
    const data = await strictJsonCompletion(
      req,
      {
        model: MODEL,
        response_format: zodResponseFormat(
          intakeQuestionsValidator,
          "intake_questions",
        ),
        messages: [
          {
            role: "system",
            content: `You are rabai, a strategic AI execution coach. Generate a focused intake questionnaire so the system can build a real, personalized roadmap for the user's goal. The user described their goal as: "${goalTitle}" (category: ${label}).

Rules:
- 6 to 10 questions, no more.
- Mix of types: short_text, long_text, single_select (3-5 options), multi_select (3-6 options), number (use a unit like "minutes" or "weeks").
- Always include questions that capture: target outcome, current starting point, daily time available (number, unit "minutes"), productivity window, consistency, constraints/blockers, and target timeline.
- Tailor 2-3 questions to the SPECIFIC goal — don't ask generic things if the goal is concrete (e.g. for "learn Spanish", ask about target proficiency level; for "buy a car", ask about budget and timeline).
- Question ids must be lowercase snake_case identifiers.
- helper text is short context (one sentence). Provide an empty string when no helper is needed.
- placeholder is short example text. Provide an empty string when not applicable.
- options must be a non-empty array for single_select / multi_select. Use an empty array for other types.
- unit is required for "number" questions ("minutes", "weeks", "USD", etc). Use an empty string for other types.
- introMessage is one warm sentence (under 25 words) introducing what comes next. No emojis, no markdown.
- LANGUAGE RULE: Detect the language of the goalTitle and write ALL output (every question label, helper, placeholder, option, and introMessage) in that exact same language. If the goal is written in Azerbaijani, respond in Azerbaijani. If in Russian, respond in Russian. If in English, respond in English. Never mix languages.`,
          },
          {
            role: "user",
            content: `Generate the intake questionnaire for the goal: ${goalTitle}.`,
          },
        ],
      },
      intakeQuestionsValidator,
    );
    res.json(data);
  } catch (err) {
    if (err instanceof StrictJsonError && err.kind === "refusal") {
      req.log.warn({ details: err.details }, "intake-questions refusal from model");
      res.status(400).json({ error: "Model refused to respond" });
      return;
    }
    req.log.error({ err }, "intake-questions request failed");
    res.status(500).json({ error: "AI request failed" });
  }
});

router.post("/intake-submit", async (req, res) => {
  const parsed = atlasIntakeSubmitBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { goalType, goalTitle, questions, answers } = parsed.data;
  const label = resolveGoalLabel(goalType, goalType === "custom" ? goalTitle : undefined);

  const formatAnswer = (raw: string, type: string): string => {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return "(no answer)";
    if (type === "multi_select") {
      // Multi-select values are stored as "Option1|Option2|Other: custom text".
      // Render them as a comma-separated list so the AI reads them naturally.
      return trimmed
        .split("|")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .join(", ");
    }
    return trimmed;
  };

  const transcript = questions
    .map((q) => {
      const raw = answers.find((a) => a.questionId === q.id)?.value ?? "";
      return `Q: ${q.label}\nA: ${formatAnswer(raw, q.type)}`;
    })
    .join("\n\n");

  try {
    const data = await strictJsonCompletion(
      req,
      {
        model: MODEL,
        response_format: zodResponseFormat(
          intakeProfileValidator,
          "intake_profile",
        ),
        messages: [
          {
            role: "system",
            content: `You are rabai's intake processor. Convert the user's questionnaire answers into a complete UserProfile that the roadmap engine can use.

Rules:
- Use the user's actual words where possible. Do not invent constraints they didn't mention.
- Treat answers prefixed with "Other:" as fully valid, custom user input — analyze them with equal weight to predefined selections, and let them override or refine generic options.
- When a multi-select answer mixes predefined options with an "Other:" entry, synthesise both into the profile (do not discard either).
- availableTimePerDayMinutes must be a realistic integer derived from their answer (default 30 if missing).
- targetTimelineWeeks must be a realistic integer (default 12 if missing).
- constraints is a list of short imperative phrases (e.g. "Travels for work weekly").
- notes is a one-paragraph synthesis (max 60 words) summarising the user, capturing any unique custom details they provided via "Other:" entries.
- followUp is one short, warm sentence rabai wants to say before generating the roadmap. No emojis, no markdown.
- Goal category: ${label}.
- LANGUAGE RULE: Write ALL text fields (notes, followUp, constraints, goalStatement) in the same language as the user's goal and answers. Match the user's language exactly.`,
          },
          {
            role: "user",
            content: `Goal: ${goalTitle}\n\nIntake answers:\n${transcript}`,
          },
        ],
      },
      intakeProfileValidator,
    );
    res.json(data);
  } catch (err) {
    if (err instanceof StrictJsonError && err.kind === "refusal") {
      req.log.warn({ details: err.details }, "intake-submit refusal from model");
      res.status(400).json({ error: "Model refused to respond" });
      return;
    }
    req.log.error({ err }, "intake-submit request failed");
    res.status(500).json({ error: "AI request failed" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Behavioral profile builder.
// Takes recent task history + reflections + previous profile and returns the
// updated cumulative behavioural identity model the AI uses to personalize
// every roadmap, daily plan, and coaching reply.
// ─────────────────────────────────────────────────────────────────────────────


router.post("/behavioral-profile", async (req, res) => {
  const parsed = atlasBehavioralProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { profile, recentHistory, reflections, previous } = parsed.data;

  // Compact a quick stats snapshot for the prompt.
  const completed = recentHistory.filter((h) => h.completed).length;
  const total = recentHistory.length;
  const completionRate = total > 0 ? completed / total : 0;
  const reflectionLines = reflections
    .slice(-12)
    .map((r) => formatReflectionLine(r, "- "))
    .join("\n");

  try {
    const data = (await strictJsonCompletion(
      req,
      {
        model: MODEL,
        max_completion_tokens: 1500,
        response_format: zodResponseFormat(
          behavioralProfileValidator,
          "behavioral_profile",
        ),
        messages: [
          {
            role: "system",
            content: `You are rabai's behavioural analyst. Your job is to model how this specific human functions psychologically and operationally so the planner can adapt the roadmap, tasks, and coaching style to them.

You will be given:
- the user's stated UserProfile (their self-description),
- recent TASK HISTORY (which tasks were done or missed, with dates),
- recent REFLECTIONS (the user's own short notes on how tasks went, plus optional reasonTag),
- the PREVIOUS behavioural profile if any (so you EVOLVE it rather than overwrite it).

Produce an updated BehavioralProfile that captures:
- summary: 2-3 plain sentences describing how this user actually executes (not what they wish — what the data shows). If data is thin, say so honestly and lean on the stated profile.
- consistencyLevel: very_low | low | moderate | high | very_high — based on real completion rate and streak shape.
- workloadTolerance: light | moderate | heavy.
- motivationTrend: rising | steady | declining — compare recent reflections / completion rate to earlier ones.
- focusStyle: short phrase (e.g. "deep blocks", "short sprints", "context-switcher", "morning bursts").
- learningPreference: short phrase (e.g. "practical-first", "theoretical-then-practice", "mixed").
- peakHours: best-guess time windows (HH:MM-HH:MM) inferred from stated productivityPattern + reflections; empty array if unknown.
- failurePatterns: 2-4 concrete recurring reasons tasks fail (e.g. "low energy after work", "skips weekends", "starts strong, fades by Wednesday"). Empty array only if truly nothing observed.
- strengths: 2-4 things this user is reliably good at.
- recommendedAdjustments: 2-4 short imperatives the planner should apply (e.g. "front-load deep work before 10am", "cap evening sessions at 25 minutes").
- aiInsight: ONE warm, plain-English sentence the user will see as a fresh insight after this refresh. Reference real data. No emojis, no markdown.

Hard rules:
- No emojis, no markdown anywhere.
- Be evidence-based. Do not invent failure patterns or peak hours when there is no signal — return empty arrays instead.
- Evolve the previous profile incrementally; preserve anything still true.`,
          },
          {
            role: "user",
            content: `STATED PROFILE: ${JSON.stringify(profile)}

PREVIOUS BEHAVIORAL PROFILE: ${previous ? JSON.stringify(previous) : "(none yet)"}

RECENT STATS: ${total} task entries in history, ${completed} completed (${(completionRate * 100).toFixed(0)}%).

RECENT TASK HISTORY (most recent last):
${recentHistory
  .slice(-30)
  .map((h) => `- ${h.date} • ${h.completed ? "done" : "missed"} • ${h.taskTitle}`)
  .join("\n") || "(none)"}

RECENT REFLECTIONS:
${reflectionLines || "(none yet)"}`,
          },
        ],
      },
      behavioralProfileValidator,
    )) as {
      profile: Record<string, unknown>;
      aiInsight: string;
    };
    res.json({
      profile: { ...data.profile, updatedAt: new Date().toISOString() },
      aiInsight: data.aiInsight,
    });
  } catch (err) {
    if (err instanceof StrictJsonError && err.kind === "refusal") {
      req.log.warn({ details: err.details }, "behavioral-profile refusal from model");
      res.status(400).json({ error: "Model refused to respond" });
      return;
    }
    req.log.error({ err }, "behavioral-profile request failed");
    res.status(500).json({ error: "AI request failed" });
  }
});


router.post("/evolve-roadmap", async (req, res) => {
  const parsed = atlasEvolveRoadmapBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const {
    profile,
    currentRoadmap,
    behavioral,
    learnedProfile,
    recentReflections,
    currentWeek,
    trigger,
  } = parsed.data;
  const learnedSummary = summarizeLearnedProfile(learnedProfile);

  const reflectionLines = recentReflections
    .slice(-12)
    .map((r) => formatReflectionLine(r, "- "))
    .join("\n");

  try {
    const data = (await strictJsonCompletion(
      req,
      {
        model: MODEL,
        max_completion_tokens: 4500,
        response_format: zodResponseFormat(
          roadmapEvolutionValidator,
          "roadmap_evolution",
        ),
        messages: [
          {
            role: "system",
            content: `You are rabai's adaptive planner. Your job is to EVOLVE an existing roadmap so it stays accurate to how this user is actually executing — not to rewrite it from scratch.

Inputs you receive:
- the user's stated UserProfile,
- the CURRENT roadmap they are working through,
- a behavioural snapshot (streak, completion rate, recent done/missed task titles),
- their cumulative LEARNED behavioural profile if available (consistency, workload tolerance, motivation trend, focus style, peak hours, failure patterns, strengths, recommended adjustments),
- recent REFLECTIONS (the user's own short notes on how tasks went),
- the current week number in the plan,
- whether this evolution was manual (user pressed a button) or auto (background trigger after enough new signal).

Hard rules:
- Preserve the user's progress: do NOT renumber or destroy phases that are already in the past or that the user is currently in unless they are clearly broken. Strongly prefer modifying upcoming phases (current week and beyond).
- Preserve phase ids when keeping the same phase ("phase-1", "phase-2", ...). Use the same id format for any new phases.
- Total phases must stay between 3 and 5. Each phase 2-6 weeks, with 2-4 milestones. Milestone ids: m-<phaseNumber>-<index>.
- totalWeeks must be the sum of phase durations and respect the original target timeline (do not extend or shrink dramatically — keep within ±2 weeks).
- Tasks/milestones must be CONCRETE and real-world.
- No emojis. No markdown.

Decision rules:
- If the user is clearly struggling (low completion rate, declining motivation, repeated failure patterns, or "tough"/"no_time"/"tired" reflections dominating): ease upcoming phases — fewer or smaller milestones, more recovery, address the failure patterns directly.
- If the user is consistently crushing it (high completion rate, "easy"/"just_right" with rising motivation): raise ambition in upcoming phases — add stretch milestones, advance the timeline.
- If signal is mixed or weak: keep the roadmap structurally the same and only refine wording / re-sequence within phases. Set hasChanged=false if literally nothing meaningful would change.
- Apply the LEARNED PROFILE's recommendedAdjustments and respect peakHours / workload tolerance when restructuring.

Output:
- evolvedRoadmap: the FULL new roadmap (same shape as the input, with goalType implied — you do not include goalType, the server adds it).
- hasChanged: true if you changed anything meaningful, false if you returned the same roadmap unchanged.
- changeSummary: ONE short paragraph (under 60 words) in plain language explaining what you changed and why. Reference the actual signal (e.g. "your last 5 reflections marked tasks as 'tough'").
- phaseChanges: ONE entry per phase in the evolved roadmap, in order. changeType is "added" | "removed" | "modified" | "unchanged". Removed phases also appear here (use the removed phase's old id and title). summary: one sentence per phase.
- rationale: brief explanation (under 80 words) of the reasoning, for the user to read if they want depth.`,
          },
          {
            role: "user",
            content: `TRIGGER: ${trigger}
CURRENT WEEK: ${currentWeek}
GOAL: ${resolveGoalLabel(profile.goalType, profile.customGoalTitle)}

USER PROFILE:
${JSON.stringify(profile, null, 2)}

CURRENT ROADMAP:
${JSON.stringify(currentRoadmap, null, 2)}

BEHAVIOURAL SNAPSHOT:
- streak: ${behavioral.currentStreakDays} days
- completion rate: ${(behavioral.completionRate * 100).toFixed(0)}%
- recent completed: ${behavioral.completedTaskTitles.join("; ") || "(none)"}
- recent missed: ${behavioral.missedTaskTitles.join("; ") || "(none)"}

LEARNED PROFILE:
${learnedSummary || "(not yet available)"}

RECENT REFLECTIONS (most recent last):
${reflectionLines || "(none yet)"}`,
          },
        ],
      },
      roadmapEvolutionValidator,
    )) as {
      evolvedRoadmap: Record<string, unknown>;
      hasChanged: boolean;
      changeSummary: string;
      phaseChanges: Array<{
        phaseId: string;
        phaseTitle: string;
        changeType: "added" | "removed" | "modified" | "unchanged";
        summary: string;
      }>;
      rationale: string;
    };

    res.json({
      evolvedRoadmap: { goalType: profile.goalType, ...data.evolvedRoadmap },
      hasChanged: data.hasChanged,
      changeSummary: data.changeSummary,
      phaseChanges: data.phaseChanges,
      rationale: data.rationale,
      evolvedAt: new Date().toISOString(),
    });
  } catch (err) {
    if (err instanceof StrictJsonError && err.kind === "refusal") {
      req.log.warn({ details: err.details }, "evolve-roadmap refusal from model");
      res.status(400).json({ error: "Model refused to respond" });
      return;
    }
    req.log.error({ err }, "evolve-roadmap request failed");
    res.status(500).json({ error: "AI request failed" });
  }
});

// Voice → text. Multipart form-data with a single `audio` field.
// We let Whisper auto-detect the format; expo-audio gives us m4a on iOS,
// 3gp/mp4 on Android, and the web MediaRecorder gives us webm/opus.
router.post("/transcribe", audioUploadMiddleware("audio"), async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "audio file is required" });
      return;
    }
    const language =
      typeof req.body?.language === "string" && req.body.language.length > 0
        ? req.body.language
        : undefined;

    const filename = file.originalname || guessAudioFilename(file.mimetype);
    const upload = await toFile(file.buffer, filename, {
      type: file.mimetype || "audio/webm",
    });

    const start = Date.now();
    const result = await openai.audio.transcriptions.create({
      file: upload,
      model: "whisper-1",
      ...(language ? { language } : {}),
    });
    const latencyMs = Date.now() - start;

    req.log.info(
      { latencyMs, bytes: file.size, mimetype: file.mimetype },
      "transcribe ok",
    );

    res.json({ text: (result.text ?? "").trim() });
  } catch (err) {
    req.log.error({ err }, "transcribe failed");
    res.status(500).json({ error: "transcription failed" });
  }
});

// Vision pre-pass on a reflection photo. Runs ONCE when the user saves
// the reflection and persists the resulting paragraph on the entry as
// `noteImageAnalysis`. Every downstream AI step (coach, behavioural
// profile, evolve-roadmap) reads that text via formatReflectionLine,
// so the user's photos influence guidance without re-sending bytes.
const REFLECTION_ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const REFLECTION_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

router.post("/analyze-reflection-image", async (req, res) => {
  const parsed = atlasAnalyzeReflectionImageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { imageBase64, imageMimeType, taskTitle, completed, reasonTag, note } =
    parsed.data;

  if (!REFLECTION_ALLOWED_IMAGE_MIMES.has(imageMimeType)) {
    res.status(415).json({
      error: "Unsupported image type. Use JPEG, PNG, WebP, or GIF.",
    });
    return;
  }
  const decodedBytes = Math.floor((imageBase64.length * 3) / 4);
  if (decodedBytes > REFLECTION_MAX_IMAGE_BYTES) {
    res.status(413).json({
      error: "Image is too large. Please attach an image under 5 MB.",
    });
    return;
  }

  try {
    const completion = await trackedCreate(req, {
      model: MODEL_VISION,
      max_completion_tokens: 350,
      messages: [
        {
          role: "system",
          content: `You analyse a photo the user attached to a task reflection inside rubai (an AI execution coach). Write ONE plain-prose paragraph (60-90 words) covering: what you see, the apparent state/quality of the work, any signal about effort, mood or environment, and how it relates to whether the task was done or skipped. Be concrete. No emojis, no markdown, no bullet lists, no headings. Do not invent details that aren't visible. Do not address the user in second person — write descriptively so other AI steps can quote you.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `TASK: ${taskTitle}\nSTATUS: ${completed ? "marked done" : "skipped"}${
                reasonTag ? `\nREASON TAG: ${reasonTag}` : ""
              }${note ? `\nUSER NOTE: ${note}` : ""}\n\nDescribe the attached photo in light of this reflection.`,
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${imageMimeType};base64,${imageBase64}`,
                detail: "low",
              },
            },
          ],
        },
      ],
    });
    const analysis = (completion.choices[0]?.message?.content ?? "")
      .toString()
      .trim();
    if (!analysis) {
      res.status(502).json({ error: "Image analysis returned empty." });
      return;
    }
    res.json({ analysis });
  } catch (err) {
    req.log.error({ err }, "analyze-reflection-image failed");
    res.status(500).json({ error: "Image analysis failed." });
  }
});

function guessAudioFilename(mimetype: string | undefined): string {
  switch (mimetype) {
    case "audio/webm":
    case "audio/webm;codecs=opus":
      return "audio.webm";
    case "audio/mp4":
    case "audio/m4a":
    case "audio/x-m4a":
      return "audio.m4a";
    case "audio/wav":
    case "audio/wave":
      return "audio.wav";
    case "audio/mpeg":
      return "audio.mp3";
    default:
      return "audio.webm";
  }
}

// --- Push notifications ----------------------------------------------------

router.post("/push-token", async (req, res) => {
  const parsed = atlasRegisterPushTokenBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { token, tzOffsetMinutes } = parsed.data;
  try {
    await db
      .update(usersTable)
      .set({
        expoPushToken: token,
        // Only overwrite the offset when the client supplied one. This
        // way a stale registration without it can't blank out a good
        // offset captured by an earlier session.
        ...(typeof tzOffsetMinutes === "number"
          ? { tzOffsetMinutes }
          : {}),
      })
      .where(eq(usersTable.id, req.userId!));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to save push token");
    res.status(500).json({ error: "Failed to save push token" });
  }
});

router.post("/push-test", async (req, res) => {
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.userId!));
    if (!user?.expoPushToken) {
      res.json({ ok: true, delivered: false });
      return;
    }
    const ok = await sendPushTo(user.expoPushToken, {
      title: "rubai test",
      body: "Push is wired up. Daily nudges will land in your morning window.",
    });
    res.json({ ok: true, delivered: ok });
  } catch (err) {
    req.log.error({ err }, "Failed to send test push");
    res.status(500).json({ error: "Failed to send test push" });
  }
});

export default router;
