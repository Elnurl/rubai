import React, { useState } from "react";

const C = {
  bg: "#FAF6EE", primary: "#0E7C5A", primaryFg: "#FAF6EE", accent: "#C68A12",
  mutedFg: "#807763", border: "#E1D9C5", fg: "#1B1812", card: "#FFFFFF",
  done: "#0E7C5A", doneLight: "#E8F5F0", glow: "#F5E6C8",
};

const phases = [
  {
    id: "1", title: "Foundation", startWeek: 1, endWeek: 4,
    focus: "Build core habits and base skills for later phases.",
    milestones: [
      { id: "m1", title: "Skimming & scanning", description: "Master reading speed", weekNumber: 1 },
      { id: "m2", title: "Academic vocabulary", description: "500 essential words", weekNumber: 2 },
    ],
    side: "left",
  },
  {
    id: "2", title: "Core Skills", startWeek: 5, endWeek: 10,
    focus: "Deep dive into writing, listening, speaking.",
    milestones: [
      { id: "m3", title: "Writing Task 1", description: "Band 6.5+", weekNumber: 5 },
      { id: "m4", title: "Listening", description: "Multi-speaker dialogs", weekNumber: 7 },
      { id: "m5", title: "Fluency drills", description: "Daily practice", weekNumber: 9 },
    ],
    side: "right",
  },
  {
    id: "3", title: "Integration", startWeek: 11, endWeek: 16,
    focus: "Combine skills for test-day performance.",
    milestones: [
      { id: "m6", title: "Mock tests", description: "Weekly simulated exams", weekNumber: 12 },
      { id: "m7", title: "Error analysis", description: "Fix recurring mistakes", weekNumber: 14 },
    ],
    side: "left",
  },
  {
    id: "4", title: "Peak", startWeek: 17, endWeek: 20,
    focus: "Final polish and confidence building.",
    milestones: [
      { id: "m8", title: "Exam simulation", description: "Mirror test-day", weekNumber: 18 },
      { id: "m9", title: "Score push", description: "7.0+ target", weekNumber: 19 },
    ],
    side: "right",
  },
];

const activeCurrentWeek = 7;

function NodeDot({ status, isActive }: { status: string; isActive: boolean }) {
  if (status === "completed") {
    return (
      <div style={{ width: 28, height: 28, borderRadius: 14, background: C.done, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ color: "#FFF", fontSize: 14, fontWeight: 700 }}>✓</span>
      </div>
    );
  }
  if (isActive) {
    return (
      <div style={{ width: 28, height: 28, borderRadius: 14, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 0 8px rgba(198,138,18,0.5)" }}>
        <span style={{ color: "#FFF", fontSize: 10, fontWeight: 700 }}>●</span>
      </div>
    );
  }
  return (
    <div style={{ width: 28, height: 28, borderRadius: 14, border: `2px solid ${C.border}`, background: C.bg, flexShrink: 0 }} />
  );
}

function PathConnector({ isLast }: { isLast: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 28, flexShrink: 0 }}>
      {!isLast && (
        <div style={{ width: 2, flex: 1, background: "repeating-linear-gradient(to bottom, #D1C4A8 0, #D1C4A8 6px, transparent 6px, transparent 12px)", margin: "4px 0" }} />
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
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", width: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <NodeDot status={status} isActive={isActive} />
        <PathConnector isLast={index === phases.length - 1} />
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        <button onClick={() => setExpanded(!expanded)} style={{ textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%" }}>
          <div style={{ background: C.card, borderRadius: 14, border: `1.5px solid ${isActive ? C.accent : C.border}`, padding: 12, boxShadow: isActive ? "0 0 10px rgba(198,138,18,0.15)" : "none", transition: "all 0.2s" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.fg }}>{phase.title}</span>
              {isActive && (
                <span style={{ fontSize: 10, fontWeight: 700, color: C.accent, background: C.glow, borderRadius: 999, padding: "3px 10px", letterSpacing: 1.2 }}>
                  NOW
                </span>
              )}
              {isCompleted && (
                <span style={{ fontSize: 10, fontWeight: 700, color: C.done, background: C.doneLight, borderRadius: 999, padding: "3px 10px", letterSpacing: 1.2 }}>
                  DONE
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: C.mutedFg, marginTop: 4, fontWeight: 500 }}>
              Week {phase.startWeek} — {phase.endWeek}
            </div>
          </div>
        </button>

        {expanded && (
          <div style={{ background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: 12, marginTop: 2, display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ fontSize: 12, color: C.fg, lineHeight: 1.5 }}>{phase.focus}</p>
            {phase.milestones.map((m) => (
              <div key={m.id} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ width: 14, height: 14, borderRadius: 7, border: `1.5px solid ${isActive ? C.accent : C.border}`, marginTop: 2, flexShrink: 0 }} />
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

export function Flowchart() {
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
        <div style={{ fontSize: 11, fontWeight: 600, color: C.primary, letterSpacing: 1.2, margin: "4px 0 12px" }}>20-WEEK JOURNEY</div>
        {phases.map((p, i) => <PhaseCard key={p.id} phase={p} index={i} />)}
      </div>
    </div>
  );
}
