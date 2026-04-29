import type { GoalType } from "@workspace/api-client-react";

export const GOAL_TYPES: GoalType[] = [
  "ielts",
  "programming",
  "fitness",
  "finance",
  "car",
];

export const GOAL_META: Record<
  GoalType,
  {
    label: string;
    tagline: string;
    accent: string;
    iconLib: "ionicons" | "feather" | "material" | "fontawesome5";
    icon: string;
    opener: string;
  }
> = {
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
};

export const ATLAS_TAGLINE = "Your AI execution coach.";
