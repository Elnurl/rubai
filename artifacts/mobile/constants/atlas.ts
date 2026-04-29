import type { GoalType, UserProfile } from "@workspace/api-client-react";

export const TEMPLATE_GOAL_TYPES: Exclude<GoalType, "custom">[] = [
  "ielts",
  "programming",
  "fitness",
  "finance",
  "car",
];

type GoalMeta = {
  label: string;
  tagline: string;
  accent: string;
  iconLib: "ionicons" | "feather" | "material" | "fontawesome5";
  icon: string;
  opener: string;
};

export const GOAL_META: Record<GoalType, GoalMeta> = {
  ielts: {
    label: "IELTS Preparation",
    tagline: "Hit your band score with disciplined daily practice.",
    accent: "#0E7C5A",
    iconLib: "ionicons",
    icon: "language",
    opener:
      "Welcome. I'm Atlas. We're going to build a real plan to land your IELTS band. To start — what target band score do you need, by what month, and what is the score for?",
  },
  programming: {
    label: "Learning Programming",
    tagline: "Build real skills, ship real projects.",
    accent: "#5856D6",
    iconLib: "ionicons",
    icon: "code-slash",
    opener:
      "I'm Atlas. We'll move you from where you are now to shipping real software. First — what specifically do you want to be able to build, and is there a deadline driving this?",
  },
  fitness: {
    label: "Fitness Goals",
    tagline: "A body plan you'll actually follow.",
    accent: "#C0392B",
    iconLib: "ionicons",
    icon: "barbell",
    opener:
      "Atlas here. We'll build a fitness plan that respects your real life. To begin — what's the specific outcome (lose fat, gain muscle, run a distance, athletic milestone) and when do you want it by?",
  },
  finance: {
    label: "Financial Improvement",
    tagline: "Move money with intention.",
    accent: "#0E7C5A",
    iconLib: "ionicons",
    icon: "trending-up",
    opener:
      "I'm Atlas. Money goals only work when the plan is honest. Tell me — what financial outcome are you chasing (saving target, debt clear, income jump), and what's your deadline?",
  },
  car: {
    label: "Buying a Car",
    tagline: "From research to driving away.",
    accent: "#C68A12",
    iconLib: "ionicons",
    icon: "car-sport",
    opener:
      "Welcome. I'm Atlas. Buying a car is a campaign, not a wish. To start — what kind of car are you targeting, and what's your real deadline to be driving it?",
  },
  custom: {
    label: "Custom Goal",
    tagline: "Any target you set, in any field.",
    accent: "#0E7C5A",
    iconLib: "ionicons",
    icon: "sparkles",
    opener: "",
  },
};

export function customOpener(title: string): string {
  return `Welcome. I'm Atlas. You said: "${title.trim()}". I take that seriously. To turn it into a real plan — what's the specific outcome you'll be able to see, and what's your honest deadline?`;
}

export function goalLabel(profile: { goalType: GoalType; customGoalTitle?: string }): string {
  if (profile.goalType === "custom" && profile.customGoalTitle?.trim()) {
    return profile.customGoalTitle.trim();
  }
  return GOAL_META[profile.goalType].label;
}

export function profileGoalLabel(profile: UserProfile): string {
  return goalLabel({
    goalType: profile.goalType,
    customGoalTitle: profile.customGoalTitle,
  });
}

export const ATLAS_TAGLINE = "Your AI execution coach.";
