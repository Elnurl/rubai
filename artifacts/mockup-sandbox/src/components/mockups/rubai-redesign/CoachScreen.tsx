import './_group.css';

const C = {
  bg: '#FAF6EE', card: '#FFFFFF', primary: '#0E7C5A', primaryFg: '#FAF6EE',
  muted: '#EFE8D9', mutedFg: '#807763', accent: '#C68A12', border: '#E1D9C5',
  fg: '#1B1812', secondary: '#F0E9DA',
};

const messages = [
  {
    role: 'coach', text: "Good morning! I noticed you've completed 3 of your 4 tasks this week. Your reading comprehension is improving — you're averaging 78% on practice tests.",
    time: '9:02 AM',
  },
  {
    role: 'user', text: 'I keep struggling with the time management on the reading section. Any tips?',
    time: '9:05 AM',
  },
  {
    role: 'coach', text: "Based on your reflection logs, you're spending ~8 min on True/False/NG questions. Target: 4-5 min. Try scanning for keywords first, then confirm. Want me to schedule a 20-min drill today?",
    time: '9:06 AM',
    suggestions: ['Yes, add it to today', 'Show me the technique', 'Skip for now'],
  },
];

export function CoachScreen() {
  return (
    <div className="rubai-root" style={{ display: 'flex', flexDirection: 'column', height: 844 }}>
      {/* Status bar */}
      <div style={{ height: 44, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.fg }}>9:41</span>
        <span style={{ fontSize: 11, color: C.mutedFg }}>●●●● WiFi 🔋</span>
      </div>

      {/* Nav */}
      <div style={{ padding: '10px 16px', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ width: 36, height: 36, borderRadius: 18, background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: C.primaryFg }}>A</span>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 600, color: C.fg, margin: 0 }}>rubai Coach</p>
            <p style={{ fontSize: 10, color: C.primary, margin: '1px 0 0' }}>● Online · Smart model</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 16, background: C.secondary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 13 }}>🧠</span>
          </div>
          <div style={{ width: 32, height: 32, borderRadius: 16, background: C.secondary, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 13 }}>⋯</span>
          </div>
        </div>
      </div>

      {/* Session chip */}
      <div style={{ padding: '8px 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ background: C.primary + '15', borderRadius: 20, padding: '4px 10px', display: 'flex', gap: 5, alignItems: 'center' }}>
            <div style={{ width: 6, height: 6, borderRadius: 3, background: C.primary }} />
            <span style={{ fontSize: 10, fontWeight: 600, color: C.primary }}>IELTS 7.0 Goal · Week 7</span>
          </div>
          <span style={{ fontSize: 10, color: C.mutedFg }}>Today, 9:01 AM</span>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'coach' && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', maxWidth: '82%' }}>
                <div style={{ width: 24, height: 24, borderRadius: 12, background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: C.primaryFg }}>A</span>
                </div>
                <div>
                  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: '12px 12px 12px 4px', padding: '10px 12px' }}>
                    <p style={{ fontSize: 13, color: C.fg, margin: 0, lineHeight: 1.5 }}>{msg.text}</p>
                  </div>
                  <p style={{ fontSize: 10, color: C.mutedFg, margin: '3px 0 0 4px' }}>{msg.time}</p>
                </div>
              </div>
            )}
            {msg.role === 'user' && (
              <div style={{ maxWidth: '78%' }}>
                <div style={{ background: C.primary, borderRadius: '12px 12px 4px 12px', padding: '10px 12px' }}>
                  <p style={{ fontSize: 13, color: C.primaryFg, margin: 0, lineHeight: 1.5 }}>{msg.text}</p>
                </div>
                <p style={{ fontSize: 10, color: C.mutedFg, margin: '3px 4px 0 0', textAlign: 'right' }}>{msg.time}</p>
              </div>
            )}
            {msg.suggestions && (
              <div style={{ marginLeft: 32, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {msg.suggestions.map((s, j) => (
                  <div key={j} style={{ background: C.secondary, border: `1px solid ${C.border}`, borderRadius: 20, padding: '5px 12px', display: 'inline-block', alignSelf: 'flex-start' }}>
                    <span style={{ fontSize: 12, color: C.primary, fontWeight: 500 }}>{s}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Input bar */}
      <div style={{ padding: '10px 16px 16px', background: C.bg, borderTop: `1px solid ${C.border}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <div style={{ flex: 1, background: C.card, border: `1px solid ${C.border}`, borderRadius: 22, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, color: C.mutedFg }}>🖼</span>
            <span style={{ fontSize: 13, color: C.mutedFg, flex: 1 }}>Message your coach…</span>
            <span style={{ fontSize: 14, color: C.mutedFg }}>🎤</span>
          </div>
          <div style={{ width: 40, height: 40, borderRadius: 20, background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <span style={{ fontSize: 16, color: C.primaryFg }}>↑</span>
          </div>
        </div>
        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
          {['📅 Calendar context', '📊 My progress', '🗺 Roadmap'].map(chip => (
            <div key={chip} style={{ background: C.secondary, borderRadius: 14, padding: '3px 10px' }}>
              <span style={{ fontSize: 10, color: C.mutedFg, fontWeight: 500 }}>{chip}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ height: 82, background: C.card, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
        {[
          { icon: '☀', label: 'Today', active: false },
          { icon: '🗺', label: 'Roadmap', active: false },
          { icon: '💬', label: 'Coach', active: true },
          { icon: '🎯', label: 'Goals', active: false },
          { icon: '👤', label: 'Account', active: false },
        ].map(tab => (
          <div key={tab.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, paddingTop: 8 }}>
            {tab.active
              ? <div style={{ width: 40, height: 40, borderRadius: 20, background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: -8 }}>
                  <span style={{ fontSize: 18 }}>{tab.icon}</span>
                </div>
              : <span style={{ fontSize: 20 }}>{tab.icon}</span>}
            <span style={{ fontSize: 10, fontWeight: tab.active ? 600 : 400, color: tab.active ? C.primary : C.mutedFg }}>{tab.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
