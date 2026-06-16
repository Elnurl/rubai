import React, { useState } from "react";

const C = {
  bg: "#1A2E1A", card: "#223822", primary: "#4CAF50", accent: "#D4A843",
  mutedFg: "#8FA88F", border: "#335533", fg: "#F0F0E6", subFg: "#A0B0A0",
  path: "#E8DCC0", done: "#4CAF50", doneLight: "#2A3E2A",
  arrow: "#C8B896",
};

const phases = [
  {
    id: "1", title: "Foundation", startWeek: 1, endWeek: 4,
    focus: "Build core habits and base skills.",
    milestones: [
      { id: "m1", title: "Skimming & scanning", description: "Reading speed", weekNumber: 1 },
      { id: "m2", title: "Academic vocabulary", description: "500 words", weekNumber: 2 },
    ],
  },
  {
    id: "2", title: "Core Skills", startWeek: 5, endWeek: 10,
    focus: "Deep dive into writing, listening, speaking.",
    milestones: [
      { id: "m3", title: "Writing Task 1", description: "Band 6.5+", weekNumber: 5 },
      { id: "m4", title: "Multi-speaker listening", description: "Complex dialogs", weekNumber: 7 },
      { id: "m5", title: "Fluency drills", description: "Daily practice", weekNumber: 9 },
    ],
  },
  {
    id: "3", title: "Integration", startWeek: 11, endWeek: 16,
    focus: "Combine skills for test-day.",
    milestones: [
      { id: "m6", title: "Mock tests", description: "Weekly simulations", weekNumber: 12 },
      { id: "m7", title: "Error analysis", description: "Fix mistakes", weekNumber: 14 },
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

function WindingPath({ index, isLast, status }: { index: number; isLast: boolean; status: string }) {
  const color = status === "completed" ? C.done : C.path;
  const curve = index % 2 === 0 ? "right" : "left";
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 40, flexShrink: 0, position: "relative" }}>
      <div style={{
        width: 12, height: 12, borderRadius: 6,
        background: color,
        border: "2px solid " + C.path,
        zIndex: 2,
      }} />
      {!isLast && (
        <svg width="40" height="60" viewBox="0 0 40 60" style={{ position: "absolute", top: 10, left: 0, zIndex: 1 }}>
          {curve === "right" ? (
            <path d="M6,0 Q6,30 34,30 L34,60" fill="none" stroke={C.path} strokeWidth={2.5} strokeDasharray="6,4" />
          ) : (
            <path d="M34,0 Q34,30 6,30 L6,60" fill="none" stroke={C.path} strokeWidth={2.5} strokeDasharray="6,4" />
          )}
        </svg>
      )}
    </div>
  );
}

function PhaseCard({ phase, index }: { phase: typeof phases[0]; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const status = activeCurrentWeek > phase.endWeek ? "completed" : activeCurrentWeek >= phase.startWeek ? "active" : "upcoming";
  const isActive = status === "active";
  const isCompleted = status === "completed";
  const offset = index % 2 === 0 ? 0 : 30;

  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", width: "100%", marginLeft: offset }}>
      <WindingPath index={index} isLast={index === phases.length - 1} status={status} />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6, marginBottom: 20, marginTop: -4 }}>
        <button onClick={() => setExpanded(!expanded)} style={{ textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%" }}>
          <div style={{
            background: C.card,
            borderRadius: 14,
            border: `1.5px solid ${isActive ? C.accent : C.border}`,
            padding: 12,
            boxShadow: isActive ? "0 0 12px rgba(212,168,67,0.2)" : "none",
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

export function Journey() {
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
        <div style={{ fontSize: 11, fontWeight: 600, color: C.primary, letterSpacing: 1.2, margin: "4px 0 12px" }}>YOUR JOURNEY</div>
        {phases.map((p, i) => <PhaseCard key={p.id} phase={p} index={i} />)}
      </div>
    </div>
  );
}
