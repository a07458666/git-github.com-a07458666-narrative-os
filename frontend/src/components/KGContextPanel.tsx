/**
 * KGContextPanel — read-only KG reference panel (VS Code sidebar style).
 * Entities are shown as clickable tags. Click → inject @name into Director.
 */
import { useEffect, useState } from 'react'
import { T, font } from '../theme'

export type KGPanelTab = 'chars' | 'world' | 'plot'

interface Props {
  projectId: string
  tab: KGPanelTab
  onInject: (text: string) => void
}

interface Entity { id: string; name: string; [key: string]: string }

// ── Tag chip ──────────────────────────────────────────────────
function Tag({
  label, icon, color, onClick,
}: {
  label: string
  icon?: string
  color?: string
  onClick: () => void
}) {
  const [flash, setFlash] = useState(false)

  const handleClick = () => {
    onClick()
    setFlash(true)
    setTimeout(() => setFlash(false), 400)
  }

  return (
    <button
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '4px 10px', borderRadius: 99, cursor: 'pointer',
        fontSize: font.sizes.xs, fontWeight: 500,
        background: flash ? T.accentDim : T.bgRaised,
        border: `1px solid ${flash ? T.accent : (color ?? T.border)}`,
        color: flash ? T.accent : (color ?? T.textSecondary),
        transition: 'background 0.2s, border-color 0.2s, color 0.2s',
        fontFamily: 'inherit',
        whiteSpace: 'nowrap' as const,
      }}
      title={`點擊引用 @${label}`}
      onClick={handleClick}
    >
      {icon && <span style={{ fontSize: 11 }}>{icon}</span>}
      {label}
    </button>
  )
}

// ── Section ───────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={st.sectionLabel}>{title}</div>
      <div style={st.tagCloud}>{children}</div>
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────
export default function KGContextPanel({ projectId, tab, onInject }: Props) {
  const [chars, setChars]         = useState<Entity[]>([])
  const [factions, setFactions]   = useState<Entity[]>([])
  const [locations, setLocations] = useState<Entity[]>([])
  const [threads, setThreads]     = useState<Entity[]>([])
  const [loading, setLoading]     = useState(false)

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    const base = `/api/projects/${projectId}/kg`
    const fetches: Promise<void>[] = []

    if (tab === 'chars') {
      fetches.push(fetch(`${base}/characters`).then(r => r.json()).then(setChars))
    } else if (tab === 'world') {
      fetches.push(
        fetch(`${base}/factions`).then(r => r.json()).then(setFactions),
        fetch(`${base}/locations`).then(r => r.json()).then(setLocations),
      )
    } else if (tab === 'plot') {
      fetches.push(fetch(`${base}/threads`).then(r => r.json()).then(setThreads))
    }

    Promise.all(fetches).finally(() => setLoading(false))
  }, [projectId, tab])

  const title = tab === 'chars' ? '👤 角色' : tab === 'world' ? '🌍 世界' : '📖 伏筆'

  const inject = (name: string) => onInject(`@${name}`)

  return (
    <div style={st.panel}>
      <div style={st.header}>
        <span style={st.headerTitle}>{title}</span>
        {loading && <span style={{ fontSize: 10, color: T.textMuted }}>載入中…</span>}
      </div>

      <div style={st.hint}>點擊 tag 將名稱帶入 Director</div>

      <div style={st.body}>
        {tab === 'chars' && (
          chars.length === 0 && !loading
            ? <Empty />
            : <Section title="角色">
                {chars.map(c => (
                  <Tag key={c.id} label={c.name} icon="👤"
                    color={T.blue} onClick={() => inject(c.name)} />
                ))}
              </Section>
        )}

        {tab === 'world' && (
          factions.length === 0 && locations.length === 0 && !loading
            ? <Empty />
            : <>
                {factions.length > 0 && (
                  <Section title="派系">
                    {factions.map(f => (
                      <Tag key={f.id} label={f.name} icon="⚔️"
                        color={T.yellow} onClick={() => inject(f.name)} />
                    ))}
                  </Section>
                )}
                {locations.length > 0 && (
                  <Section title="地點">
                    {locations.map(l => (
                      <Tag key={l.id} label={l.name} icon="📍"
                        color={T.green} onClick={() => inject(l.name)} />
                    ))}
                  </Section>
                )}
              </>
        )}

        {tab === 'plot' && (
          threads.length === 0 && !loading
            ? <Empty />
            : <Section title="伏筆">
                {threads.map(t => (
                  <Tag key={t.id} label={t.name} icon="📖"
                    color={t.status === 'active' ? T.yellow : t.status === 'resolved' ? T.green : T.textMuted}
                    onClick={() => inject(t.name)} />
                ))}
              </Section>
        )}
      </div>
    </div>
  )
}

function Empty() {
  return <div style={{ fontSize: font.sizes.sm, color: T.textMuted, padding: '12px 0' }}>尚無資料</div>
}

// ── Styles ────────────────────────────────────────────────────
const st: Record<string, React.CSSProperties> = {
  panel: {
    width: 220, borderRight: `1px solid ${T.border}`,
    background: T.bgElevated, display: 'flex', flexDirection: 'column',
    overflow: 'hidden', flexShrink: 0,
  },
  header: {
    padding: '11px 14px', borderBottom: `1px solid ${T.border}`,
    display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
  },
  headerTitle: {
    fontSize: font.sizes.xs, fontWeight: 700, color: T.textSecondary,
    textTransform: 'uppercase', letterSpacing: '0.07em', flex: 1,
  },
  hint: {
    padding: '5px 14px', borderBottom: `1px solid ${T.border}`,
    fontSize: 10, color: T.textMuted, flexShrink: 0,
  },
  body: { flex: 1, overflowY: 'auto', padding: '14px 12px' },
  sectionLabel: {
    fontSize: 10, fontWeight: 700, color: T.textMuted,
    textTransform: 'uppercase', letterSpacing: '0.08em',
    marginBottom: 8,
  },
  tagCloud: { display: 'flex', flexWrap: 'wrap', gap: 6 },
}
