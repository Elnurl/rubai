import React, { useRef, useState } from "react";

const C = {
  bg: "#0E0E0E",
  surface: "#1A1A1A",
  surface2: "#242424",
  inputBg: "#1A1A1A",
  inputBorder: "#2E2E2E",
  inputFocus: "#3E3E3E",
  primary: "#0E7C5A",
  primaryLight: "#119A6E",
  primaryFg: "#FFFFFF",
  fg: "#F0EDE8",
  fgMuted: "#888880",
  fgDim: "#555550",
  chip: "#1E1E1E",
  chipBorder: "#2E2E2E",
  chipFg: "#AAAAAA",
  accent: "#C68A12",
};

const CATEGORIES = [
  { id: "ielts", icon: "📚", label: "IELTS" },
  { id: "fit", icon: "💪", label: "Fitness" },
  { id: "code", icon: "💻", label: "Coding" },
  { id: "finance", icon: "📈", label: "Finance" },
  { id: "career", icon: "🚀", label: "Career" },
  { id: "lang", icon: "🗣", label: "Language" },
  { id: "biz", icon: "💼", label: "Business" },
];

const EXAMPLES = [
  "Get promoted in 9 months",
  "Run a half marathon by June",
  "Save $15,000 this year",
  "Ship a side project in 60 days",
];

export function WelcomeNew() {
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const [recording, setRecording] = useState(false);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasInput = input.trim().length > 0 || selectedCat !== null;

  const handleMic = () => {
    setRecording((r) => !r);
    if (!recording) {
      setTimeout(() => setRecording(false), 3000);
    }
  };

  const handleExample = (text: string) => {
    setInput(text);
    setSelectedCat(null);
    textareaRef.current?.focus();
  };

  const autoResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
  };

  return (
    <div
      style={{
        height: "100vh",
        background: C.bg,
        fontFamily: "'Inter', -apple-system, sans-serif",
        color: C.fg,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Status bar */}
      <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", flexShrink: 0 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>9:41</span>
        <span style={{ fontSize: 11, color: C.fgMuted }}>▐▐▐ WiFi 🔋</span>
      </div>

      {/* Top bar — workspace selector */}
      <div style={{ padding: "4px 18px 0", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface, border: `1px solid ${C.inputBorder}`, borderRadius: 8, padding: "6px 10px 6px 8px" }}>
          <div style={{ width: 22, height: 22, borderRadius: 6, background: C.primary, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>
            E
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>My Workspace</span>
          <span style={{ fontSize: 10, color: C.fgMuted, marginLeft: 2 }}>▾</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: C.surface, border: `1px solid ${C.inputBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: C.fgMuted }}>
            ☰
          </div>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: C.surface, border: `1px solid ${C.inputBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
            ⊡
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 0 24px" }}>

        {/* Greeting */}
        <div style={{ padding: "32px 20px 20px", textAlign: "center" }}>
          <div style={{ fontSize: 26, fontWeight: 700, lineHeight: 1.25, letterSpacing: -0.5, color: C.fg }}>
            Hi, what goal do you
            <br />
            want to crush?
          </div>
        </div>

        {/* ─── MAIN INPUT ─── */}
        <div style={{ padding: "0 14px 16px" }}>
          <div
            style={{
              background: C.inputBg,
              border: `1.5px solid ${focused ? C.inputFocus : C.inputBorder}`,
              borderRadius: 18,
              overflow: "hidden",
              transition: "border-color 0.2s",
              boxShadow: focused ? `0 0 0 3px ${C.primary}22` : "none",
            }}
          >
            {/* Textarea */}
            <div style={{ padding: "14px 16px 6px" }}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={autoResize}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder="Describe your goal or pick a template below…"
                rows={2}
                style={{
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: C.fg,
                  fontSize: 15,
                  fontFamily: "inherit",
                  lineHeight: 1.55,
                  resize: "none",
                  minHeight: 52,
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Bottom action bar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                padding: "8px 12px 12px",
                gap: 6,
              }}
            >
              {/* Left: + media attach */}
              <button
                style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: C.surface2, border: `1px solid ${C.chipBorder}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", color: C.fgMuted, fontSize: 18, fontWeight: 300,
                  flexShrink: 0,
                }}
                title="Fayl əlavə et"
              >
                +
              </button>

              {/* Spacer */}
              <div style={{ flex: 1 }} />

              {/* Mic */}
              <button
                onClick={handleMic}
                style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: recording ? C.primary : C.surface2,
                  border: `1px solid ${recording ? C.primary : C.chipBorder}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer", fontSize: 15, flexShrink: 0,
                  animation: recording ? "pulse 1s infinite" : "none",
                }}
                title="Səsli daxil et"
              >
                {recording ? "🔴" : "🎙"}
              </button>

              {/* Send / Arrow */}
              <button
                style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: hasInput ? C.primary : C.surface2,
                  border: `1px solid ${hasInput ? C.primary : C.chipBorder}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: hasInput ? "pointer" : "default",
                  flexShrink: 0, transition: "all 0.2s",
                }}
                title="Göndər"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M8 14V2M8 2L2 8M8 2L14 8" stroke={hasInput ? "#fff" : C.fgDim} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ─── CATEGORY CHIPS (horizontal scroll, Replit style) ─── */}
        <div style={{ paddingBottom: 12 }}>
          <div style={{
            display: "flex",
            overflowX: "auto",
            padding: "0 14px",
            gap: 8,
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}>
            <button style={{ width: 28, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: C.fgMuted, cursor: "pointer", flexShrink: 0 }}>‹</button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(cat.id === selectedCat ? null : cat.id)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  padding: "8px 14px",
                  borderRadius: 10,
                  background: selectedCat === cat.id ? C.primary + "22" : C.surface,
                  border: `1.5px solid ${selectedCat === cat.id ? C.primary : C.chipBorder}`,
                  color: selectedCat === cat.id ? C.primary : C.chipFg,
                  cursor: "pointer",
                  flexShrink: 0,
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: 20 }}>{cat.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 500, whiteSpace: "nowrap" }}>{cat.label}</span>
              </button>
            ))}
            <button style={{ width: 28, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: C.fgMuted, cursor: "pointer", flexShrink: 0 }}>›</button>
          </div>
        </div>

        {/* ─── EXAMPLE PROMPTS ─── */}
        <div style={{ padding: "4px 14px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 12, color: C.fgMuted, fontWeight: 500 }}>Try an example prompt</span>
            <span style={{ fontSize: 12, color: C.fgMuted }}>↻</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                onClick={() => handleExample(ex)}
                style={{
                  padding: "7px 12px",
                  borderRadius: 8,
                  background: C.chip,
                  border: `1px solid ${C.chipBorder}`,
                  color: C.chipFg,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  transition: "all 0.15s",
                }}
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* ─── RECENT GOALS ─── */}
        <div style={{ padding: "20px 14px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: C.fg }}>Your recent goals</span>
            <span style={{ fontSize: 12, color: C.primary, fontWeight: 500 }}>View All →</span>
          </div>
          {[
            { icon: "🏋", title: "Run 5km without stopping", sub: "Week 4 of 12 · Active" },
            { icon: "💻", title: "Build a portfolio site", sub: "Week 8 of 8 · Completed" },
          ].map((goal) => (
            <div
              key={goal.title}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "12px 14px", marginBottom: 8,
                borderRadius: 12, background: C.surface,
                border: `1px solid ${C.chipBorder}`,
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 22, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", background: C.surface2, borderRadius: 8 }}>
                {goal.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.fg, marginBottom: 2 }}>{goal.title}</div>
                <div style={{ fontSize: 11, color: C.fgMuted }}>{goal.sub}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ fontSize: 12, color: C.fgMuted }}>⛓</span>
                <span style={{ fontSize: 12, color: C.fgMuted }}>⋯</span>
              </div>
            </div>
          ))}
        </div>

      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}
