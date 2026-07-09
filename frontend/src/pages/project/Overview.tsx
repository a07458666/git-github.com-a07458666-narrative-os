/**
 * Overview — project home page inside ProjectShell.
 *
 * Shows: project meta, stat chips, recent chapters, quick-action cards.
 * Two API calls: GET /api/projects/:id  +  GET /api/projects/:id/chapters
 */

import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { T, font, btn } from '../../theme'
import type { CSSProperties } from 'react'

// ── Types ────────────────────────────────────────────────────

interface ProjectSummary {
  character_count: number
  active_thread_count: number
  location_count: number
  faction_count: number
}

interface Project {
  id: string; name: string; description: string; genre: string
  language: string; created_at: string
  summary?: ProjectSummary
}

interface Chapter {
  id: string; order: number; title: string; status: string
  narrative_function: string; word_count: number; act_id: string
  summary: string; outline: string
}

// ── Status helpers ────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  final: T.green, revised: T.yellow, draft: T.textMuted,
}

const STATUS_BG: Record<string, string> = {
  final: T.greenDim, revised: T.yellowDim, draft: T.bgOverlay,
}

const STATUS_LABEL: Record<string, string> = {
  final: '定稿', revised: '修訂', draft: '草稿',
}

// ── Sub-components ────────────────────────────────────────────

function StatChip({ icon, value, label }: { icon: string; value: number | string; label: string }) {
  return (
    <div style={ov.statChip}>
      <span style={ov.statIcon}>{icon}</span>
      <span style={ov.statValue}>{value}</span>
      <span style={ov.statLabel}>{label}</span>
    </div>
  )
}

function QuickCard({
  icon, title, desc, onClick,
}: {
  icon: string; title: string; desc: string; onClick: () => void
}) {
  return (
    <button style={ov.quickCard} onClick={onClick}>
      <span style={ov.quickIcon}>{icon}</span>
      <div style={{ textAlign: 'left' }}>
        <div style={ov.quickTitle}>{title}</div>
        <div style={ov.quickDesc}>{desc}</div>
      </div>
    </button>
  )
}

function ChapterRow({ chapter, onClick }: { chapter: Chapter; onClick: () => void }) {
  const sc = STATUS_COLOR[chapter.status] ?? T.textMuted
  const sb = STATUS_BG[chapter.status]   ?? T.bgOverlay
  const preview = chapter.summary || chapter.outline || ''

  return (
    <button style={ov.chapterRow} onClick={onClick}>
      <div style={ov.chapterOrder}>{chapter.order}</div>
      <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={ov.chapterTitle}>{chapter.title}</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: sc, background: sb, border: `1px solid ${sc}33`, borderRadius: 99, padding: '1px 7px' }}>
            {STATUS_LABEL[chapter.status] ?? chapter.status}
          </span>
          {chapter.narrative_function && (
            <span style={{ fontSize: 10, color: T.textMuted }}>·  {chapter.narrative_function}</span>
          )}
          {chapter.word_count > 0 && (
            <span style={{ fontSize: 10, color: T.textMuted }}>{chapter.word_count.toLocaleString()} 字</span>
          )}
        </div>
        {preview && (
          <div style={ov.chapterPreview}>{preview}</div>
        )}
      </div>
      <span style={ov.chapterArrow}>→</span>
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────

export default function Overview() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  const [project, setProject]   = useState<Project | null>(null)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true); setError(null)
    try {
      const [proj, chaps] = await Promise.all([
        fetch(`/api/projects/${projectId}`).then(r => { if (!r.ok) throw new Error(); return r.json() }),
        fetch(`/api/projects/${projectId}/chapters`).then(r => { if (!r.ok) throw new Error(); return r.json() }),
      ])
      setProject(proj)
      setChapters(chaps)
    } catch {
      setError('載入失敗，請確認後端連線')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { load() }, [load])

  const go = (path: string) => navigate(`/project/${projectId}/${path}`)

  // Derived stats
  const sortedChapters = [...chapters].sort((a, b) => b.order - a.order)
  const recentChapters = sortedChapters.slice(0, 8)
  const draftCount     = chapters.filter(c => c.status === 'draft').length
  const finalCount     = chapters.filter(c => c.status === 'final').length
  const totalWords     = chapters.reduce((acc, c) => acc + (c.word_count || 0), 0)
  const pct            = chapters.length > 0 ? Math.round((finalCount / chapters.length) * 100) : 0
  const lastChapter    = sortedChapters[0]

  const s = project?.summary

  if (loading) return <div style={ov.loading}>載入中…</div>
  if (error)   return <div style={ov.error}>{error}</div>
  if (!project) return null

  return (
    <div style={ov.page}>
      {/* ── Project header ─────────────────────────────── */}
      <div style={ov.header}>
        <div>
          <h1 style={ov.heroTitle}>{project.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
            {project.description && (
              <span style={ov.heroDesc}>{project.description}</span>
            )}
            {project.genre && (
              <span style={ov.genreBadge}>{project.genre}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btn.primary} onClick={() => go('write')}>
            ✏ {lastChapter ? `繼續第 ${lastChapter.order} 章` : '開始寫作'}
          </button>
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────── */}
      <div style={ov.statsRow}>
        <StatChip icon="📖" value={chapters.length} label="章節" />
        <StatChip icon="✏" value={totalWords.toLocaleString()} label="總字數" />
        <StatChip icon="🎭" value={s?.character_count ?? '—'} label="角色" />
        <StatChip icon="🌍" value={s?.location_count ?? '—'} label="地點" />
        <StatChip icon="🧵" value={s?.active_thread_count ?? '—'} label="活躍伏筆" />
        {chapters.length > 0 && (
          <StatChip icon="✅" value={`${pct}%`} label="定稿率" />
        )}
      </div>

      {/* ── Main grid ──────────────────────────────────── */}
      <div style={ov.grid}>
        {/* Left: Quick actions */}
        <div style={ov.card}>
          <div style={ov.cardTitle}>快速進入</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <QuickCard
              icon="✏"  title="寫作"
              desc={lastChapter ? `最近：第 ${lastChapter.order} 章《${lastChapter.title}》` : '開始你的第一個場景'}
              onClick={() => go('write')}
            />
            <QuickCard
              icon="📅" title="故事規劃"
              desc="章節時間軸、Arc 結構規劃"
              onClick={() => go('plan')}
            />
            <QuickCard
              icon="🌍" title="世界設定"
              desc={`角色、派系、地點、伏筆管理`}
              onClick={() => go('world')}
            />
            <QuickCard
              icon="🩺" title="故事健康度"
              desc="節奏分析、弧線進度、伏筆狀態"
              onClick={() => go('analyze')}
            />
          </div>
        </div>

        {/* Right: Recent chapters */}
        <div style={ov.card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span style={ov.cardTitle}>章節一覽</span>
            {chapters.length > 0 && (
              <span style={{ fontSize: font.sizes.xs, color: T.textMuted }}>
                {draftCount} 草稿 · {finalCount} 定稿
              </span>
            )}
          </div>

          {chapters.length === 0 ? (
            <div style={{ fontSize: font.sizes.sm, color: T.textMuted, padding: '20px 0' }}>
              尚無章節。前往「寫作」頁面建立第一章。
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {recentChapters.map(ch => (
                <ChapterRow
                  key={ch.id}
                  chapter={ch}
                  onClick={() => go('write')}
                />
              ))}
              {chapters.length > 8 && (
                <button style={{ ...btn.ghost, textAlign: 'left', marginTop: 4 }} onClick={() => go('plan')}>
                  查看全部 {chapters.length} 章 →
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────

const ov: Record<string, CSSProperties> = {
  page: {
    flex: 1, overflowY: 'auto',
    padding: '36px 40px',
    display: 'flex', flexDirection: 'column', gap: 24,
    maxWidth: 920, margin: '0 auto', width: '100%',
    boxSizing: 'border-box',
  },
  loading: { padding: 60, fontSize: font.sizes.base, color: T.textMuted, textAlign: 'center' },
  error:   { padding: 40, fontSize: font.sizes.sm, color: T.red, textAlign: 'center' },

  header: {
    display: 'flex', alignItems: 'flex-start',
    justifyContent: 'space-between', gap: 20,
  },
  heroTitle: {
    fontSize: font.sizes['2xl'], fontWeight: 700,
    color: T.textPrimary, letterSpacing: '-0.4px', margin: 0,
  },
  heroDesc: {
    fontSize: font.sizes.sm, color: T.textSecondary, lineHeight: '1.6',
  },
  genreBadge: {
    fontSize: 11, color: T.green, background: T.greenDim,
    border: `1px solid #1f6b3a`, borderRadius: 99, padding: '2px 10px',
  },

  statsRow: {
    display: 'flex', gap: 10, flexWrap: 'wrap',
  },
  statChip: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: T.bgElevated, border: `1px solid ${T.border}`,
    borderRadius: 8, padding: '8px 14px',
  },
  statIcon:  { fontSize: 14 },
  statValue: { fontSize: font.sizes.md, fontWeight: 700, color: T.textPrimary },
  statLabel: { fontSize: font.sizes.xs, color: T.textMuted },

  grid: {
    display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16,
  },
  card: {
    background: T.bgElevated, border: `1px solid ${T.border}`,
    borderRadius: 12, padding: '20px 22px',
  },
  cardTitle: {
    fontSize: font.sizes.xs, fontWeight: 700, color: T.textMuted,
    textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12,
  },

  quickCard: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: T.bgRaised, border: `1px solid ${T.border}`,
    borderRadius: 8, padding: '11px 14px',
    cursor: 'pointer', width: '100%', textAlign: 'left',
    fontFamily: "'Inter', system-ui, sans-serif",
    transition: 'border-color 0.15s, background 0.15s',
  },
  quickIcon:  { fontSize: 18, flexShrink: 0 },
  quickTitle: { fontSize: font.sizes.sm, fontWeight: 600, color: T.textPrimary, marginBottom: 1 },
  quickDesc:  { fontSize: font.sizes.xs, color: T.textMuted, lineHeight: '1.4' },

  chapterRow: {
    display: 'flex', alignItems: 'center', gap: 10,
    background: 'transparent', border: `1px solid ${T.border}`,
    borderRadius: 7, padding: '9px 12px',
    cursor: 'pointer', width: '100%',
    fontFamily: "'Inter', system-ui, sans-serif",
    transition: 'background 0.12s',
  },
  chapterOrder: {
    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
    background: T.bgOverlay, border: `1px solid ${T.border}`,
    color: T.textMuted, fontSize: 10, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  chapterTitle: {
    fontSize: font.sizes.sm, fontWeight: 600, color: T.textPrimary,
  },
  chapterPreview: {
    fontSize: font.sizes.xs, color: T.textMuted, marginTop: 2,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    maxWidth: 400,
  },
  chapterArrow: {
    fontSize: 12, color: T.textMuted, flexShrink: 0,
  },
}
