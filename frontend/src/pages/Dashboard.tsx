import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Project } from '../types/messages'
import { T, font, btn } from '../theme'

export default function Dashboard() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [backendOk, setBackendOk] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/projects/')
      .then(r => r.json())
      .then(data => { setProjects(data); setBackendOk(true) })
      .catch(() => { setError('無法連線後端 — FastAPI 是否在 port 8000 執行？'); setBackendOk(false) })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div style={st.page}>
      {/* ── Top nav ──────────────────────────────────────── */}
      <div style={st.nav}>
        <span style={st.logo}>NarrativeOS</span>
        <div style={{ flex: 1 }} />
        <button style={btn.ghost} onClick={() => navigate('/logs')}>📋 Logs</button>
      </div>

      {/* ── Main content ─────────────────────────────────── */}
      <div style={st.main}>
        {/* Hero */}
        <div style={st.hero}>
          <h1 style={st.heroTitle}>你的 AI 寫作助理</h1>
          <p style={st.heroSub}>知識圖譜 · 場景生成 · 一致性檢查</p>
        </div>

        {/* Bento grid */}
        <div style={st.bento}>

          {/* Projects card — spans 2 cols */}
          <div style={{ ...st.card, gridColumn: 'span 2' }}>
            <div style={st.cardHeader}>
              <span style={st.cardTitle}>專案</span>
              <span style={st.count}>{projects.length} 個</span>
            </div>

            {loading && <p style={st.muted}>載入中…</p>}
            {error   && <p style={st.errText}>{error}</p>}
            {!loading && !error && projects.length === 0 && (
              <p style={st.muted}>
                尚無專案。執行{' '}
                <code style={st.code}>python -m scripts.seed_test_data</code>{' '}
                建立測試資料。
              </p>
            )}

            <div style={st.projectGrid}>
              {projects.map(p => (
                <div
                  key={p.id}
                  style={st.projectCard}
                  onClick={() => navigate(`/workspace/${p.id}`)}
                >
                  <div style={st.projectIcon}>📖</div>
                  <div style={st.projectInfo}>
                    <div style={st.projectName}>{p.name}</div>
                    {p.description && <div style={st.projectDesc}>{p.description}</div>}
                    {p.genre && <span style={st.genreBadge}>{p.genre}</span>}
                  </div>
                  <div style={st.projectActions} onClick={e => e.stopPropagation()}>
                    <span
                      style={st.actionLink}
                      onClick={() => navigate(`/project/${p.id}/kg`)}
                    >KG</span>
                    <span
                      style={st.actionLink}
                      onClick={() => navigate(`/project/${p.id}/timeline`)}
                    >📅</span>
                    <a style={st.actionLink} href={`/api/projects/${p.id}/export?format=txt`} download>↓ TXT</a>
                    <a style={st.actionLink} href={`/api/projects/${p.id}/export?format=md`} download>↓ MD</a>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Status card */}
          <div style={st.card}>
            <div style={st.cardHeader}>
              <span style={st.cardTitle}>系統狀態</span>
            </div>
            <div style={st.statusList}>
              <StatusRow
                label="Backend"
                ok={backendOk}
                loading={loading}
              />
              <StatusRow label="Neo4j" ok={backendOk} loading={loading} />
            </div>
            <div style={st.version}>v0.8.0</div>
          </div>

          {/* Quick start card */}
          <div style={st.card}>
            <div style={st.cardHeader}>
              <span style={st.cardTitle}>快速開始</span>
            </div>
            <div style={st.steps}>
              <Step n="1" text="選擇或建立專案" />
              <Step n="2" text="在 KG 管理器新增角色與世界設定" />
              <Step n="3" text="進入 Workspace 與 AI 共同寫作" />
              <Step n="4" text="⚡ Check 確認場景一致性" />
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────

function StatusRow({ label, ok, loading }: { label: string; ok: boolean | null; loading: boolean }) {
  const color = loading ? T.textMuted : ok ? T.green : T.red
  const text  = loading ? '檢查中…' : ok ? '正常' : '無法連線'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0' }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontSize: font.sizes.sm, color: T.textSecondary, flex: 1 }}>{label}</span>
      <span style={{ fontSize: font.sizes.xs, color }}>{text}</span>
    </div>
  )
}

function Step({ n, text }: { n: string; text: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '5px 0' }}>
      <span style={{
        width: 20, height: 20, borderRadius: '50%',
        background: T.accentDim, border: `1px solid ${T.accentBorder}`,
        color: T.accent, fontSize: 10, fontWeight: 700,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>{n}</span>
      <span style={{ fontSize: font.sizes.sm, color: T.textSecondary, lineHeight: '1.5', paddingTop: 1 }}>{text}</span>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────
const st: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex', flexDirection: 'column', height: '100vh',
    background: T.bgBase, overflow: 'hidden',
  },
  nav: {
    height: 52, borderBottom: `1px solid ${T.border}`,
    display: 'flex', alignItems: 'center', padding: '0 28px', gap: 16, flexShrink: 0,
  },
  logo: {
    fontSize: font.sizes.base, fontWeight: 700,
    color: T.textPrimary, letterSpacing: '-0.2px',
  },
  main: {
    flex: 1, overflowY: 'auto', padding: '40px 28px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32,
  },
  hero: { textAlign: 'center', maxWidth: 500 },
  heroTitle: {
    fontSize: font.sizes['3xl'], fontWeight: 700, color: T.textPrimary,
    letterSpacing: '-0.5px', marginBottom: 8,
  },
  heroSub: { fontSize: font.sizes.base, color: T.textMuted },

  // Bento grid
  bento: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: 16, width: '100%', maxWidth: 860,
  },
  card: {
    background: T.bgElevated, border: `1px solid ${T.border}`,
    borderRadius: 12, padding: '20px 24px',
    display: 'flex', flexDirection: 'column', gap: 12,
  },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: font.sizes.base, fontWeight: 600, color: T.textPrimary, flex: 1 },
  count: { fontSize: font.sizes.xs, color: T.textMuted },

  // Project list inside card
  projectGrid: { display: 'flex', flexDirection: 'column', gap: 8 },
  projectCard: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 14px', borderRadius: 8,
    background: T.bgRaised, border: `1px solid ${T.border}`,
    cursor: 'pointer',
  },
  projectIcon: { fontSize: 22, flexShrink: 0 },
  projectInfo: { flex: 1, minWidth: 0 },
  projectName: {
    fontSize: font.sizes.md, fontWeight: 600, color: T.textPrimary,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  projectDesc: {
    fontSize: font.sizes.xs, color: T.textMuted, marginTop: 2,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  genreBadge: {
    fontSize: 10, color: T.green, background: T.greenDim,
    border: `1px solid #1f6b3a`, borderRadius: 99, padding: '1px 7px',
    marginTop: 4, display: 'inline-block',
  },
  projectActions: { display: 'flex', gap: 6, flexShrink: 0 },
  actionLink: {
    fontSize: font.sizes.xs, color: T.accent, background: T.accentDim,
    border: `1px solid ${T.accentBorder}`, borderRadius: 4,
    padding: '2px 8px', cursor: 'pointer', textDecoration: 'none',
  },

  // Status
  statusList: { display: 'flex', flexDirection: 'column' },
  version: { fontSize: font.sizes.xs, color: T.textMuted, marginTop: 'auto', fontFamily: 'monospace' },

  // Steps
  steps: { display: 'flex', flexDirection: 'column' },

  // Misc
  muted: { fontSize: font.sizes.sm, color: T.textMuted },
  errText: { fontSize: font.sizes.sm, color: T.red },
  code: {
    background: T.bgRaised, padding: '2px 6px', borderRadius: 4,
    fontFamily: 'monospace', fontSize: font.sizes.xs, color: T.green,
  },
}
