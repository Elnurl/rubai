import { Router, type IRouter } from "express";
import { trackedCreate } from "../lib/aiUsage";
import {
  AtlasOnboardingChatBody as atlasOnboardingChatBody,
  AtlasGenerateRoadmapBody as atlasGenerateRoadmapBody,
  AtlasGenerateDailyPlanBody as atlasGenerateDailyPlanBody,
  AtlasCoachBody as atlasCoachBody,
  AtlasAdaptPlanBody as atlasAdaptPlanBody,
  AtlasIntakeQuestionsBody as atlasIntakeQuestionsBody,
  AtlasIntakeSubmitBody as atlasIntakeSubmitBody,
  AtlasBehavioralProfileBody as atlasBehavioralProfileBody,
  AtlasEvolveRoadmapBody as atlasEvolveRoadmapBody,
} from "@workspace/api-zod";

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

const MODEL = "gpt-5.4";

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
  return `You are RubAI — a strategic, no-fluff AI execution coach inside a mobile app.
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

const profileExtractorSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    isComplete: { type: "boolean" },
    nextMessage: { type: "string" },
    profile: {
      anyOf: [
        { type: "null" },
        {
          type: "object",
          additionalProperties: false,
          properties: {
            goalStatement: { type: "string" },
            currentLevel: { type: "string" },
            availableTimePerDayMinutes: { type: "integer" },
            financialCondition: { type: "string" },
            productivityPattern: { type: "string" },
            consistencyLevel: { type: "string" },
            constraints: { type: "array", items: { type: "string" } },
            targetTimelineWeeks: { type: "integer" },
            notes: { type: "string" },
          },
          required: [
            "goalStatement",
            "currentLevel",
            "availableTimePerDayMinutes",
            "financialCondition",
            "productivityPattern",
            "consistencyLevel",
            "constraints",
            "targetTimelineWeeks",
            "notes",
          ],
        },
      ],
    },
  },
  required: ["isComplete", "nextMessage", "profile"],
} as const;

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

    const extraction = await trackedCreate(req, {
      model: MODEL,
      max_completion_tokens: 1500,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "onboarding_extraction",
          strict: true,
          schema: profileExtractorSchema,
        },
      },
      messages: [
        {
          role: "system",
          content: `You analyze an onboarding chat and decide if enough has been gathered to build a realistic roadmap for the goal: ${resolveGoalLabel(goalType, customGoalTitle)}.

If sufficient data is present (concrete goal, timeline, current level, daily time, productivity window, constraints), set isComplete=true and produce a structured profile. Otherwise isComplete=false and profile=null.

When isComplete=true, set nextMessage to a brief confirmation (under 60 words, conversational, no lists, no emojis) summarizing what RubAI understood and announcing the roadmap is being built.

When isComplete=false, set nextMessage to: ${JSON.stringify(nextMessage)}`,
        },
        {
          role: "user",
          content: JSON.stringify({ goalType, history }),
        },
      ],
    });

    const raw = extraction.choices[0]?.message?.content ?? "{}";
    const parsedExtraction = JSON.parse(raw) as {
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
    req.log.error({ err }, "onboarding-chat failed");
    res.status(500).json({ error: "AI request failed" });
  }
});

const roadmapSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string" },
    summary: { type: "string" },
    totalWeeks: { type: "integer" },
    strategy: { type: "string" },
    riskAnalysis: { type: "array", items: { type: "string" } },
    phases: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          focus: { type: "string" },
          startWeek: { type: "integer" },
          endWeek: { type: "integer" },
          milestones: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                description: { type: "string" },
                weekNumber: { type: "integer" },
              },
              required: ["id", "title", "description", "weekNumber"],
            },
          },
        },
        required: ["id", "title", "focus", "startWeek", "endWeek", "milestones"],
      },
    },
  },
  required: ["headline", "summary", "totalWeeks", "strategy", "riskAnalysis", "phases"],
} as const;

router.post("/roadmap", async (req, res) => {
  const parsed = atlasGenerateRoadmapBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { profile } = parsed.data;

  try {
    const completion = await trackedCreate(req, {
      model: MODEL,
      max_completion_tokens: 4000,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "roadmap",
          strict: true,
          schema: roadmapSchema,
        },
      },
      messages: [
        {
          role: "system",
          content: `You are RubAI — an AI strategic execution coach. Build a personalized, realistic roadmap for whatever goal the user has set, in any domain (fitness, study, career, life-design, creative work, finance, relationships, side-projects — anything).

Constraints:
- 3 to 5 phases. Each phase 2-6 weeks, with 2-4 milestones.
- Total duration must respect targetTimelineWeeks.
- Tasks/milestones must be CONCRETE and real-world (e.g. "Take a full IELTS mock listening test", "Submit your portfolio to 5 design studios", "Cook 3 different sourdough loaves this week"), never abstract.
- Phase ids: phase-1, phase-2, ... Milestone ids: m-1-1, m-1-2, ...
- Headline: 6-9 words, motivating and specific to this exact goal.
- Strategy: 1 short paragraph (under 70 words) explaining the approach.
- riskAnalysis: 2-4 short bullet strings identifying realistic obstacles for THIS user.
- Adapt difficulty to the stated current level, available time, and consistency.
- No emojis. No markdown.`,
        },
        {
          role: "user",
          content: `Build a roadmap for this user profile (goal: ${resolveGoalLabel(profile.goalType, profile.customGoalTitle)}):\n${JSON.stringify(profile, null, 2)}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const data = JSON.parse(raw);
    res.json({ goalType: profile.goalType, ...data });
  } catch (err) {
    req.log.error({ err }, "roadmap generation failed");
    res.status(500).json({ error: "AI request failed" });
  }
});

const dailyPlanSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    focusOfTheDay: { type: "string" },
    coachNote: { type: "string" },
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          durationMinutes: { type: "integer" },
          category: { type: "string" },
          priority: {
            type: "string",
            enum: ["critical", "high", "normal"],
          },
        },
        required: ["id", "title", "description", "durationMinutes", "category", "priority"],
      },
    },
  },
  required: ["focusOfTheDay", "coachNote", "tasks"],
} as const;

router.post("/daily-plan", async (req, res) => {
  const parsed = atlasGenerateDailyPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { profile, roadmap, behavioral, learnedProfile, date, currentWeek } = parsed.data;
  const learnedSummary = summarizeLearnedProfile(learnedProfile);

  try {
    const completion = await trackedCreate(req, {
      model: MODEL,
      max_completion_tokens: 2500,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "daily_plan",
          strict: true,
          schema: dailyPlanSchema,
        },
      },
      messages: [
        {
          role: "system",
          content: `You are RubAI. Generate today's actionable execution plan for the user.

Rules:
- 3 to 5 tasks. Each task practical, real-world, finishable today.
- Total duration must respect availableTimePerDayMinutes (be realistic, leave buffer).
- Match tasks to the active roadmap phase for week ${currentWeek}.
- Adapt difficulty using the behavioral data — if completionRate is below 0.5 or streak is 0, simplify and use shorter tasks.
- If a LEARNED PROFILE block is provided, weight it heavily: respect the user's peak hours when ordering, calibrate intensity to workloadTolerance and consistencyLevel, lean into known strengths, and structure tasks to avoid the listed failure patterns. Apply any recommendedAdjustments unless they conflict with safety or the active phase.
- Task ids must be unique and short (e.g. "t-1", "t-2").
- focusOfTheDay: 5-9 word headline.
- coachNote: 1-2 sentence personal nudge from RubAI referencing the user's recent behaviour or learned profile.
- No emojis. No markdown.`,
        },
        {
          role: "user",
          content: `Date: ${date}\nProfile: ${JSON.stringify(profile)}\nRoadmap: ${JSON.stringify(roadmap)}\nBehavioral snapshot: ${JSON.stringify(behavioral)}${learnedSummary ? `\n\nLEARNED PROFILE:\n${learnedSummary}` : ""}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const data = JSON.parse(raw);
    res.json({ date, ...data });
  } catch (err) {
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
      .map((r) => {
        const status = r.completed ? "DID" : "SKIPPED";
        const reason = r.reasonTag ? ` [${r.reasonTag}]` : "";
        const note = r.note ? ` — "${r.note}"` : "";
        return `  • ${r.date} ${status} "${r.taskTitle}"${reason}${note}`;
      })
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

const coachResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    reply: {
      type: "string",
      description:
        "The coach's reply in plain prose. Under 110 words unless the user explicitly asked for detail. No markdown, headings, bullets, or emojis.",
    },
    suggestedReplies: {
      type: "array",
      maxItems: 3,
      description:
        "0-3 short follow-up prompts the user can tap to send back. Each MUST be <= 50 chars and reference real context (a phase, a reflection, a fact). Empty array when nothing fits.",
      items: { type: "string", maxLength: 50 },
    },
    actionSuggestion: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          properties: {
            kind: {
              type: "string",
              // "none" is accepted from the model (matches the OpenAPI enum)
              // and normalized to null below so the client only ever sees a
              // concrete actionable kind or null.
              enum: [
                "evolve_roadmap",
                "refresh_insights",
                "reflect_on_task",
                "none",
              ],
            },
            label: { type: "string" },
            rationale: { type: "string" },
          },
          required: ["kind", "label", "rationale"],
        },
        { type: "null" },
      ],
      description:
        "Set to a non-null object only when the conversation makes one of these app actions clearly relevant. Otherwise null.",
    },
    memoryUpdate: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          properties: {
            summary: {
              type: "string",
              description:
                "1-3 sentence rolling summary of what we've discussed and what matters to this user.",
            },
            newFacts: {
              type: "array",
              description:
                "Brand-new durable facts the user revealed THIS turn (e.g. 'has a knee injury'). Do not repeat existing facts.",
              items: { type: "string" },
            },
          },
          required: ["summary", "newFacts"],
        },
        { type: "null" },
      ],
      description:
        "Set ONLY when the user revealed something durable this turn. Otherwise null.",
    },
  },
  required: ["reply", "suggestedReplies", "actionSuggestion", "memoryUpdate"],
} as const;

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
  } = parsed.data;

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

    const systemContext = `You are RubAI — a strategic AI execution coach inside a mobile app. The user has come to you for guidance.

Speak conversationally, with warmth and precision. EVERY reply must ground itself in the real context below — reference the current phase, today's tasks, a recent reflection, a learned trait, or a known fact, not generic advice. Push back gently when they make excuses, celebrate small wins, name the pattern you see.

Hard rules:
- "reply" is plain prose. No markdown, headings, bullets, or emojis. Under 110 words unless they explicitly ask for detail.
- "suggestedReplies": 0-3 short follow-ups (<= 50 chars each) that THIS user would plausibly want to send next given THIS context. Each must reference something concrete (a phase name, a reflection reason, a fact). If nothing fits, return [].
- "actionSuggestion": include only when one of these app actions is genuinely warranted right now:
    • evolve_roadmap — they have ≥3 reflections since the last evolution AND the conversation surfaces a real mismatch with the plan.
    • refresh_insights — they're asking about themselves / patterns / "what should I focus on" and the learned profile feels stale.
    • reflect_on_task — they mentioned a specific task they did or skipped and haven't reflected on it.
  Otherwise return null. Don't suggest the same action two turns in a row.
- "memoryUpdate": include ONLY when the user revealed something durable in THIS message (a constraint, preference, life event, identity statement). Otherwise null. The summary you write replaces the prior summary; keep it ≤ 3 sentences. newFacts must not duplicate existing facts.
- If the user goes off-topic, steer back to their goal in one sentence.

CONTEXT:
${contextBlock}`;

    const completion = await trackedCreate(req, {
      model: MODEL,
      max_completion_tokens: 1200,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "coach_reply",
          strict: true,
          schema: coachResponseSchema,
        },
      },
      messages: [
        { role: "system", content: systemContext },
        ...history.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user", content: message },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsedJson = JSON.parse(raw) as {
      reply: string;
      suggestedReplies: string[];
      actionSuggestion: { kind: string; label: string; rationale: string } | null;
      memoryUpdate: { summary: string; newFacts: string[] } | null;
    };

    // Defensive clamps so the AI can't blow our UI budgets even if it tries.
    // Length matches the prompt + OpenAPI description (<=50 chars per chip).
    const suggestedReplies = (parsedJson.suggestedReplies ?? [])
      .slice(0, 3)
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.length <= 50);

    // Whitelist actionable kinds; "none" is accepted from the model but
    // normalized to null so the client UI has a single null-or-concrete check.
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

    // Defensive fallback: a missing/empty reply from a malformed model output
    // would otherwise crash on .trim() or render an empty bubble.
    const reply =
      typeof parsedJson.reply === "string" && parsedJson.reply.trim().length > 0
        ? parsedJson.reply.trim()
        : "I'm here. Tell me a bit more about what you want to tackle next.";

    res.json({
      reply,
      suggestedReplies,
      actionSuggestion,
      memoryUpdate,
    });
  } catch (err) {
    req.log.error({ err }, "coach request failed");
    res.status(500).json({ error: "AI request failed" });
  }
});

const adaptSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    difficultyAdjustment: {
      type: "string",
      enum: ["easier", "same", "harder"],
    },
    adjustments: { type: "array", items: { type: "string" } },
    encouragement: { type: "string" },
  },
  required: ["difficultyAdjustment", "adjustments", "encouragement"],
} as const;

router.post("/adapt", async (req, res) => {
  const parsed = atlasAdaptPlanBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { profile, roadmap, behavioral } = parsed.data;

  try {
    const completion = await trackedCreate(req, {
      model: MODEL,
      max_completion_tokens: 700,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "adaptation",
          strict: true,
          schema: adaptSchema,
        },
      },
      messages: [
        {
          role: "system",
          content: `You are RubAI's adaptive planning engine. Based on behavioural data, decide whether to make the plan easier, keep it the same, or push harder. Provide 2-4 concrete adjustments (short imperative phrases, no markdown, no emojis) and a brief 1-sentence encouragement.`,
        },
        {
          role: "user",
          content: `Profile: ${JSON.stringify(profile)}\nRoadmap headline: ${roadmap.headline}\nBehavioural snapshot: ${JSON.stringify(behavioral)}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const data = JSON.parse(raw);
    res.json(data);
  } catch (err) {
    req.log.error({ err }, "adapt request failed");
    res.status(500).json({ error: "AI request failed" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Intake form: the AI generates a tailored questionnaire and then converts the
// answers into a UserProfile. This replaces the old one-question-at-a-time
// chat flow for users who prefer to fill everything in a single screen.
// ─────────────────────────────────────────────────────────────────────────────

const intakeQuestionsSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    introMessage: { type: "string" },
    questions: {
      type: "array",
      minItems: 6,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          label: { type: "string" },
          helper: { type: "string" },
          type: {
            type: "string",
            enum: ["short_text", "long_text", "single_select", "multi_select", "number"],
          },
          placeholder: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          unit: { type: "string" },
          required: { type: "boolean" },
        },
        required: ["id", "label", "helper", "type", "placeholder", "options", "unit", "required"],
      },
    },
  },
  required: ["introMessage", "questions"],
} as const;

const intakeProfileSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    profile: {
      type: "object",
      additionalProperties: false,
      properties: {
        goalStatement: { type: "string" },
        currentLevel: { type: "string" },
        availableTimePerDayMinutes: { type: "integer" },
        financialCondition: { type: "string" },
        productivityPattern: { type: "string" },
        consistencyLevel: { type: "string" },
        constraints: { type: "array", items: { type: "string" } },
        targetTimelineWeeks: { type: "integer" },
        notes: { type: "string" },
      },
      required: [
        "goalStatement",
        "currentLevel",
        "availableTimePerDayMinutes",
        "financialCondition",
        "productivityPattern",
        "consistencyLevel",
        "constraints",
        "targetTimelineWeeks",
        "notes",
      ],
    },
    followUp: { type: "string" },
  },
  required: ["profile", "followUp"],
} as const;

router.post("/intake-questions", async (req, res) => {
  const parsed = atlasIntakeQuestionsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { goalType, goalTitle } = parsed.data;
  const label = resolveGoalLabel(goalType, goalType === "custom" ? goalTitle : undefined);

  try {
    const completion = await trackedCreate(req, {
      model: MODEL,
      response_format: {
        type: "json_schema",
        json_schema: { name: "intake_questions", strict: true, schema: intakeQuestionsSchema },
      },
      messages: [
        {
          role: "system",
          content: `You are RubAI, a strategic AI execution coach. Generate a focused intake questionnaire so the system can build a real, personalized roadmap for the user's goal. The user described their goal as: "${goalTitle}" (category: ${label}).

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
- introMessage is one warm sentence (under 25 words) introducing what comes next. No emojis, no markdown.`,
        },
        {
          role: "user",
          content: `Generate the intake questionnaire for the goal: ${goalTitle}.`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const data = JSON.parse(raw);
    res.json(data);
  } catch (err) {
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
    const completion = await trackedCreate(req, {
      model: MODEL,
      response_format: {
        type: "json_schema",
        json_schema: { name: "intake_profile", strict: true, schema: intakeProfileSchema },
      },
      messages: [
        {
          role: "system",
          content: `You are RubAI's intake processor. Convert the user's questionnaire answers into a complete UserProfile that the roadmap engine can use.

Rules:
- Use the user's actual words where possible. Do not invent constraints they didn't mention.
- Treat answers prefixed with "Other:" as fully valid, custom user input — analyze them with equal weight to predefined selections, and let them override or refine generic options.
- When a multi-select answer mixes predefined options with an "Other:" entry, synthesise both into the profile (do not discard either).
- availableTimePerDayMinutes must be a realistic integer derived from their answer (default 30 if missing).
- targetTimelineWeeks must be a realistic integer (default 12 if missing).
- constraints is a list of short imperative phrases (e.g. "Travels for work weekly").
- notes is a one-paragraph synthesis (max 60 words) summarising the user, capturing any unique custom details they provided via "Other:" entries.
- followUp is one short, warm sentence RubAI wants to say before generating the roadmap. No emojis, no markdown.
- Goal category: ${label}.`,
        },
        {
          role: "user",
          content: `Goal: ${goalTitle}\n\nIntake answers:\n${transcript}`,
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const data = JSON.parse(raw);
    res.json(data);
  } catch (err) {
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

const behavioralProfileSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    profile: {
      type: "object",
      additionalProperties: false,
      properties: {
        summary: { type: "string" },
        consistencyLevel: {
          type: "string",
          enum: ["very_low", "low", "moderate", "high", "very_high"],
        },
        workloadTolerance: {
          type: "string",
          enum: ["light", "moderate", "heavy"],
        },
        motivationTrend: {
          type: "string",
          enum: ["rising", "steady", "declining"],
        },
        focusStyle: { type: "string" },
        learningPreference: { type: "string" },
        peakHours: { type: "array", items: { type: "string" } },
        failurePatterns: { type: "array", items: { type: "string" } },
        strengths: { type: "array", items: { type: "string" } },
        recommendedAdjustments: { type: "array", items: { type: "string" } },
      },
      required: [
        "summary",
        "consistencyLevel",
        "workloadTolerance",
        "motivationTrend",
        "focusStyle",
        "learningPreference",
        "peakHours",
        "failurePatterns",
        "strengths",
        "recommendedAdjustments",
      ],
    },
    aiInsight: { type: "string" },
  },
  required: ["profile", "aiInsight"],
} as const;

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
    .map(
      (r) =>
        `- ${r.date} • ${r.completed ? "done" : "skipped"} • ${r.taskTitle}${
          r.reasonTag ? ` [${r.reasonTag}]` : ""
        }${r.note ? ` — "${r.note}"` : ""}`,
    )
    .join("\n");

  try {
    const completion = await trackedCreate(req, {
      model: MODEL,
      max_completion_tokens: 1500,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "behavioral_profile",
          strict: true,
          schema: behavioralProfileSchema,
        },
      },
      messages: [
        {
          role: "system",
          content: `You are RubAI's behavioural analyst. Your job is to model how this specific human functions psychologically and operationally so the planner can adapt the roadmap, tasks, and coaching style to them.

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
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const data = JSON.parse(raw) as {
      profile: Record<string, unknown>;
      aiInsight: string;
    };
    res.json({
      profile: { ...data.profile, updatedAt: new Date().toISOString() },
      aiInsight: data.aiInsight,
    });
  } catch (err) {
    req.log.error({ err }, "behavioral-profile request failed");
    res.status(500).json({ error: "AI request failed" });
  }
});

const roadmapEvolutionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    evolvedRoadmap: roadmapSchema,
    hasChanged: { type: "boolean" },
    changeSummary: { type: "string" },
    phaseChanges: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          phaseId: { type: "string" },
          phaseTitle: { type: "string" },
          changeType: {
            type: "string",
            enum: ["added", "removed", "modified", "unchanged"],
          },
          summary: { type: "string" },
        },
        required: ["phaseId", "phaseTitle", "changeType", "summary"],
      },
    },
    rationale: { type: "string" },
  },
  required: [
    "evolvedRoadmap",
    "hasChanged",
    "changeSummary",
    "phaseChanges",
    "rationale",
  ],
} as const;

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
    .map(
      (r) =>
        `- ${r.date} • ${r.completed ? "done" : "skipped"} • ${r.taskTitle}${
          r.reasonTag ? ` [${r.reasonTag}]` : ""
        }${r.note ? ` — "${r.note}"` : ""}`,
    )
    .join("\n");

  try {
    const completion = await trackedCreate(req, {
      model: MODEL,
      max_completion_tokens: 4500,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "roadmap_evolution",
          strict: true,
          schema: roadmapEvolutionSchema,
        },
      },
      messages: [
        {
          role: "system",
          content: `You are RubAI's adaptive planner. Your job is to EVOLVE an existing roadmap so it stays accurate to how this user is actually executing — not to rewrite it from scratch.

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
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const data = JSON.parse(raw) as {
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
    req.log.error({ err }, "evolve-roadmap request failed");
    res.status(500).json({ error: "AI request failed" });
  }
});

export default router;
