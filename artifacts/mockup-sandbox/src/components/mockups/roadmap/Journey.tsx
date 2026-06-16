import React from "react";

const C = {
  bg: "#0d1f12",
  path: "#D8CFC0",
  arrow: "#B8A890",
  dot: "#FFFFFF",
  dotActive: "#4CAF50",
  dotRing: "#4CAF50",
  fg: "#E8E0D0",
  date: "#4CAF50",
  desc: "#9A9A8A",
};

const items = [
  { id: "1", date: "WEEK 1", title: "Foundation", desc: "Build core habits. Reading speed, vocabulary.", side: "left" as const, status: "completed" },
  { id: "2", date: "WEEK 5", title: "Core Skills", desc: "Writing, listening, speaking deep dive.", side: "right" as const, status: "active" },
  { id: "3", date: "WEEK 11", title: "Integration", desc: "Mock tests, error analysis, time management.", side: "left" as const, status: "upcoming" },
  { id: "4", date: "WEEK 17", title: "Peak Performance", desc: "Exam simulation, confidence building.", side: "right" as const, status: "upcoming" },
  { id: "5", date: "POST-EXAM", title: "Continuous Improvement", desc: "Reflection, next goals, adaptive learning.", side: "left" as const, status: "future" },
];

function PathSegment({ index }: { index: number }) {
  const isLast = index === items.length - 1;
  if (isLast) return null;
  const dir = index % 2 === 0 ? "right" : "left";
  const h = 100;
  return (
    <svg width="36" height={h} viewBox={`0 0 36 ${h}`} style={{ position: "absolute", top: 18, left: 0, zIndex: 1, overflow: "visible" }}>
      {dir === "right" ? (
        <path d={`M6,0 C6,${h/2} 30,${h/2} 30,${h}`} fill="none" stroke={C.path} strokeWidth={2} />
      ) : (
        <path d={`M30,0 C30,${h/2} 6,${h/2} 6,${h}`} fill="none" stroke={C.path} strokeWidth={2} />
      )}
      {/* Arrow marker */}
      <polygon
        points={dir === "right" ? `30,${h-6} 26,${h-12} 34,${h-12}` : `6,${h-6} 2,${h-12} 10,${h-12}`}
        fill={C.arrow}
      />
    </svg>
  );
}

function Dot({ status }: { status: string }) {
  const isActive = status === "active";
  const isFuture = status === "future";
  return (
    <div style={{
      width: isActive ? 18 : 14,
      height: isActive ? 18 : 14,
      borderRadius: "50%",
      background: isActive ? C.dotActive : isFuture ? "transparent" : C.dot,
      border: isFuture ? `3px solid ${C.dotRing}` : isActive ? `3px solid ${C.dotActive}` : "none",
      zIndex: 3,
      flexShrink: 0,
    }} />
  );
}

function Item({ item, index }: { item: typeof items[0]; index: number }) {
  const isLeft = item.side === "left";
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start", width: "100%", marginBottom: 8 }}>
      {isLeft ? (
        <>
          <div style={{ flex: 1, textAlign: "right", paddingTop: 0, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.date, letterSpacing: 1.2, marginBottom: 2 }}>
              {item.date}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.fg, marginBottom: 2, lineHeight: 1.2 }}>
              {item.title}
            </div>
            <div style={{ fontSize: 10, color: C.desc, lineHeight: 1.4 }}>
              {item.desc}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 36, flexShrink: 0, position: "relative" }}>
            <Dot status={item.status} />
            <PathSegment index={index} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }} />
        </>
      ) : (
        <>
          <div style={{ flex: 1, minWidth: 0 }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 36, flexShrink: 0, position: "relative" }}>
            <Dot status={item.status} />
            <PathSegment index={index} />
          </div>
          <div style={{ flex: 1, paddingTop: 0, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.date, letterSpacing: 1.2, marginBottom: 2 }}>
              {item.date}
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.fg, marginBottom: 2, lineHeight: 1.2 }}>
              {item.title}
            </div>
            <div style={{ fontSize: 10, color: C.desc, lineHeight: 1.4 }}>
              {item.desc}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function Journey() {
  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter', sans-serif", overflow: "auto" }}>
      <div style={{ height: 44, background: C.bg, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.fg }}>9:41</span>
        <span style={{ fontSize: 11, color: C.desc }}>●●●● WiFi 🔋</span>
      </div>
      <div style={{ padding: "12px 20px 8px" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: C.fg, margin: 0 }}>Roadmap</h1>
        <p style={{ fontSize: 12, color: C.desc, margin: "2px 0 0" }}>IELTS 7.0 · 20-week plan</p>
      </div>
      <div style={{ padding: "0 8px 90px" }}>
        {items.map((item, i) => (
          <Item key={item.id} item={item} index={i} />
        ))}
      </div>
    </div>
  );
}
