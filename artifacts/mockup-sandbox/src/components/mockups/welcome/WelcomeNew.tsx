import React, { useState } from "react";

const C = {
  bg: "#141414",
  surface: "#1E1E1E",
  surfaceHover: "#2A2A2A",
  input: "#1E1E1E",
  inputBorder: "#2A2A2A",
  inputActive: "#333333",
  primary: "#0E7C5A",
  primaryHover: "#119A6E",
  primaryFg: "#FAF6EE",
  fg: "#F0F0F0",
  muted: "#888888",
  mutedDark: "#555555",
  chip: "#2A2A2A",
  chipFg: "#C0C0C0",
  chipBorder: "#3A3A3A",
  divider: "#2A2A2A",
  card: "#1E1E1E",
  cardBorder: "#2A2A2A",
  cardHover: "#252525",
  accent: "#C68A12",
};

const TEMPLATES = [
  { id: "ielts", label: "IELTS Preparation", icon: "🏔", desc: "Hit your band score with disciplined daily practice.", color: "#0E7C5A" },
  { id: "prog", label: "Learning Programming", icon: "💻", desc: "Build real skills, ship real projects.", color: "#5B5BD7" },
  { id: "fit", label: "Fitness Goals", icon: "🏋", desc: "A body plan you'll actually follow.", color: "#D73A49" },
  { id: "money", label: "Financial Improvement", icon: "📈", desc: "Move money with intention.", color: "#0E7C5A" },
  { id: "career", label: "Career Growth", icon: "💼", desc: "Get promoted, build a network, land offers.", color: "#5B5BD7" },
  { id: "lang", label: "Language Learning", icon: "🗣", desc: "Speak confidently in 6 months.", color: "#D73A49" },
];

const EXAMPLE_PROMPTS = [
  "Get promoted to senior engineer in 9 months",
  "Run my first half marathon in 6 months",
  "Read 30 books and journal weekly this year",
  "Save 15,000 for a down payment in 9 months",
  "Move to Berlin and find a job by June",
];

export function WelcomeNew() {
  const [input, setInput] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const hasInput = input.trim().length > 0;
  const canContinue = hasInput || selected !== null;

  const onPickTemplate = (id: string) => {
    setInput("");
    setSelected(id);
  };

  const onExamplePress = (text: string) => {
    setInput(text);
    setSelected(null);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter', sans-serif", overflow: "auto", color: C.fg }}>
      {/* Status bar */}
      <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.fg }}>9:41</span>
        <span style={{ fontSize: 11, color: C.muted }}>●●●● WiFi 🔋</span>
      </div>

      {/* Header */}
      <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: C.primary, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#FFF", fontSize: 12, fontWeight: 700 }}>r</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>rubai</div>
        </div>
        <div style={{ width: 28, height: 28, borderRadius: 14, background: C.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: C.muted }}>
          ⚙️
        </div>
      </div>

      {/* Greeting */}
      <div style={{ padding: "16px 20px 8px" }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.primary, letterSpacing: 1.2, marginBottom: 8 }}>EXECUTION COACH</div>
        <div style={{ fontSize: 26, fontWeight: 700, color: C.fg, lineHeight: 1.2, letterSpacing: -0.5 }}>
          Hi, what do you want to make happen?
        </div>
      </div>

      {/* Input Area - Chat Style */}
      <div style={{ padding: "12px 16px" }}>
        <div style={{
          background: C.input,
          border: `1.5px solid ${focused ? C.inputActive : C.inputBorder}`,
          borderRadius: 16,
          padding: "14px 16px",
          transition: "border-color 0.2s",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.primary, letterSpacing: 1.2, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 14 }}>🎯</span>
            DESCRIBE THIS NEW GOAL
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="e.g. Get promoted to senior engineer in 9 months"
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              color: C.fg,
              fontSize: 15,
              fontFamily: "'Inter', sans-serif",
              lineHeight: 1.5,
              minHeight: 60,
              resize: "none",
            }}
            rows={2}
          />

          {/* Input Actions */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTop: `1px solid ${C.inputBorder}` }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{
                width: 32, height: 32, borderRadius: 8,
                background: C.surface, border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: C.muted,
              }}>
                <span style={{ fontSize: 16 }}>+</span>
              </button>
              <button style={{
                width: 32, height: 32, borderRadius: 8,
                background: C.surface, border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: C.muted,
              }}>
                <span style={{ fontSize: 14 }}>📱</span>
              </button>
              <button style={{
                width: 32, height: 32, borderRadius: 8,
                background: C.surface, border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: C.muted,
              }}>
                <span style={{ fontSize: 14 }}>🎨</span>
              </button>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button style={{
                padding: "6px 14px", borderRadius: 8,
                background: C.chip, border: "none",
                color: C.chipFg, fontSize: 11, fontWeight: 600,
                cursor: "pointer",
              }}>
                Plan
              </button>
              <button style={{
                width: 32, height: 32, borderRadius: 8,
                background: C.surface, border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: C.muted,
              }}>
                <span style={{ fontSize: 14 }}>🎤</span>
              </button>
              <button style={{
                width: 32, height: 32, borderRadius: 8,
                background: canContinue ? C.primary : C.surface,
                border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: canContinue ? "pointer" : "default",
                color: canContinue ? "#FFF" : C.muted,
                transition: "all 0.2s",
              }}>
                <span style={{ fontSize: 14 }}>↑</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Example Prompts */}
      <div style={{ padding: "0 20px 12px" }}>
        <div style={{ fontSize: 11, color: C.muted, marginBottom: 8, fontWeight: 500 }}>Try an example prompt →</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {EXAMPLE_PROMPTS.slice(0, 3).map((text) => (
            <button
              key={text}
              onClick={() => onExamplePress(text)}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                background: C.chip,
                border: `1px solid ${C.chipBorder}`,
                color: C.chipFg,
                fontSize: 11,
                fontWeight: 500,
                cursor: "pointer",
                transition: "all 0.15s",
              }}
            >
              {text}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div style={{ padding: "0 20px", display: "flex", alignItems: "center", gap: 12, margin: "8px 0" }}>
        <div style={{ flex: 1, height: 1, background: C.divider }} />
        <span style={{ fontSize: 10, fontWeight: 600, color: C.muted, letterSpacing: 1.2 }}>OR PICK A TEMPLATE</span>
        <div style={{ flex: 1, height: 1, background: C.divider }} />
      </div>

      {/* Templates */}
      <div style={{ padding: "0 16px 20px" }}>
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => onPickTemplate(t.id)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              marginBottom: 8,
              borderRadius: 12,
              background: selected === t.id ? C.primary : C.card,
              border: `1.5px solid ${selected === t.id ? C.primary : C.cardBorder}`,
              color: selected === t.id ? C.primaryFg : C.fg,
              cursor: "pointer",
              transition: "all 0.15s",
              textAlign: "left",
              fontFamily: "'Inter', sans-serif",
            }}
          >
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: selected === t.id ? "rgba(255,255,255,0.15)" : t.color + "20",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 20,
            }}>
              {t.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>
                {t.label}
              </div>
              <div style={{
                fontSize: 11,
                color: selected === t.id ? "rgba(255,255,255,0.7)" : C.muted,
                lineHeight: 1.4,
              }}>
                {t.desc}
              </div>
            </div>
            <div style={{ fontSize: 14, color: selected === t.id ? "#FFF" : C.muted }}>→</div>
          </button>
        ))}
      </div>

      {/* Footer CTA */}
      <div style={{ padding: "0 16px 40px" }}>
        <button style={{
          width: "100%",
          padding: "14px",
          borderRadius: 12,
          background: canContinue ? C.primary : C.surface,
          border: "none",
          color: canContinue ? C.primaryFg : C.muted,
          fontSize: 14,
          fontWeight: 600,
          cursor: canContinue ? "pointer" : "default",
          transition: "all 0.2s",
          fontFamily: "'Inter', sans-serif",
        }}>
          {canContinue ? "Continue to intake" : "Describe a goal or pick a template"}
        </button>
      </div>
    </div>
  );
}
