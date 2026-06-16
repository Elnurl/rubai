import React, { useState } from "react";

const C = {
  bg: "#0C0C0C",
  card: "#161616",
  cardActive: "#1C1A0F",
  primary: "#0E7C5A",
  accent: "#D4A843",
  accentGlow: "rgba(212,168,67,0.25)",
  mutedFg: "#666",
  subFg: "#999",
  border: "#242424",
  borderActive: "#D4A843",
  fg: "#F0EAD8",
  done: "#0E7C5A",
  doneGlow: "rgba(14,124,90,0.2)",
  track: "#242424",
  trackFill: "#0E7C5A",
  lineComplete: "#0E7C5A",
  lineUpcoming: "#242424",
};

const phases = [
  {
    id: "1", title: "Foundation", startWeek: 1, endWeek: 4,
    focus: "Build core reading speed and vocabulary that compound into every later skill.",
    milestones: [
      { id: "m1", title: "Skimming & scanning", description: "Master reading speed", weekNumber: 1 },
      { id: "m2", title: "Academic vocabulary", description: "500 essential words", weekNumber: 2 },
    ],
  },
  {
    id: "2", title: "Core Skills", startWeek: 5, endWeek: 10,
    focus: "Deep dive into writing, listening, and speaking — the three pillars of band 7.",
    milestones: [
      { id: "m3", title: "Writing Task 1", description: "Band 6.5+ consistency", weekNumber: 5 },
      { id: "m4", title: "Multi-speaker listening", description: "Complex dialogs", weekNumber: 7 },
      { id: "m5", title: "Fluency drills", description: "Daily speaking practice", weekNumber: 9 },
    ],
  },
  {
    id: "3", title: "Integration", startWeek: 11, endWeek: 16,
    focus: "Run all four skills together under timed, exam-day pressure.",
    milestones: [
      { id: "m6", title: "Mock tests", description: "Weekly full simulations", weekNumber: 12 },
      { id: "m7", title: "Error analysis", description: "Fix recurring patterns", weekNumber: 14 },
    ],
  },
  {
    id: "4", title: "Peak Performance", startWeek: 17, endWeek: 20,
    focus: "Sharpen, refine, and build unshakeable exam-day confidence.",
    milestones: [
      { id: "m8", title: "Exam simulation", description: "Mirror test-day exactly", weekNumber: 18 },
      { id: "m9", title: "Score push", description: "7.0+ final target", weekNumber: 19 },
    ],
  },
];

const TOTAL_WEEKS = 20;
const activeCurrentWeek = 7;

function getStatus(phase: typeof phases[0]) {
  if (activeCurrentWeek > phase.endWeek) return "completed";
  if (activeCurrentWeek >= phase.startWeek) return "active";
  return "upcoming";
}

function TimelineDot({ status, isActive }: { status: string; isActive: boolean }) {
  if (status === "completed") {
    return (
      <div style={{
        width: 20, height: 20, borderRadius: 10, background: C.done,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, zIndex: 2, position: "relative",
        boxShadow: `0 0 0 4px ${C.bg}, 0 0 12px ${C.doneGlow}`,
      }}>
        <span style={{ color: "#fff", fontSize: 10, fontWeight: 800, lineHeight: 1 }}>✓</span>
      </div>
    );
  }
  if (isActive) {
    return (
      <div style={{ position: "relative", flexShrink: 0 }}>
        <div style={{
          position: "absolute", inset: -6, borderRadius: 16,
          background: C.accentGlow, borderRadius: "50%",
        }} />
        <div style={{
          width: 20, height: 20, borderRadius: 10, background: C.accent,
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", zIndex: 2,
          boxShadow: `0 0 0 4px ${C.bg}, 0 0 16px ${C.accentGlow}`,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: 3, background: "#fff" }} />
        </div>
      </div>
    );
  }
  return (
    <div style={{
      width: 14, height: 14, borderRadius: 7, background: "#222",
      border: `2px solid #333`, flexShrink: 0, zIndex: 2, position: "relative",
      boxShadow: `0 0 0 4px ${C.bg}`,
    }} />
  );
}

function PhaseRow({ phase, index }: { phase: typeof phases[0]; index: number }) {
  const [expanded, setExpanded] = useState(index === 1);
  const status = getStatus(phase);
  const isActive = status === "active";
  const isCompleted = status === "completed";
  const isLast = index === phases.length - 1;

  return (
    <div style={{ display: "flex", gap: 0, width: "100%" }}>
      {/* Timeline rail */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 48, flexShrink: 0 }}>
        <div style={{ width: 1, height: 16, background: index === 0 ? "transparent" : isCompleted ? C.lineComplete : C.lineUpcoming }} />
        <TimelineDot status={status} isActive={isActive} />
        {!isLast && (
          <div style={{
            width: 1, flex: 1, minHeight: 20,
            background: isCompleted ? C.lineComplete : C.lineUpcoming,
          }} />
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingBottom: isLast ? 0 : 20, paddingTop: 0 }}>
        {/* Week label */}
        <div style={{ fontSize: 10, fontWeight: 700, color: isCompleted ? C.done : isActive ? C.accent : C.mutedFg, letterSpacing: 1.4, marginBottom: 6, marginTop: 0, paddingTop: 0 }}>
          WEEK {phase.startWeek}–{phase.endWeek}
        </div>

        {/* Card */}
        <button
          onClick={() => setExpanded(!expanded)}
          style={{
            width: "100%", textAlign: "left", background: "none", border: "none",
            cursor: "pointer", padding: 0,
          }}
        >
          <div style={{
            background: isActive ? C.cardActive : C.card,
            borderRadius: 12,
            border: `1px solid ${isActive ? C.borderActive : isCompleted ? C.done + "50" : C.border}`,
            padding: "12px 14px",
            boxShadow: isActive ? `0 0 24px ${C.accentGlow}` : isCompleted ? `0 0 12px ${C.doneGlow}` : "none",
            transition: "all 0.2s",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: C.fg, letterSpacing: -0.3 }}>
                {phase.title}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {isActive && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: C.accent,
                    background: "rgba(212,168,67,0.15)", borderRadius: 999,
                    padding: "3px 10px", letterSpacing: 1.2,
                    border: `1px solid rgba(212,168,67,0.3)`,
                  }}>
                    NOW
                  </span>
                )}
                {isCompleted && (
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: C.done,
                    background: "rgba(14,124,90,0.15)", borderRadius: 999,
                    padding: "3px 10px", letterSpacing: 1.2,
                  }}>
                    DONE
                  </span>
                )}
                <span style={{ fontSize: 14, color: C.mutedFg, opacity: 0.7 }}>
                  {expanded ? "▲" : "▼"}
                </span>
              </div>
            </div>
            <div style={{ fontSize: 11, color: C.mutedFg, marginTop: 5 }}>
              {phase.milestones.length} milestone{phase.milestones.length !== 1 ? "s" : ""}
            </div>
          </div>
        </button>

        {/* Expanded body */}
        {expanded && (
          <div style={{
            background: "#111", borderRadius: 10,
            border: `1px solid ${C.border}`,
            padding: "12px 14px", marginTop: 6,
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            <p style={{ fontSize: 12, color: C.subFg, lineHeight: 1.6, margin: 0 }}>
              {phase.focus}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {phase.milestones.map((m) => (
                <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: 3, flexShrink: 0, marginTop: 5,
                    background: isActive ? C.accent : isCompleted ? C.done : "#444",
                  }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: C.fg }}>{m.title}</div>
                    <div style={{ fontSize: 11, color: C.mutedFg, marginTop: 1 }}>{m.description}</div>
                    <div style={{ fontSize: 10, color: "#555", marginTop: 2 }}>Week {m.weekNumber}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function Timeline() {
  const progressPct = Math.round((activeCurrentWeek / TOTAL_WEEKS) * 100);

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter', system-ui, sans-serif", overflow: "auto" }}>
      {/* Status bar */}
      <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.fg }}>9:41</span>
        <span style={{ fontSize: 10, color: C.mutedFg }}>●●●● WiFi 🔋</span>
      </div>

      {/* Header */}
      <div style={{ padding: "4px 20px 0" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.primary, letterSpacing: 1.8, marginBottom: 6 }}>ROADMAP</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.fg, margin: 0, letterSpacing: -0.5 }}>
          IELTS 7.0 Journey
        </h1>
        <p style={{ fontSize: 12, color: C.mutedFg, margin: "4px 0 0" }}>Week {activeCurrentWeek} of {TOTAL_WEEKS}</p>
      </div>

      {/* Progress */}
      <div style={{ padding: "16px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.subFg }}>Progress</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.accent }}>{progressPct}%</span>
        </div>
        <div style={{ height: 4, background: "#1E1E1E", borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${progressPct}%`,
            background: `linear-gradient(90deg, ${C.done}, #16A07A)`, borderRadius: 2,
          }} />
        </div>
      </div>

      {/* Phase label */}
      <div style={{ padding: "16px 20px 12px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.mutedFg, letterSpacing: 1.6 }}>20-WEEK TIMELINE</div>
      </div>

      {/* Timeline */}
      <div style={{ padding: "0 16px 100px" }}>
        {phases.map((p, i) => (
          <PhaseRow key={p.id} phase={p} index={i} />
        ))}
      </div>
    </div>
  );
}
