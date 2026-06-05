import './_group.css';

const C = {
  bg: '#FAF6EE', card: '#FFFFFF', primary: '#0E7C5A', primaryFg: '#FAF6EE',
  muted: '#EFE8D9', mutedFg: '#807763', accent: '#C68A12', border: '#E1D9C5',
  fg: '#1B1812', secondary: '#F0E9DA',
};

const tasks = [
  { id: 1, title: 'Complete IELTS Reading Section 2', duration: 45, priority: 'high', done: true },
  { id: 2, title: 'Vocabulary flashcards — academic wordlist', duration: 20, priority: 'medium', done: false },
  { id: 3, title: 'Practice writing Task 1 chart description', duration: 30, priority: 'high', done: false },
  { id: 4, title: 'Review grammar: relative clauses', duration: 15, priority: 'low', done: false },
];

const priorityColor: Record<string, string> = {
  high: '#0E7C5A', medium: '#C68A12', low: '#807763',
};

export function TodayScreen() {
  return (
    <div className="rubai-root" style={{ padding: '0 0 90px 0' }}>
      {/* Status bar */}
      <div style={{ height: 44, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.fg }}>9:41</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: C.mutedFg }}>●●●●</span>
          <span style={{ fontSize: 11, color: C.mutedFg }}>WiFi</span>
          <span style={{ fontSize: 11, color: C.mutedFg }}>🔋</span>
        </div>
      </div>

      {/* Header */}
      <div style={{ padding: '12px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 500, color: C.mutedFg, letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
            Monday, 5 June
          </p>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.fg, margin: '2px 0 0', lineHeight: 1.2 }}>
            Deep Focus Sprint
          </h1>
          <p style={{ fontSize: 12, color: C.mutedFg, margin: '2px 0 0' }}>Week 3 · IELTS 7.0 Goal</p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={{ background: C.secondary, borderRadius: 20, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, color: C.accent }}>⚡</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.fg }}>12d</span>
          </div>
          <div style={{ background: C.primary, borderRadius: 20, padding: '4px 10px' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.primaryFg }}>IELTS</span>
          </div>
        </div>
      </div>

      {/* Coach note */}
      <div style={{ margin: '8px 16px', background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: '10px 12px', display: 'flex', gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 14, background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: C.primaryFg }}>A</span>
        </div>
        <p style={{ fontSize: 12, color: C.fg, margin: 0, lineHeight: 1.5, opacity: 0.85 }}>
          Your peak focus window starts at 9am. Lock in reading first — it's your strongest skill to push to 8.0 today.
        </p>
      </div>

      {/* Momentum row */}
      <div style={{ margin: '8px 16px', display: 'flex', gap: 8 }}>
        {[
          { label: 'Focus', value: '92%', sub: 'Peak window', icon: '🎯' },
          { label: 'Energy', value: 'High', sub: 'Morning', icon: '⚡' },
          { label: 'Tasks', value: '1/4', sub: 'Done today', icon: '✓' },
        ].map(m => (
          <div key={m.label} style={{ flex: 1, background: C.card, borderRadius: 10, border: `1px solid ${C.border}`, padding: '8px 10px' }}>
            <div style={{ fontSize: 16 }}>{m.icon}</div>
            <p style={{ fontSize: 16, fontWeight: 700, color: C.fg, margin: '2px 0 0' }}>{m.value}</p>
            <p style={{ fontSize: 10, fontWeight: 600, color: C.primary, margin: '1px 0 0', letterSpacing: '0.04em' }}>{m.label.toUpperCase()}</p>
            <p style={{ fontSize: 10, color: C.mutedFg, margin: '1px 0 0' }}>{m.sub}</p>
          </div>
        ))}
      </div>

      {/* Tasks */}
      <div style={{ padding: '12px 16px 6px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ fontSize: 11, fontWeight: 600, color: C.mutedFg, letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>
          Today's Tasks
        </p>
        <span style={{ fontSize: 11, color: C.primary, fontWeight: 500 }}>+ Add task</span>
      </div>

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tasks.map(t => (
          <div key={t.id} style={{
            background: t.done ? C.secondary : C.card,
            borderRadius: 12, border: `1px solid ${t.done ? C.muted : C.border}`,
            padding: '10px 12px', display: 'flex', alignItems: 'flex-start', gap: 10,
            opacity: t.done ? 0.7 : 1,
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: 9, border: `2px solid ${t.done ? C.primary : C.border}`,
              background: t.done ? C.primary : 'transparent', flexShrink: 0, marginTop: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {t.done && <span style={{ fontSize: 9, color: C.primaryFg, fontWeight: 700 }}>✓</span>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: C.fg, margin: 0, lineHeight: 1.35, textDecoration: t.done ? 'line-through' : 'none' }}>
                {t.title}
              </p>
              <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: C.mutedFg }}>{t.duration} min</span>
                <div style={{ width: 1, height: 10, background: C.border }} />
                <span style={{ fontSize: 10, fontWeight: 600, color: priorityColor[t.priority], textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t.priority}
                </span>
              </div>
            </div>
            <span style={{ fontSize: 11, color: C.mutedFg, flexShrink: 0 }}>›</span>
          </div>
        ))}
      </div>

      {/* Focus Pulse */}
      <div style={{ margin: '12px 16px 0', background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <p style={{ fontSize: 11, fontWeight: 600, color: C.mutedFg, letterSpacing: '0.06em', textTransform: 'uppercase', margin: 0 }}>Focus Pulse</p>
          <span style={{ fontSize: 10, color: C.mutedFg }}>Last 7 days</span>
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 40 }}>
          {[65, 80, 55, 90, 75, 92, 88].map((v, i) => (
            <div key={i} style={{ flex: 1, background: i === 6 ? C.primary : C.muted, borderRadius: '3px 3px 0 0', height: `${v}%` }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <span key={i} style={{ fontSize: 10, color: i === 6 ? C.primary : C.mutedFg, fontWeight: i === 6 ? 600 : 400 }}>{d}</span>
          ))}
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, width: 390, height: 82, background: C.card, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center' }}>
        {[
          { icon: '☀', label: 'Today', active: true },
          { icon: '🗺', label: 'Roadmap', active: false },
          { icon: '💬', label: 'Coach', active: false },
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
