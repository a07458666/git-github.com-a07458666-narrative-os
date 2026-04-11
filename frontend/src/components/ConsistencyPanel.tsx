/**
 * ConsistencyPanel — displays consistency issues returned by the backend.
 * Shown below the editor when the author clicks "⚡ Check".
 */

interface Issue {
  type:        string   // character | relationship | location | plot | faction | artifact
  severity:    string   // warning | error
  entity:      string
  description: string
  suggestion:  string
}

interface Props {
  issues:   Issue[]
  loading:  boolean
  error?:   string | null
  onDismiss: () => void
}

const TYPE_ICON: Record<string, string> = {
  character:    '👤',
  relationship: '🤝',
  location:     '📍',
  plot:         '📖',
  faction:      '⚔️',
  artifact:     '💎',
}

const SEV_COLOR: Record<string, string> = {
  error:   '#f87171',
  warning: '#fbbf24',
}

export default function ConsistencyPanel({ issues, loading, error, onDismiss }: Props) {
  if (!loading && error) {
    return (
      <div style={st.wrap}>
        <div style={st.header}>
          <span style={st.title}>⚡ 一致性檢查</span>
          <button style={st.close} onClick={onDismiss}>✕</button>
        </div>
        <div style={st.errMsg}>⚠ {error}</div>
      </div>
    )
  }

  if (!loading && issues.length === 0) {
    return (
      <div style={st.wrap}>
        <div style={st.header}>
          <span style={st.title}>⚡ 一致性檢查</span>
          <button style={st.close} onClick={onDismiss}>✕</button>
        </div>
        <div style={st.ok}>✓ 沒有發現一致性問題</div>
      </div>
    )
  }

  return (
    <div style={st.wrap}>
      <div style={st.header}>
        <span style={st.title}>
          ⚡ 一致性檢查
          {!loading && (
            <span style={{ ...st.badge, background: issues.some(i => i.severity === 'error') ? '#7f1d1d' : '#78350f' }}>
              {issues.length} 項
            </span>
          )}
        </span>
        <button style={st.close} onClick={onDismiss}>✕</button>
      </div>

      {loading ? (
        <div style={st.ok}>檢查中…</div>
      ) : (
        <div style={st.list}>
          {issues.map((issue, idx) => (
            <div key={idx} style={{ ...st.card, borderLeftColor: SEV_COLOR[issue.severity] ?? '#555' }}>
              <div style={st.cardHeader}>
                <span style={st.typeTag}>
                  {TYPE_ICON[issue.type] ?? '⚠️'} {issue.type}
                </span>
                <span style={{ ...st.sev, color: SEV_COLOR[issue.severity] ?? '#888' }}>
                  {issue.severity}
                </span>
                <span style={st.entity}>{issue.entity}</span>
              </div>
              <div style={st.desc}>{issue.description}</div>
              {issue.suggestion && (
                <div style={st.suggestion}>
                  <span style={{ color: '#6ee7b7', marginRight: 4 }}>→</span>
                  {issue.suggestion}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const st: Record<string, React.CSSProperties> = {
  wrap: {
    background: '#111', borderTop: '1px solid #2a2a2a',
    flexShrink: 0, maxHeight: 320, display: 'flex', flexDirection: 'column',
  },
  header: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '6px 14px', borderBottom: '1px solid #1f1f1f', flexShrink: 0,
  },
  title: { fontSize: 12, fontWeight: 600, color: '#aaa', display: 'flex', alignItems: 'center', gap: 6 },
  badge: {
    fontSize: 10, padding: '1px 6px', borderRadius: 10, color: '#fcd34d', fontWeight: 700,
  },
  close: {
    marginLeft: 'auto', background: 'transparent', border: 'none',
    color: '#555', cursor: 'pointer', fontSize: 13, padding: '2px 6px',
  },
  ok:     { padding: '16px 14px', color: '#4ade80', fontSize: 13 },
  errMsg: { padding: '16px 14px', color: '#f87171', fontSize: 13 },
  list: { overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 },
  card: {
    borderLeft: '3px solid #555', paddingLeft: 10, paddingTop: 6, paddingBottom: 6,
    background: '#161616', borderRadius: '0 4px 4px 0',
  },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 },
  typeTag: { fontSize: 10, color: '#888' },
  sev:     { fontSize: 10, fontWeight: 700, textTransform: 'uppercase' as const },
  entity:  { fontSize: 12, color: '#d1d5db', fontWeight: 600 },
  desc:    { fontSize: 12, color: '#9ca3af', lineHeight: 1.5 },
  suggestion: { fontSize: 11, color: '#9ca3af', marginTop: 4, fontStyle: 'italic' },
}
