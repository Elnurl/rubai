import './_group.css';

const C = {
  bg: '#FAF6EE', card: '#FFFFFF', primary: '#0E7C5A', primaryFg: '#FAF6EE',
  muted: '#EFE8D9', mutedFg: '#807763', accent: '#C68A12', border: '#E1D9C5',
  fg: '#1B1812', secondary: '#F0E9DA',
};

const sections = [
  {
    title: 'Goals & Progress',
    items: [
      { icon: '🎯', label: 'Active Goals', value: '1 of 1', arrow: true },
      { icon: '📊', label: 'Behavioral Insights', value: '', arrow: true },
      { icon: '🧠', label: 'Coach Memory', value: '14 facts', arrow: true },
    ],
  },
  {
    title: 'Sync & Integrations',
    items: [
      { icon: '📅', label: 'Google Calendar', value: 'Connected', arrow: true, valueColor: '#0E7C5A' },
      { icon: '🔔', label: 'Smart Nudges', value: '', toggle: true, toggleOn: true },
    ],
  },
  {
    title: 'Appearance',
    items: [
      { icon: '🌙', label: 'Dark Mode', value: '', toggle: true, toggleOn: false },
    ],
  },
  {
    title: 'Account',
    items: [
      { icon: '🔒', label: 'Privacy & Legal', value: '', arrow: true },
      { icon: '❓', label: 'Help & Support', value: '', arrow: true },
      { icon: '↩', label: 'Sign Out', value: '', arrow: false, destructive: true },
    ],
  },
];

export function AccountScreen() {
  return (
    <div className="rubai-root" style={{ padding: '0 0 90px 0' }}>
      {/* Status bar */}
      <div style={{ height: 44, background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.fg }}>9:41</span>
        <span style={{ fontSize: 11, color: C.mutedFg }}>●●●● WiFi 🔋</span>
      </div>

      {/* Profile header */}
      <div style={{ padding: '12px 20px 16px', display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: 28, background: C.primary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span style={{ fontSize: 22, fontWeight: 700, color: C.primaryFg }}>MA</span>
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: C.fg, margin: 0 }}>Maya Aslanova</p>
          <p style={{ fontSize: 12, color: C.mutedFg, margin: '2px 0 0' }}>maya@example.com</p>
          <div style={{ display: 'flex', gap: 6, marginTop: 5 }}>
            <div style={{ background: C.primary + '18', borderRadius: 10, padding: '2px 8px' }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: C.primary }}>Pro Plan</span>
            </div>
            <div style={{ background: C.muted, borderRadius: 10, padding: '2px 8px' }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: C.mutedFg }}>12-day streak ⚡</span>
            </div>
          </div>
        </div>
        <span style={{ fontSize: 12, color: C.primary, fontWeight: 500 }}>Edit</span>
      </div>

      {/* Subscription card */}
      <div style={{ margin: '0 16px 16px', background: C.primary, borderRadius: 14, padding: '14px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, color: C.primaryFg + 'bb', letterSpacing: '0.07em', textTransform: 'uppercase', margin: 0 }}>Current Plan</p>
            <p style={{ fontSize: 18, fontWeight: 700, color: C.primaryFg, margin: '3px 0 0' }}>Pro · $8/mo</p>
            <p style={{ fontSize: 11, color: C.primaryFg + 'aa', margin: '3px 0 0' }}>Up to 5 goals · Voice coach · Behavioral AI</p>
          </div>
          <div style={{ background: C.primaryFg + '22', borderRadius: 10, padding: '4px 10px' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: C.primaryFg }}>Manage</span>
          </div>
        </div>
        <div style={{ marginTop: 10, height: 4, background: C.primaryFg + '30', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: '20%', height: '100%', background: C.primaryFg, borderRadius: 2 }} />
        </div>
        <p style={{ fontSize: 10, color: C.primaryFg + 'aa', margin: '4px 0 0' }}>1 of 5 goals in use</p>
      </div>

      {/* Settings sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '0 16px' }}>
        {sections.map(section => (
          <div key={section.title}>
            <p style={{ fontSize: 11, fontWeight: 600, color: C.mutedFg, letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 6px 4px' }}>
              {section.title}
            </p>
            <div style={{ background: C.card, borderRadius: 14, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
              {section.items.map((item, i) => (
                <div key={item.label} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                  borderBottom: i < section.items.length - 1 ? `1px solid ${C.border}` : 'none',
                }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: C.secondary, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: 14 }}>{item.icon}</span>
                  </div>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: (item as any).destructive ? '#B43E3E' : C.fg }}>
                    {item.label}
                  </span>
                  {item.value && (
                    <span style={{ fontSize: 12, color: (item as any).valueColor ?? C.mutedFg }}>{item.value}</span>
                  )}
                  {(item as any).toggle && (
                    <div style={{
                      width: 42, height: 24, borderRadius: 12,
                      background: (item as any).toggleOn ? C.primary : C.muted,
                      position: 'relative', flexShrink: 0,
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: 9, background: '#fff',
                        position: 'absolute', top: 3,
                        left: (item as any).toggleOn ? 21 : 3,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        transition: 'left 0.2s',
                      }} />
                    </div>
                  )}
                  {item.arrow && (
                    <span style={{ fontSize: 13, color: C.mutedFg }}>›</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <p style={{ textAlign: 'center', fontSize: 10, color: C.mutedFg, marginTop: 20, marginBottom: 8 }}>
        rubai · v1.0 · designed for execution
      </p>

      {/* Tab bar */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, width: 390, height: 82, background: C.card, borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center' }}>
        {[
          { icon: '☀', label: 'Today', active: false },
          { icon: '🗺', label: 'Roadmap', active: false },
          { icon: '💬', label: 'Coach', active: false },
          { icon: '🎯', label: 'Goals', active: false },
          { icon: '👤', label: 'Account', active: true },
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
