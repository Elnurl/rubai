import React, { useState } from "react";

const C = {
  bg: "#FAF6EE",
  primary: "#0E7C5A",
  primaryLight: "#E8F5F0",
  accent: "#C68A12",
  accentLight: "#FDF3DC",
  mutedFg: "#9A8E78",
  border: "#E5DCC8",
  fg: "#1B1812",
  card: "#FFFFFF",
  done: "#0E7C5A",
  doneLight: "#DCF0E7",
  upcoming: "#F0EDE6",
  track: "#E5DCC8",
  trackFill: "#0E7C5A",
};

const phases = [
  {
    id: "1", title: "Foundation", startWeek: 1, endWeek: 4,
    focus: "Build core reading and vocabulary habits that accelerate every later phase.",
    milestones: [
      { id: "m1", title: "Skimming & scanning", description: "Master reading speed", weekNumber: 1 },
      { id: "m2", title: "Academic vocabulary", description: "500 essential words", weekNumber: 2 },
    ],
  },
  {
    id: "2", title: "Core Skills", startWeek: 5, endWeek: 10,
    focus: "Deep dive into writing, listening, and speaking for band 6.5+.",
    milestones: [
      { id: "m3", title: "Writing Task 1", description: "Band 6.5+ consistency", weekNumber: 5 },
      { id: "m4", title: "Multi-speaker listening", description: "Complex dialogs", weekNumber: 7 },
      { id: "m5", title: "Fluency drills", description: "Daily speaking practice", weekNumber: 9 },
    ],
  },
  {
    id: "3", title: "Integration", startWeek: 11, endWeek: 16,
    focus: "Combine all skills under timed, exam-day conditions.",
    milestones: [
      { id: "m6", title: "Mock tests", description: "Weekly full simulations", weekNumber: 12 },
      { id: "m7", title: "Error analysis", description: "Fix recurring patterns", weekNumber: 14 },
    ],
  },
  {
    id: "4", title: "Peak Performance", startWeek: 17, endWeek: 20,
    focus: "Final polish, confidence, and exam-day strategy.",
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

function NodeCircle({ status }: { status: string }) {
  if (status === "completed") {
    return (
      <div style={{
        width: 36, height: 36, borderRadius: 18,
        background: C.done,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, boxShadow: "0 2px 8px rgba(14,124,90,0.3)",
      }}>
        <span style={{ color: "#FFF", fontSize: 16, fontWeight: 800, lineHeight: 1 }}>✓</span>
      </div>
    );
  }
  if (status === "active") {
    return (
      <div style={{ position: "relative", width: 36, height: 36, flexShrink: 0 }}>
        <div style={{
          position: "absolute", inset: -4, borderRadius: 22,
          background: C.accentLight, animation: "pulse 2s ease-in-out infinite",
        }} />
        <div style={{
          width: 36, height: 36, borderRadius: 18,
          background: C.accent,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 2px 12px rgba(198,138,18,0.45)",
          position: "relative",
        }}>
          <div style={{ width: 10, height: 10, borderRadius: 5, background: "#FFF" }} />
        </div>
      </div>
    );
  }
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 18,
      border: `2px dashed ${C.border}`,
      background: C.upcoming,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
    }}>
      <div style={{ width: 8, height: 8, borderRadius: 4, background: C.track }} />
    </div>
  );
}

function Connector({ status }: { status: string }) {
  return (
    <div style={{
      width: 2, height: 28, marginLeft: 17, flexShrink: 0,
      background: status === "completed"
        ? C.trackFill
        : "repeating-linear-gradient(to bottom, #D1C4A8 0, #D1C4A8 5px, transparent 5px, transparent 10px)",
    }} />
  );
}

function PhaseCard({ phase, index }: { phase: typeof phases[0]; index: number }) {
  const [expanded, setExpanded] = useState(index === 1);
  const status = getStatus(phase);
  const isActive = status === "active";
  const isCompleted = status === "completed";
  const isLast = index === phases.length - 1;

  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <NodeCircle status={status} />
          {!isLast && <Connector status={status} />}
        </div>

        <div style={{ flex: 1, marginBottom: isLast ? 0 : 4 }}>
          <button
            onClick={() => setExpanded(!expanded)}
            style={{
              width: "100%", textAlign: "left", background: "none", border: "none",
              cursor: "pointer", padding: 0,
            }}
          >
            <div style={{
              background: isActive ? "#FFFBF0" : C.card,
              borderRadius: 16,
              border: `1.5px solid ${isActive ? C.accent : isCompleted ? C.done + "40" : C.border}`,
              padding: "12px 14px",
              boxShadow: isActive ? "0 4px 20px rgba(198,138,18,0.12)" : isCompleted ? "0 2px 8px rgba(14,124,90,0.06)" : "0 1px 4px rgba(0,0,0,0.04)",
              transition: "all 0.2s",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: C.fg, letterSpacing: -0.2 }}>
                  {phase.title}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {isActive && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: C.accent,
                      background: C.accentLight, borderRadius: 999, padding: "3px 10px", letterSpacing: 1.2,
                      border: `1px solid ${C.accent}40`,
                    }}>
                      NOW
                    </span>
                  )}
                  {isCompleted && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: C.done,
                      background: C.doneLight, borderRadius: 999, padding: "3px 10px", letterSpacing: 1.2,
                    }}>
                      DONE ✓
                    </span>
                  )}
                  <span style={{ fontSize: 16, color: C.mutedFg, transform: expanded ? "rotate(180deg)" : "rotate(0deg)", display: "inline-block", transition: "transform 0.2s" }}>
                    ⌄
                  </span>
                </div>
              </div>
              <div style={{ fontSize: 11, color: C.mutedFg, marginTop: 5, fontWeight: 500 }}>
                Week {phase.startWeek} – {phase.endWeek} · {phase.milestones.length} milestone{phase.milestones.length !== 1 ? "s" : ""}
              </div>
            </div>
          </button>

          {expanded && (
            <div style={{
              background: C.card, borderRadius: 12, border: `1px solid ${C.border}`,
              padding: "12px 14px", marginTop: 6,
              display: "flex", flexDirection: "column", gap: 10,
            }}>
              <p style={{ fontSize: 12, color: C.fg, lineHeight: 1.6, margin: 0 }}>{phase.focus}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {phase.milestones.map((m) => (
                  <div key={m.id} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <div style={{
                      width: 16, height: 16, borderRadius: 8, marginTop: 1, flexShrink: 0,
                      border: `2px solid ${isActive ? C.accent : isCompleted ? C.done : C.border}`,
                      background: isCompleted ? C.doneLight : "transparent",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {isCompleted && <span style={{ fontSize: 8, color: C.done, fontWeight: 800 }}>✓</span>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.fg }}>{m.title}</div>
                      <div style={{ fontSize: 11, color: C.mutedFg, marginTop: 1 }}>{m.description}</div>
                      <div style={{ fontSize: 10, color: C.mutedFg, marginTop: 2, display: "flex", alignItems: "center", gap: 3 }}>
                        <span>📅</span> Week {m.weekNumber}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Flowchart() {
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

      {/* Progress bar */}
      <div style={{ padding: "14px 20px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.fg }}>Overall progress</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.primary }}>{progressPct}%</span>
        </div>
        <div style={{ height: 6, background: C.track, borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${progressPct}%`, background: `linear-gradient(90deg, ${C.primary}, #16A07A)`, borderRadius: 3 }} />
        </div>
      </div>

      {/* Phase label */}
      <div style={{ padding: "16px 20px 12px" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.primary, letterSpacing: 1.6 }}>20-WEEK ARC</div>
      </div>

      {/* Phases */}
      <div style={{ padding: "0 16px 100px" }}>
        {phases.map((p, i) => <PhaseCard key={p.id} phase={p} index={i} />)}
      </div>
    </div>
  );
}
