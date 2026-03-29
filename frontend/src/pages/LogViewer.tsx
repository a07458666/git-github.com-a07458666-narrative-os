/**
 * LogViewer — browse agent session logs.
 * Left: session list (newest first)
 * Right: entry timeline for the selected session
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface SessionSummary {
  session_id:      string
  entry_count:     number
  total_tokens:    number
  actions:         string[]
  first_timestamp: string
  file:            string
}

interface LogEntry {
  timestamp:        string
  session_id:       string
  action:           string
  tools_called:     string[]
  kg_nodes_accessed: string[]
  model_used:       string
  tokens_in:        number
  tokens_out:       number
  latency_ms:       number
  [key: string]:    unknown
}

interface SessionDetail {
  session_id:   string
  entries:      LogEntry[]
  total_tokens: number
}

// ── Action colour coding ──────────────────────────────────────
const ACTION_COLOR: Record<string, string> = {
  query_kg:           '#4a9eff',
  generation:         '#a855f7',
  kg_update:          '#4ade80',
  user_action:        '#fbbf24',
  consistency_check:  '#f97316',
}

function actionColor(action: string): string {
  return ACTION_COLOR[action] ?? '#555'
}

function formatTime(iso: string): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch { return iso }
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch { return iso }
}

// ── Sub-components ────────────────────────────────────────────

function EntryRow({ entry }: { entry: LogEntry }) {
  const [expanded, setExpanded] = useState(false)
  const color = actionColor(entry.action)

  // Collect extra fields (beyond the known ones)
  const known = new Set(['timestamp','session_id','action','tools_called','kg_nodes_accessed','model_used','tokens_in','tokens_out','latency_ms'])
  const extras = Object.entries(entry).filter(([k]) => !known.has(k))

  return (
    <div style={{ ...st.entryRow, borderLeftColor: color }}>
      <div style={st.entryHeader} onClick={() => setExpanded(v => !v)}>
        <span style={{ ...st.actionBadge, color, borderColor: color + '55' }}>{entry.action}</span>
        <span style={st.entryTime}>{formatTime(entry.timestamp)}</span>
        {entry.model_used && <span style={st.chip}>{entry.model_used.split('/').pop()}</span>}
        {entry.latency_ms > 0 && <span style={st.chip}>{entry.latency_ms}ms</span>}
        {(entry.tokens_in + entry.tokens_out) > 0 && (
          <span style={st.chip}>↑{entry.tokens_in} ↓{entry.tokens_out} tok</span>
        )}
        <span style={{ marginLeft: 'auto', color: '#555', fontSize: 11 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={st.entryDetail}>
          {entry.tools_called?.length > 0 && (
            <div style={st.detailRow}>
              <span style={st.detailLabel}>tools</span>
              <span style={st.detailVal}>{entry.tools_called.join(', ')}</span>
            </div>
          )}
          {entry.kg_nodes_accessed?.length > 0 && (
            <div style={st.detailRow}>
              <span style={st.detailLabel}>kg nodes</span>
              <span style={st.detailVal}>{entry.kg_nodes_accessed.slice(0, 8).join(', ')}{entry.kg_nodes_accessed.length > 8 ? ` +${entry.kg_nodes_accessed.length - 8}` : ''}</span>
            </div>
          )}
          {extras.map(([k, v]) => (
            <div key={k} style={st.detailRow}>
              <span style={st.detailLabel}>{k}</span>
              <span style={st.detailVal}>{typeof v === 'object' ? JSON.stringify(v) : String(v)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────
export default function LogViewer() {
  const navigate = useNavigate()
  const [sessions, setSessions]     = useState<SessionSummary[]>([])
  const [selected, setSelected]     = useState<string | null>(null)
  const [detail, setDetail]         = useState<SessionDetail | null>(null)
  const [loadingList, setLoadingList]   = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)

  useEffect(() => {
    fetch('/api/logs/')
      .then(r => r.json())
      .then(setSessions)
      .finally(() => setLoadingList(false))
  }, [])

  const selectSession = async (sid: string) => {
    setSelected(sid)
    setLoadingDetail(true)
    try {
      const data = await fetch(`/api/logs/${sid}`).then(r => r.json())
      setDetail(data)
    } finally {
      setLoadingDetail(false)
    }
  }

  const deleteSession = async (sid: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await fetch(`/api/logs/${sid}`, { method: 'DELETE' })
    setSessions(prev => prev.filter(s => s.session_id !== sid))
    if (selected === sid) { setSelected(null); setDetail(null) }
  }

  return (
    <div style={st.root}>
      {/* Top bar */}
      <div style={st.topBar}>
        <button style={st.backBtn} onClick={() => navigate('/')}>← Dashboard</button>
        <span style={st.title}>Agent Logs</span>
      </div>

      <div style={st.body}>
        {/* Session list */}
        <div style={st.sidebar}>
          {loadingList && <div style={st.muted}>Loading…</div>}
          {!loadingList && sessions.length === 0 && (
            <div style={st.muted}>No logs yet — run a session first.</div>
          )}
          {sessions.map(s => (
            <div
              key={s.session_id}
              style={{ ...st.sessionItem, ...(selected === s.session_id ? st.sessionActive : {}) }}
              onClick={() => selectSession(s.session_id)}
            >
              <div style={st.sessionId}>#{s.session_id}</div>
              <div style={st.sessionMeta}>
                {formatDate(s.first_timestamp)}
              </div>
              <div style={st.sessionStats}>
                <span style={st.chip}>{s.entry_count} entries</span>
                <span style={st.chip}>{s.total_tokens.toLocaleString()} tok</span>
              </div>
              <button style={st.delBtn} onClick={(e) => deleteSession(s.session_id, e)} title="Delete">✕</button>
            </div>
          ))}
        </div>

        {/* Detail panel */}
        <div style={st.detail}>
          {!selected && (
            <div style={st.emptyDetail}>← Select a session to view its log</div>
          )}
          {selected && loadingDetail && (
            <div style={st.muted}>Loading…</div>
          )}
          {selected && !loadingDetail && detail && (
            <>
              <div style={st.detailHeader}>
                <span style={{ color: '#ccc', fontSize: 13 }}>Session <code style={{ color: '#93c5fd' }}>#{detail.session_id}</code></span>
                <span style={st.chip}>{detail.entries.length} entries</span>
                <span style={st.chip}>{detail.total_tokens.toLocaleString()} total tokens</span>
              </div>
              <div style={st.entryList}>
                {detail.entries.map((entry, i) => (
                  <EntryRow key={i} entry={entry} />
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────
const st: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#0f0f0f', overflow: 'hidden' },
  topBar: {
    height: 44, background: '#0f0f0f', borderBottom: '1px solid #2a2a2a',
    display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12, flexShrink: 0,
  },
  backBtn: { background: 'transparent', border: 'none', color: '#555', cursor: 'pointer', fontSize: 13, padding: '4px 8px', borderRadius: 4 },
  title: { fontSize: 14, fontWeight: 600, color: '#ccc' },
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  sidebar: {
    width: 260, borderRight: '1px solid #1e1e1e', overflowY: 'auto',
    background: '#0a0a0a', padding: 8, flexShrink: 0,
    display: 'flex', flexDirection: 'column', gap: 4,
  },
  muted: { color: '#444', fontSize: 13, padding: '16px 12px' },
  sessionItem: {
    position: 'relative', padding: '10px 12px', borderRadius: 6, cursor: 'pointer',
    border: '1px solid #1e1e1e', background: '#111',
  },
  sessionActive: { border: '1px solid #2a4a6a', background: '#0f1f2f' },
  sessionId: { fontFamily: 'monospace', fontSize: 12, color: '#93c5fd', marginBottom: 2 },
  sessionMeta: { fontSize: 11, color: '#555', marginBottom: 4 },
  sessionStats: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  delBtn: {
    position: 'absolute', top: 6, right: 6, background: 'transparent',
    border: 'none', color: '#333', cursor: 'pointer', fontSize: 11, padding: '2px 4px',
  },
  detail: { flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 },
  emptyDetail: { margin: 'auto', color: '#333', fontSize: 14 },
  detailHeader: {
    display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
    paddingBottom: 12, borderBottom: '1px solid #1e1e1e', marginBottom: 4,
  },
  entryList: { display: 'flex', flexDirection: 'column', gap: 6 },
  entryRow: {
    borderLeft: '3px solid #555', paddingLeft: 10,
    background: '#111', borderRadius: '0 4px 4px 0',
  },
  entryHeader: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px',
    cursor: 'pointer',
  },
  actionBadge: {
    fontSize: 11, fontWeight: 700, border: '1px solid', borderRadius: 4,
    padding: '1px 6px', letterSpacing: '0.04em',
  },
  entryTime: { fontSize: 11, color: '#555', fontFamily: 'monospace' },
  chip: {
    fontSize: 10, color: '#666', background: '#1a1a1a',
    border: '1px solid #2a2a2a', borderRadius: 4, padding: '1px 6px',
  },
  entryDetail: {
    padding: '4px 8px 8px',
    display: 'flex', flexDirection: 'column', gap: 3,
  },
  detailRow: { display: 'flex', gap: 8, alignItems: 'baseline' },
  detailLabel: { fontSize: 10, color: '#555', width: 90, flexShrink: 0 },
  detailVal: { fontSize: 11, color: '#888', wordBreak: 'break-all' },
}
