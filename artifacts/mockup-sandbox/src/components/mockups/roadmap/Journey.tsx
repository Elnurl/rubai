import React, { useState } from "react";

const C = {
  bg: "#0A1A0F",
  bgCard: "#112018",
  path: "rgba(220,210,185,0.7)",
  arrow: "rgba(220,210,185,0.5)",
  fg: "#EBE3D0",
  date: "#4EC17A",
  dateUpcoming: "#3A6B4A",
  desc: "#7A9980",
  dotDone: "#4EC17A",
  dotActive: "#F5C842",
  dotUpcoming: "transparent",
  dotBorder: "#3A6B4A",
  border: "#1D3427",
  active: "#F5C842",
  activeGlow: "rgba(245,200,66,0.2)",
  done: "#4EC17A",
  doneGlow: "rgba(78,193,122,0.15)",
  badge: "#1D3427",
};

const items = [
  {
    id: "1", date: "WEEK 1", title: "Foundation", desc: "Reading speed, vocabulary. The base everything else builds on.",
    side: "left" as const, status: "completed", weeks: "1–4",
    milestones: ["Skimming & scanning", "Academic vocabulary (500 words)"],
  },
  {
    id: "2", date: "WEEK 5", title: "Core Skills", desc: "Writing, listening, speaking. Deep practice for band 6.5+.",
    side: "right" as const, status: "active", weeks: "5–10",
    milestones: ["Writing Task 1 band 6.5+", "Multi-speaker listening", "Fluency drills"],
  },
  {
    id: "3", date: "WEEK 11", title: "Integration", desc: "Mock tests and error analysis under exam-day conditions.",
    side: "left" as const, status: "upcoming", weeks: "11–16",
    milestones: ["Weekly mock tests", "Error pattern analysis"],
  },
  {
    id: "4", date: "WEEK 17", title: "Peak Performance", desc: "Polish every skill. Build unshakeable exam-day confidence.",
    side: "right" as const, status: "upcoming", weeks: "17–20",
    milestones: ["Full exam simulation", "Score push to 7.0+"],
  },
];

const CONNECTOR_HEIGHT = 120;

function Dot({ status }: { status: string }) {
  const isDone = status === "completed";
  const isActive = status === "active";
  return (
    <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {isActive && (
        <div style={{
          position: "absolute", width: 32, height: 32, borderRadius: 16,
          background: C.activeGlow,
        }} />
      )}
      <div style={{
        width: isActive ? 20 : isDone ? 18 : 14,
        height: isActive ? 20 : isDone ? 18 : 14,
        borderRadius: "50%",
        background: isDone ? C.dotDone : isActive ? C.dotActive : C.dotUpcoming,
        border: isDone ? "none" : isActive ? `3px solid ${C.dotActive}` : `2px solid ${C.dotBorder}`,
        zIndex: 3, flexShrink: 0, position: "relative",
        boxShadow: isDone ? `0 0 12px ${C.doneGlow}` : isActive ? `0 0 16px ${C.activeGlow}` : "none",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {isDone && <span style={{ fontSize: 9, color: "#0A1A0F", fontWeight: 900 }}>✓</span>}
      </div>
    </div>
  );
}

function CardContent({
  item,
  expanded,
  onToggle,
}: {
  item: typeof items[0];
  expanded: boolean;
  onToggle: () => void;
}) {
  const isDone = item.status === "completed";
  const isActive = item.status === "active";

  return (
    <button
      onClick={onToggle}
      style={{
        textAlign: "left", background: "none", border: "none",
        cursor: "pointer", padding: 0, width: "100%",
      }}
    >
      <div style={{
        background: isActive ? "rgba(245,200,66,0.06)" : isDone ? "rgba(78,193,122,0.05)" : C.bgCard,
        borderRadius: 14,
        border: `1px solid ${isActive ? "rgba(245,200,66,0.3)" : isDone ? "rgba(78,193,122,0.25)" : C.border}`,
        padding: "10px 12px",
        boxShadow: isActive ? `0 4px 24px ${C.activeGlow}` : "none",
        transition: "all 0.2s",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6, marginBottom: 2 }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 1.3,
            color: isDone ? C.done : isActive ? C.active : C.dateUpcoming,
          }}>
            {item.date}
          </span>
          {isActive && (
            <span style={{
              fontSize: 8, fontWeight: 800, color: C.active,
              background: "rgba(245,200,66,0.15)", borderRadius: 999,
              padding: "2px 7px", letterSpacing: 1.2,
            }}>
              NOW
            </span>
          )}
          {isDone && (
            <span style={{
              fontSize: 8, fontWeight: 800, color: C.done,
              background: "rgba(78,193,122,0.12)", borderRadius: 999,
              padding: "2px 7px", letterSpacing: 1.2,
            }}>
              DONE
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.fg, letterSpacing: -0.2, lineHeight: 1.2 }}>
          {item.title}
        </div>
        <div style={{ fontSize: 10, color: C.desc, lineHeight: 1.4, marginTop: 3 }}>
          {item.desc}
        </div>

        {expanded && (
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>
            {item.milestones.map((m, i) => (
              <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", marginBottom: 4 }}>
                <div style={{
                  width: 5, height: 5, borderRadius: "50%", flexShrink: 0, marginTop: 4,
                  background: isActive ? C.active : isDone ? C.done : C.dateUpcoming,
                }} />
                <span style={{ fontSize: 10, color: isActive ? C.fg : C.desc, lineHeight: 1.4 }}>{m}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

function WaypointRow({ item, index }: { item: typeof items[0]; index: number }) {
  const [expanded, setExpanded] = useState(index === 1);
  const isLeft = item.side === "left";
  const isLast = index === items.length - 1;

  const connectorSvg = !isLast ? (
    <svg
      width="40"
      height={CONNECTOR_HEIGHT}
      viewBox={`0 0 40 ${CONNECTOR_HEIGHT}`}
      style={{ flexShrink: 0, display: "block" }}
    >
      {isLeft ? (
        <path
          d={`M20,0 C20,${CONNECTOR_HEIGHT * 0.5} 20,${CONNECTOR_HEIGHT * 0.5} 20,${CONNECTOR_HEIGHT}`}
          fill="none"
          stroke={C.path}
          strokeWidth="2"
          strokeDasharray="5,5"
        />
      ) : (
        <path
          d={`M20,0 C20,${CONNECTOR_HEIGHT * 0.5} 20,${CONNECTOR_HEIGHT * 0.5} 20,${CONNECTOR_HEIGHT}`}
          fill="none"
          stroke={C.path}
          strokeWidth="2"
          strokeDasharray="5,5"
        />
      )}
      <polygon
        points={`15,${CONNECTOR_HEIGHT - 8} 20,${CONNECTOR_HEIGHT} 25,${CONNECTOR_HEIGHT - 8}`}
        fill={C.arrow}
      />
    </svg>
  ) : null;

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "flex-start", width: "100%" }}>
      {/* Left card slot */}
      <div style={{ flex: 1, minWidth: 0, paddingTop: 0 }}>
        {isLeft ? (
          <CardContent item={item} expanded={expanded} onToggle={() => setExpanded(!expanded)} />
        ) : <div />}
      </div>

      {/* Center rail */}
      <div style={{ width: 40, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Dot status={item.status} />
        {connectorSvg}
      </div>

      {/* Right card slot */}
      <div style={{ flex: 1, minWidth: 0, paddingTop: 0 }}>
        {!isLeft ? (
          <CardContent item={item} expanded={expanded} onToggle={() => setExpanded(!expanded)} />
        ) : <div />}
      </div>
    </div>
  );
}

export function Journey() {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter', system-ui, sans-serif", overflow: "auto" }}>
      {/* Status bar */}
      <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: C.fg }}>9:41</span>
        <span style={{ fontSize: 10, color: C.desc }}>●●●● WiFi 🔋</span>
      </div>

      {/* Header */}
      <div style={{ padding: "4px 20px 0" }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: C.done, letterSpacing: 1.8, marginBottom: 6 }}>ROADMAP</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.fg, margin: 0, letterSpacing: -0.5 }}>
          IELTS 7.0 Journey
        </h1>
        <p style={{ fontSize: 12, color: C.desc, margin: "4px 0 0" }}>20-week plan · Week 7 active</p>
      </div>

      {/* Start node */}
      <div style={{ padding: "20px 20px 0", display: "flex", justifyContent: "center" }}>
        <div style={{
          background: "rgba(78,193,122,0.12)", border: `1px solid rgba(78,193,122,0.3)`,
          borderRadius: 999, padding: "6px 20px",
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: 4, background: C.done }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: C.done, letterSpacing: 1 }}>START</span>
        </div>
      </div>

      {/* Waypoints */}
      <div style={{ padding: "12px 12px 0" }}>
        {items.map((item, i) => (
          <WaypointRow key={item.id} item={item} index={i} />
        ))}
      </div>

      {/* Finish node */}
      <div style={{ padding: "8px 20px 100px", display: "flex", justifyContent: "center" }}>
        <div style={{
          background: "rgba(245,200,66,0.08)", border: `1px solid rgba(245,200,66,0.25)`,
          borderRadius: 999, padding: "6px 20px",
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>
          <span style={{ fontSize: 14 }}>🏆</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: C.active, letterSpacing: 1 }}>IELTS 7.0</span>
        </div>
      </div>
    </div>
  );
}
