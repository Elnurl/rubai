import React, { useState } from "react";

const C = {
  bg: "#FAF6EE", card: "#FFFFFF", primary: "#0E7C5A", primaryFg: "#FAF6EE",
  muted: "#EFE8D9", mutedFg: "#807763", accent: "#C68A12", border: "#E1D9C5",
  fg: "#1B1812", secondary: "#F0E9DA",
};

const phases = [
  {
    id: "1", title: "Foundation", startWeek: 1, endWeek: 4,
    focus: "Build the core habits and base skills needed for later phases.",
    milestones: [
      { id: "m1", title: "Skimming & scanning", description: "Master reading techniques for speed", weekNumber: 1 },
      { id: "m2", title: "Academic vocabulary", description: "Learn 500 essential words", weekNumber: 2 },
    ],
  },
  {
    id: "2", title: "Core Skills", startWeek: 5, endWeek: 10,
    focus: "Deep dive into writing, listening, and speaking modules.",
    milestones: [
      { id: "m3", title: "Writing Task 1", description: "Reach Band 6.5+ structure", weekNumber: 5 },
      { id: "m4", title: "Multi-speaker listening", description: "Handle complex audio dialogs", weekNumber: 7 },
      { id: "m5", title: "Fluency drills", description: "Daily speaking practice routine", weekNumber: 9 },
    ],
  },
  {
    id: "3", title: "Integration", startWeek: 11, endWeek: 16,
    focus: "Combine all skills into cohesive test-day performance.",
    milestones: [
      { id: "m6", title: "Full mock tests", description: "Weekly simulated exam conditions", weekNumber: 12 },
      { id: "m7", title: "Error pattern analysis", description: "Track and fix recurring mistakes", weekNumber: 14 },
    ],
  },
  {
    id: "4", title: "Peak Performance", startWeek: 17, endWeek: 20,
    focus: "Final polish and confidence building before exam.",
    milestones: [
      { id: "m8", title: "Exam simulation", description: "Mirror real test-day conditions", weekNumber: 18 },
      { id: "m9", title: "Score push to 7.0+", description: "Targeted final-week improvement", weekNumber: 19 },
    ],
  },
];

const activeCurrentWeek = 7;

function PhaseCard({ phase, index }: { phase: typeof phases[0]; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const status = activeCurrentWeek > phase.endWeek ? "completed" : activeCurrentWeek >= phase.startWeek ? "active" : "upcoming";
  const isActive = status === "active";
  const isCompleted = status === "completed";
  const milestoneCount = phase.milestones.length;

  return (
    <div style={{ background: C.card, borderRadius: 14, border: `1.5px solid ${isActive ? C.primary : C.border}`,
      padding: 14, gap: 8, display: "flex", flexDirection: "column",
      boxShadow: isActive ? "0 0 10px rgba(14,124,90,0.18)" : "none",
    }}>
      <button onClick={() => setExpanded(!expanded)} style={{ textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
          <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: C.fg, lineHeight: 1.3 }}>
            {phase.title}
          </span>
          <span style={{ color: C.mutedFg, fontSize: 18 }}>▼</span>
        </div>
        {isActive && (
          <div style={{ marginTop: 6, display: "inline-block", background: C.primary, color: C.primaryFg, borderRadius: 999, padding: "4px 12px", fontSize: 10, fontWeight: 700, letterSpacing: 1.4 }}>
            NOW
          </div>
        )}
        {isCompleted && (
          <div style={{ marginTop: 6, display: "inline-flex", alignItems: "center", gap: 4, background: `${C.primary}15`, border: `1px solid ${C.primary}`, color: C.primary, borderRadius: 999, padding: "3px 10px", fontSize: 10, fontWeight: 600, letterSpacing: 1.4 }}>
            <span style={{ fontSize: 11 }}>✓</span> DONE
          </div>
        )}
        <div style={{ fontSize: 12, color: C.mutedFg, marginTop: 4, fontWeight: 500, letterSpacing: 0.3 }}>
          Week {phase.startWeek} — Week {phase.endWeek}
          {milestoneCount > 0 ? ` · ${milestoneCount} milestone${milestoneCount === 1 ? "" : "s"}` : ""}
        </div>
      </button>

      {expanded && (
        <div style={{ marginTop: 2, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ height: 1, background: C.border, width: "100%" }} />
          <p style={{ fontSize: 13, lineHeight: 1.5, color: C.fg }}>{phase.focus}</p>
          {milestoneCount > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {phase.milestones.map((m) => (
                <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{ width: 16, height: 16, borderRadius: 8, border: `1.5px solid ${isActive ? C.primary : C.mutedFg + "88"}`, marginTop: 2, flexShrink: 0 }} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>{m.title}</span>
                    <span style={{ fontSize: 12, color: C.mutedFg, lineHeight: 1.4 }}>{m.description}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
                      <span style={{ fontSize: 11, color: C.mutedFg }}>📅</span>
                      <span style={{ fontSize: 11, color: C.mutedFg, fontWeight: 500 }}>Week {m.weekNumber}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function Current() {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter', sans-serif", overflow: "auto" }}>
      <div style={{ height: 44, background: C.bg, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.fg }}>9:41</span>
        <span style={{ fontSize: 11, color: C.mutedFg }}>●●●● WiFi 🔋</span>
      </div>
      <div style={{ padding: "12px 20px 8px", display: "flex", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.fg, margin: 0 }}>Roadmap</h1>
          <p style={{ fontSize: 12, color: C.mutedFg, margin: "2px 0 0" }}>IELTS 7.0 · 20-week plan</p>
        </div>
        <div style={{ background: C.primary, borderRadius: 20, padding: "4px 10px" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.primaryFg }}>Week 7</span>
        </div>
      </div>
      <div style={{ padding: "0 16px 90px", display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.primary, letterSpacing: 1.2, marginTop: 4 }}>ROADMAP</div>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.fg }}>IELTS 7.0 — 20 Weeks</div>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.primary, letterSpacing: 1.2 }}>20-WEEK ARC</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {phases.map((p, i) => <PhaseCard key={p.id} phase={p} index={i} />)}
        </div>
      </div>
    </div>
  );
}
