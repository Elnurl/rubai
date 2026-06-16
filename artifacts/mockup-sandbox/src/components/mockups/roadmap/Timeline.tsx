import React, { useState } from "react";

const C = {
  bg: "#0D0D0D", card: "#1A1A1A", primary: "#0E7C5A", accent: "#D4A843",
  mutedFg: "#888888", border: "#2A2A2A", fg: "#F5F0E6", subFg: "#A0A0A0",
  done: "#0E7C5A", doneLight: "#1A2E2A", activeBg: "#2A2310",
};

const phases = [
  {
    id: "1", title: "Foundation", startWeek: 1, endWeek: 4,
    focus: "Build core habits and base skills.",
    milestones: [
      { id: "m1", title: "Skimming & scanning", description: "Reading speed mastery", weekNumber: 1 },
      { id: "m2", title: "Academic vocabulary", description: "500 words", weekNumber: 2 },
    ],
  },
  {
    id: "2", title: "Core Skills", startWeek: 5, endWeek: 10,
    focus: "Deep dive into writing, listening, speaking.",
    milestones: [
      { id: "m3", title: "Writing Task 1", description: "Band 6.5+", weekNumber: 5 },
      { id: "m4", title: "Multi-speaker listening", description: "Complex dialogs", weekNumber: 7 },
      { id: "m5", title: "Fluency drills", description: "Daily speaking", weekNumber: 9 },
    ],
  },
  {
    id: "3", title: "Integration", startWeek: 11, endWeek: 16,
    focus: "Combine skills for test-day.",
    milestones: [
      { id: "m6", title: "Mock tests", description: "Weekly simulations", weekNumber: 12 },
      { id: "m7", title: "Error analysis", description: "Fix recurring mistakes", weekNumber: 14 },
    ],
  },
  {
    id: "4", title: "Peak", startWeek: 17, endWeek: 20,
    focus: "Final polish and confidence.",
    milestones: [
      { id: "m8", title: "Exam simulation", description: "Mirror test-day", weekNumber: 18 },
      { id: "m9", title: "Score push", description: "7.0+ target", weekNumber: 19 },
    ],
  },
];

const activeCurrentWeek = 7;

function TimelineNode({ status, isActive, isLast }: { status: string; isActive: boolean; isLast: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 24, flexShrink: 0 }}>
      <div style={{
        width: isActive ? 16 : 12, height: isActive ? 16 : 12, borderRadius: 8,
        background: status === "completed" ? C.done : isActive ? C.accent : "#333",
        border: isActive ? `2px solid ${C.accent}` : "none",
        boxShadow: isActive ? "0 0 12px rgba(212,168,67,0.4)" : "none",
      }} />
      {!isLast && (
        <div style={{ width: 2, flex: 1, background: status === "completed" ? C.done : "#333", margin: "4px 0" }} />
      )}
    </div>
  );
}

function PhaseCard({ phase, index }: { phase: typeof phases[0]; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const status = activeCurrentWeek > phase.endWeek ? "completed" : activeCurrentWeek >= phase.startWeek ? "active" : "upcoming";
  const isActive = status === "active";
  const isCompleted = status === "completed";

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", width: "100%" }}>
      <TimelineNode status={status} isActive={isActive} isLast={index === phases.length - 1} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, marginBottom: 18 }}>
        <button onClick={() => setExpanded(!expanded)} style={{ textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%" }}>
          <div style={{
            background: isActive ? C.activeBg : C.card,
            borderRadius: 12,
            border: `1px solid ${isActive ? C.accent : C.border}`,
            padding: 14,
            transition: "all 0.2s",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.fg }}>{phase.title}</span>
              {isActive && (
                <span style={{ fontSize: 10, fontWeight: 700, color: C.accent, background: "#3A2E10", borderRadius: 999, padding: "3px 10px", letterSpacing: 1.2 }}>
                  NOW
                </span>
              )}
              {isCompleted && (
                <span style={{ fontSize: 10, fontWeight: 700, color: C.done, background: C.doneLight, borderRadius: 999, padding: "3px 10px", letterSpacing: 1.2 }}>
                  DONE
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: C.mutedFg, marginTop: 6, fontWeight: 500, letterSpacing: 0.3 }}>
              Week {phase.startWeek} — {phase.endWeek}
            </div>
          </div>
        </button>

        {expanded && (
          <div style={{ background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: 12, marginTop: 2, display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: 12, color: C.subFg, lineHeight: 1.5 }}>{phase.focus}</p>
            {phase.milestones.map((m) => (
              <div key={m.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ width: 6, height: 6, borderRadius: 3, background: isActive ? C.accent : C.border, marginTop: 6, flexShrink: 0 }} />
                <div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: C.fg }}>{m.title}</span>
                  <span style={{ fontSize: 11, color: C.mutedFg, marginLeft: 4 }}>{m.description}</span>
                  <div style={{ fontSize: 10, color: C.mutedFg, marginTop: 2 }}>Week {m.weekNumber}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function Timeline() {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter', sans-serif", overflow: "auto" }}>
      <div style={{ height: 44, background: C.bg, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.fg }}>9:41</span>
        <span style={{ fontSize: 11, color: C.mutedFg }}>●●●● WiFi 🔋</span>
      </div>
      <div style={{ padding: "12px 20px 8px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: C.fg, margin: 0 }}>Roadmap</h1>
        <p style={{ fontSize: 12, color: C.mutedFg, margin: "2px 0 0" }}>IELTS 7.0 · 20-week plan</p>
      </div>
      <div style={{ padding: "0 16px 90px", display: "flex", flexDirection: "column", gap: 2 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.primary, letterSpacing: 1.2, margin: "4px 0 12px" }}>20-WEEK TIMELINE</div>
        {phases.map((p, i) => <PhaseCard key={p.id} phase={p} index={i} />)}
      </div>
    </div>
  );
}
