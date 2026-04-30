import type {
  BehavioralProfile,
  ChatMessage,
  CoachMemory,
  DailyPlan,
  GoalType,
  IntakeAnswer,
  IntakeQuestion,
  PhaseChange,
  ReflectionEntry,
  Roadmap,
  UserProfile,
} from "@workspace/api-client-react";
import type { TaskHistoryEntry } from "@/lib/storage";

export type StoredDailyPlan = {
  plan: DailyPlan;
  generatedAt: string;
};

export type RoadmapEvolutionEntry = {
  evolvedAt: string;
  trigger: "manual" | "auto";
  changeSummary: string;
  rationale: string;
  phaseChanges: PhaseChange[];
};

export type Goal = {
  id: string;
  createdAt: string;
  startDate: string;
  profile: UserProfile;
  roadmap: Roadmap | null;
  dailyPlan: StoredDailyPlan | null;
  coachHistory: ChatMessage[];
  taskHistory: TaskHistoryEntry[];
  reflections: ReflectionEntry[];
  behavioralProfile: BehavioralProfile | null;
  roadmapEvolutions: RoadmapEvolutionEntry[];
  lastEvolvedAt: string | null;
  coachMemory: CoachMemory | null;
};

export type SubscriptionTier = "free" | "pro" | "premium";

export type Subscription = {
  tier: SubscriptionTier;
  startedAt: string;
};

export type AccountPrefs = {
  notificationsEnabled: boolean;
  reminderTime: string;
  performanceUpdates: boolean;
};

export type IntakeDraftStage =
  | "describe"
  | "loading_questions"
  | "answering"
  | "submitting"
  | "ready_to_generate";

export type IntakeDraft = {
  goalType: GoalType;
  goalTitle: string;
  customGoalTitle?: string;
  questions: IntakeQuestion[];
  answers: IntakeAnswer[];
  stage: IntakeDraftStage;
  introMessage?: string;
  followUp?: string;
  synthesizedProfile?: UserProfile;
};

export const TIER_INFO: Record<
  SubscriptionTier,
  { label: string; goalLimit: number; tagline: string; price: string }
> = {
  free: {
    label: "Free",
    goalLimit: 1,
    tagline: "One active goal at a time.",
    price: "$0",
  },
  pro: {
    label: "Pro",
    goalLimit: 5,
    tagline: "Run up to 5 parallel goals across life areas.",
    price: "$8 / month",
  },
  premium: {
    label: "Premium",
    goalLimit: 25,
    tagline: "Up to 25 goals plus advanced AI re-evaluation.",
    price: "$18 / month",
  },
};

export function tierGoalLimit(tier: SubscriptionTier): number {
  return TIER_INFO[tier].goalLimit;
}

export const DEFAULT_SUBSCRIPTION: Subscription = {
  tier: "free",
  startedAt: new Date().toISOString(),
};

export const DEFAULT_ACCOUNT: AccountPrefs = {
  notificationsEnabled: true,
  reminderTime: "08:00",
  performanceUpdates: true,
};
