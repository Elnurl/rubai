import React, { useState, useRef, useEffect } from "react";

const C = {
  bg: "#141414",
  surface: "#1E1E1E",
  input: "#1E1E1E",
  inputBorder: "#2A2A2A",
  inputActive: "#333333",
  primary: "#0E7C5A",
  primaryFg: "#FAF6EE",
  fg: "#F0F0F0",
  muted: "#888888",
  chip: "#2A2A2A",
  chipFg: "#C0C0C0",
  chipBorder: "#3A3A3A",
  divider: "#2A2A2A",
  userBubble: "#0E7C5A",
  userBubbleFg: "#FAF6EE",
  assistantBubble: "#1E1E1E",
  assistantBubbleFg: "#F0F0F0",
  assistantBorder: "#2A2A2A",
};

const MESSAGES = [
  { role: "user", content: "I want to get promoted to senior engineer in 9 months" },
  { role: "assistant", content: "Great goal! Let me build a plan around your timeline and behavioral patterns. First, what industry are you in — software, fintech, or something else?" },
  { role: "user", content: "Software, backend development" },
  { role: "assistant", content: "Perfect. Backend to senior usually means system design + mentorship + cross-team impact. I'll create a 3-phase roadmap with weekly milestones. Ready when you are!" },
];

export function ChatBubbleDemo() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(MESSAGES);
  const [focused, setFocused] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const onSend = () => {
    if (!input.trim()) return;
    setMessages([...messages, { role: "user", content: input.trim() }]);
    setInput("");
    // Simulated assistant reply
    setTimeout(() => {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "Got it! I'm designing your intake form now. This will shape your personalized roadmap.",
      }]);
    }, 800);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, fontFamily: "'Inter', sans-serif", overflow: "auto", color: C.fg, display: "flex", flexDirection: "column" }}>
      {/* Status bar */}
      <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.fg }}>9:41</span>
        <span style={{ fontSize: 11, color: C.muted }}>●●●● WiFi 🔋</span>
      </div>

      {/* Header */}
      <div style={{ padding: "8px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.divider}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 14, background: C.primary, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#FFF", fontSize: 12, fontWeight: 700 }}>r</span>
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.fg }}>rubai</div>
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: C.primary, letterSpacing: 1.2 }}>INTAKE FORM</div>
        <div style={{ width: 28, height: 28, borderRadius: 14, background: "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: C.muted }}>
          ✕
        </div>
      </div>

      {/* Chat Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflow: "auto", padding: "16px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
            {msg.role === "assistant" && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                <div style={{ width: 16, height: 16, borderRadius: 8, background: C.primary }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: C.muted, letterSpacing: 0.5 }}>rubai</span>
              </div>
            )}
            <div style={{
              maxWidth: "85%",
              padding: "10px 14px",
              borderRadius: 14,
              background: msg.role === "user" ? C.userBubble : C.assistantBubble,
              color: msg.role === "user" ? C.userBubbleFg : C.assistantBubbleFg,
              border: msg.role === "user" ? "none" : `1px solid ${C.assistantBorder}`,
              fontSize: 13,
              lineHeight: 1.5,
              wordBreak: "break-word",
            }}>
              {msg.content}
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div style={{ padding: "12px 16px 20px", borderTop: `1px solid ${C.divider}` }}>
        <div style={{
          background: C.input,
          border: `1.5px solid ${focused ? C.inputActive : C.inputBorder}`,
          borderRadius: 16,
          padding: "12px 14px",
          transition: "border-color 0.2s",
        }}>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); } }}
            placeholder="Type your answer..."
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              color: C.fg,
              fontSize: 14,
              fontFamily: "'Inter', sans-serif",
              lineHeight: 1.5,
              minHeight: 40,
              resize: "none",
            }}
            rows={1}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.inputBorder}` }}>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={{
                width: 28, height: 28, borderRadius: 8,
                background: C.surface, border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: C.muted,
              }}>
                <span style={{ fontSize: 14 }}>📱</span>
              </button>
              <button style={{
                width: 28, height: 28, borderRadius: 8,
                background: C.surface, border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: C.muted,
              }}>
                <span style={{ fontSize: 14 }}>📷</span>
              </button>
              <button style={{
                width: 28, height: 28, borderRadius: 8,
                background: C.surface, border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: C.muted,
              }}>
                <span style={{ fontSize: 14 }}>🎤</span>
              </button>
            </div>
            <button
              onClick={onSend}
              style={{
                width: 32, height: 32, borderRadius: 8,
                background: input.trim() ? C.primary : C.surface,
                border: "none",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: input.trim() ? "pointer" : "default",
                color: input.trim() ? "#FFF" : C.muted,
                transition: "all 0.2s",
              }}
            >
              <span style={{ fontSize: 14 }}>↑</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
