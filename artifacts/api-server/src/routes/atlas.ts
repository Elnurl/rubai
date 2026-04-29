import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import {
  AtlasOnboardingChatBody as atlasOnboardingChatBody,
  AtlasGenerateRoadmapBody as atlasGenerateRoadmapBody,
  AtlasGenerateDailyPlanBody as atlasGenerateDailyPlanBody,
  AtlasCoachBody as atlasCoachBody,
  AtlasAdaptPlanBody as atlasAdaptPlanBody,
  AtlasIntakeQuestionsBody as atlasIntakeQuestionsBody,
  AtlasIntakeSubmitBody as atlasIntakeSubmitBody,
} from "@workspace/api-zod";

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
    const conversational = await openai.chat.completions.create({
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

    const extraction = await openai.chat.completions.create({
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
    const completion = await openai.chat.completions.create({
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
  const { profile, roadmap, behavioral, date, currentWeek } = parsed.data;

  try {
    const completion = await openai.chat.completions.create({
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
- Task ids must be unique and short (e.g. "t-1", "t-2").
- focusOfTheDay: 5-9 word headline.
- coachNote: 1-2 sentence personal nudge from RubAI referencing the user's recent behaviour.
- No emojis. No markdown.`,
        },
        {
          role: "user",
          content: `Date: ${date}\nProfile: ${JSON.stringify(profile)}\nRoadmap: ${JSON.stringify(roadmap)}\nBehavioral snapshot: ${JSON.stringify(behavioral)}`,
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

router.post("/coach", async (req, res) => {
  const parsed = atlasCoachBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { profile, roadmap, todayPlan, behavioral, history, message } = parsed.data;

  try {
    const systemContext = `You are RubAI — a strategic AI execution coach inside a mobile app. The user has come to you for guidance.

Speak conversationally, with warmth and precision. Reference their actual plan, today's tasks, and recent behaviour. Be concrete, not generic. Suggest next steps when relevant. Push back gently when they make excuses, celebrate small wins, identify patterns.

Hard rules:
- Reply in plain prose. No markdown, no headings, no bullets, no emojis.
- Keep replies under 110 words unless explicitly asked for detail.
- If the user asks something off-topic, gently steer back to their goal.

Context:
PROFILE: ${JSON.stringify(profile)}
ROADMAP HEADLINE: ${roadmap.headline}
ACTIVE STRATEGY: ${roadmap.strategy}
${todayPlan ? `TODAY (${todayPlan.date}) — focus: ${todayPlan.focusOfTheDay} — tasks: ${JSON.stringify(todayPlan.tasks.map((t: { title: string }) => t.title))}` : "No daily plan generated yet."}
RECENT BEHAVIOUR: streak ${behavioral.currentStreakDays} days, completion rate ${(behavioral.completionRate * 100).toFixed(0)}%, recently completed: ${behavioral.completedTaskTitles.join("; ") || "none"}; missed: ${behavioral.missedTaskTitles.join("; ") || "none"}`;

    const completion = await openai.chat.completions.create({
      model: MODEL,
      max_completion_tokens: 600,
      messages: [
        { role: "system", content: systemContext },
        ...history.map((m: { role: string; content: string }) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user", content: message },
      ],
    });

    const reply = completion.choices[0]?.message?.content?.trim() ?? "";
    res.json({ reply });
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
    const completion = await openai.chat.completions.create({
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
    const completion = await openai.chat.completions.create({
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

  const transcript = questions
    .map((q) => {
      const answer = answers.find((a) => a.questionId === q.id)?.value ?? "";
      return `Q: ${q.label}\nA: ${answer || "(no answer)"}`;
    })
    .join("\n\n");

  try {
    const completion = await openai.chat.completions.create({
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
- availableTimePerDayMinutes must be a realistic integer derived from their answer (default 30 if missing).
- targetTimelineWeeks must be a realistic integer (default 12 if missing).
- constraints is a list of short imperative phrases (e.g. "Travels for work weekly").
- notes is a one-paragraph synthesis (max 60 words) summarising the user.
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

export default router;
