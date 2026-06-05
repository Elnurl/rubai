import './_group.css';

const C = {
  bg: '#FAF6EE', card: '#FFFFFF', primary: '#0E7C5A', primaryFg: '#FAF6EE',
  muted: '#EFE8D9', mutedFg: '#807763', accent: '#C68A12', border: '#E1D9C5',
  fg: '#1B1812', secondary: '#F0E9DA',
};

const phases = [
  {
    id: 1, title: 'Foundation', weeks: 'Weeks 1–4', status: 'done',
    milestones: ['Reading: Skimming & scanning mastered', 'Vocab: 500 academic words'],
    progress: 100,
  },
  {
    id: 2, title: 'Core Skills', weeks: 'Weeks 5–10', status: 'active',
    milestones: ['Writing Task 1 — Band 6.5+', 'Listening: Multi-speaker dialogs', 'Speaking: Fluency drills'],
    progress: 62,
  },
  {
    id: 3, title: 'Integration', weeks: 'Weeks 11–16', status: 'upcoming',
    milestones: ['Full mock tests weekly', 'Error pattern analysis', 'Time management'],
    progress: 0,
  },
  {
    id: 4, title: 'Peak Performance', weeks: 'Weeks 17–20', status: 'upcoming',
    milestones: ['Exam simulation', 'Final score push to 7.0+'],
    progress: 0,
  },
];

export function RoadmapScreen() {
  return (
    <div className="rubai-root" style={{ padding: '0 0 90px 0' }}>
      {/* Status bar */}
      <div style={{ height: 44, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.fg }}>9:41</span>
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ fontSize: 11, color: C.mutedFg }}>●●●● WiFi 🔋</span>
        </div>
      </div>

      {/* Header */}
      <div style={{ padding: '12px 20px 8px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: C.fg, margin: 0, lineHeight: 1.2 }}>Living Roadmap</h1>
          <p style={{ fontSize: 12, color: C.mutedFg, margin: '2px 0 0' }}>IELTS 7.0 · 20-week plan</p>
        </div>
        <div style={{ background: C.primary, borderRadius: 20, padding: '4px 10px' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.primaryFg }}>Week 7</span>
        </div>
      </div>

      {/* Overall progress bar */}
      <div style={{ margin: '4px 16px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.mutedFg, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overall progress</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: C.primary }}>38%</span>
        </div>
        <div style={{ height: 6, background: C.muted, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ width: '38%', height: '100%', background: C.primary, borderRadius: 3 }} />
        </div>
      </div>

      {/* Adaptive Engine badge */}
      <div style={{ margin: '0 16px 12px', background: C.card, borderRadius: 12, border: `1px solid ${C.border}`, padding: '10px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 28, height: 28, borderRadius: 14, background: C.accent + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 13 }}>⚡</span>
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.fg, margin: 0 }}>Adaptive Engine</p>
              <p style={{ fontSize: 10, color: C.mutedFg, margin: '1px 0 0' }}>Updated 2h ago · 2 adjustments</p>
            </div>
          </div>
          <span style={{ fontSize: 10, color: C.primary, fontWeight: 500, background: C.primary + '15', borderRadius: 8, padding: '2px 8px' }}>Active</span>
        </div>
        <div style={{ marginTop: 8, padding: '8px', background: C.secondary, borderRadius: 8 }}>
          <p style={{ fontSize: 11, color: C.fg, margin: 0, lineHeight: 1.4 }}>
            📈 Writing Task 1 moved to <strong>Phase 2</strong> based on your strong progress in reading.
          </p>
        </div>
      </div>

      {/* Phase cards */}
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {phases.map(phase => (
          <div key={phase.id} style={{
            background: C.card, borderRadius: 12,
            border: `1px solid ${phase.status === 'active' ? C.primary + '60' : C.border}`,
            padding: '12px',
            boxShadow: phase.status === 'active' ? `0 0 0 1px ${C.primary}30` : 'none',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 11, flexShrink: 0,
                  background: phase.status === 'done' ? C.primary : phase.status === 'active' ? C.primary : C.muted,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {phase.status === 'done'
                    ? <span style={{ fontSize: 10, color: C.primaryFg }}>✓</span>
                    : phase.status === 'active'
                    ? <span style={{ fontSize: 9, color: C.primaryFg, fontWeight: 700 }}>{phase.id}</span>
                    : <span style={{ fontSize: 9, color: C.mutedFg, fontWeight: 700 }}>{phase.id}</span>}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: phase.status === 'upcoming' ? C.mutedFg : C.fg, margin: 0 }}>
                    {phase.title}
                  </p>
                  <p style={{ fontSize: 10, color: C.mutedFg, margin: '1px 0 0' }}>{phase.weeks}</p>
                </div>
              </div>
              {phase.status === 'active' && (
                <span style={{ fontSize: 10, fontWeight: 600, color: C.primary, background: C.primary + '15', borderRadius: 8, padding: '2px 8px' }}>
                  In Progress
                </span>
              )}
              {phase.status === 'done' && (
                <span style={{ fontSize: 10, fontWeight: 600, color: C.mutedFg, background: C.muted, borderRadius: 8, padding: '2px 8px' }}>
                  Done
                </span>
              )}
            </div>

            {phase.status !== 'upcoming' && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: C.mutedFg }}>Progress</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: phase.progress === 100 ? C.primary : C.accent }}>{phase.progress}%</span>
                </div>
                <div style={{ height: 4, background: C.muted, borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${phase.progress}%`, height: '100%', background: phase.progress === 100 ? C.primary : C.accent, borderRadius: 2 }} />
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {phase.milestones.map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 9, marginTop: 2, color: phase.status === 'done' ? C.primary : C.status === 'active' ? C.mutedFg : C.border }}>
                    {phase.status === 'done' ? '●' : '○'}
                  </span>
                  <span style={{ fontSize: 11, color: phase.status === 'upcoming' ? C.mutedFg : C.fg, lineHeight: 1.4 }}>{m}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, width: 390, height: 82, background: C.card, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center' }}>
        {[
          { icon: '☀', label: 'Today', active: false },
          { icon: '🗺', label: 'Roadmap', active: true },
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
