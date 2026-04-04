/**
 * Timeline — vertical story-structure timeline.
 *
 * Shows chapters (and their scenes) grouped by StoryArc → Act when
 * arc structure exists; falls back to a flat ordered list otherwise.
 *
 * Per chapter: order number, title, status badge, narrative_function tag,
 *              AI summary (or outline fallback), tags, word count
 * Per scene:   POV character, location, emotional tone, tension bar,
 *              time_in_story
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { T, font, btn, badge } from '../theme'

// ── Types ────────────────────────────────────────────────────

interface Chapter {
  id: string
  order: number
  title: string
  status: string
  summary: string
  outline: string
  narrative_function: string
  tags: string[]
  pov_character: string
  emotional_goal: string
  act_id: string
  word_count: number
}

interface Scene {
  id: string
  chapter_id: string
  order: number
  pov_character: string
  location_id: string
  emotional_tone: string
  tension_level: number
  time_in_story: string
  summary: string
}

interface Arc  { id: string; name: string; theme: string; emotional_goal: string }
interface Act  { id: string; story_arc_id: string; order: number; name: string }
interface NameEntry { id: string; name: string }

interface TimelineData {
  chapters: Chapter[]
  scenes: Scene[]
  arcs: Arc[]
  acts: Act[]
  characters: NameEntry[]
  locations: NameEntry[]
}

// ── Visual helpers ───────────────────────────────────────────

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  final:   badge(T.green,  T.greenDim),
  revised: badge(T.yellow, T.yellowDim),
  draft:   badge(T.textMuted, T.bgOverlay),
}

const FUNC_STYLE: Record<string, React.CSSProperties> = {
  高潮: badge(T.red,    T.redDim),
  轉折: badge(T.yellow, T.yellowDim),
  鋪墊: badge(T.blue,   T.blueDim),
  解決: badge(T.green,  T.greenDim),
}

function tensionColor(v: number): string {
  if (v <= 3) return T.green
  if (v <= 6) return T.yellow
  return T.red
}

// ── Sub-components ───────────────────────────────────────────

function TensionBar({ level }: { level: number }) {
  const pct = Math.min(Math.max(level, 0), 10) * 10
  const color = tensionColor(level)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
      <div style={{ flex: 1, height: 4, background: T.bgRaised, borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: 10, color, fontWeight: 600, minWidth: 12 }}>{level}</span>
    </div>
  )
}

function SceneCard({ scene, locMap, charMap }: {
  scene: Scene
  locMap: Map<string, string>
  charMap: Map<string, string>
}) {
  const locName  = scene.location_id  ? (locMap.get(scene.location_id)  ?? scene.location_id)  : ''
  const charName = scene.pov_character
    ? (charMap.get(scene.pov_character) ?? scene.pov_character)
    : ''

  return (
    <div style={sc.sceneCard}>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 4 }}>
        {charName && (
          <span style={sc.chip}>👤 {charName}</span>
        )}
        {locName && (
          <span style={sc.chip}>📍 {locName}</span>
        )}
        {scene.emotional_tone && (
          <span style={{ ...sc.chip, color: T.textSecondary }}>{scene.emotional_tone}</span>
        )}
        {scene.time_in_story && (
          <span style={{ ...sc.chip, color: T.accent }}>🕐 {scene.time_in_story}</span>
        )}
      </div>
      {scene.summary && (
        <div style={{ fontSize: font.sizes.xs, color: T.textMuted, lineHeight: 1.5, marginBottom: 4 }}>
          {scene.summary}
        </div>
      )}
      <TensionBar level={scene.tension_level} />
    </div>
  )
}

function ChapterCard({ chapter, scenes, locMap, charMap }: {
  chapter: Chapter
  scenes: Scene[]
  locMap: Map<string, string>
  charMap: Map<string, string>
}) {
  const [expanded, setExpanded] = useState(true)
  const statusStyle = STATUS_STYLE[chapter.status] ?? STATUS_STYLE.draft
  const funcStyle   = chapter.narrative_function ? (FUNC_STYLE[chapter.narrative_function] ?? null) : null
  const bodyText    = chapter.summary || chapter.outline || ''

  return (
    <div style={sc.chapterCard}>
      {/* Header row */}
      <div style={sc.chapterHeader} onClick={() => setExpanded(e => !e)}>
        <div style={sc.orderBadge}>{chapter.order}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={sc.chapterTitle}>{chapter.title}</span>
            <span style={statusStyle}>{chapter.status.toUpperCase()}</span>
            {funcStyle && <span style={funcStyle}>{chapter.narrative_function}</span>}
            {chapter.word_count > 0 && (
              <span style={sc.wordCount}>{chapter.word_count.toLocaleString()} 字</span>
            )}
          </div>
          {chapter.emotional_goal && (
            <div style={{ fontSize: font.sizes.xs, color: T.textMuted, marginTop: 2 }}>
              情感目標：{chapter.emotional_goal}
            </div>
          )}
        </div>
        <span style={{ color: T.textMuted, fontSize: 12, flexShrink: 0 }}>
          {expanded ? '▲' : '▼'} {scenes.length} 場景
        </span>
      </div>

      {/* Summary / outline */}
      {bodyText && (
        <div style={sc.summary}>{bodyText}</div>
      )}

      {/* Tags */}
      {chapter.tags?.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
          {chapter.tags.map(t => (
            <span key={t} style={sc.tag}>{t}</span>
          ))}
        </div>
      )}

      {/* Scenes */}
      {expanded && scenes.length > 0 && (
        <div style={sc.sceneGrid}>
          {scenes.map(s => (
            <SceneCard key={s.id} scene={s} locMap={locMap} charMap={charMap} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────

export default function Timeline() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  const [data, setData]       = useState<TimelineData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')

  // Build lookup maps
  const locMap  = new Map((data?.locations  ?? []).map(e => [e.id, e.name]))
  const charMap = new Map<string, string>()
  ;(data?.characters ?? []).forEach(c => {
    charMap.set(c.id, c.name)
    charMap.set(c.name, c.name)   // also index by name (for pov_character stored as name)
  })

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    try {
      const [proj, tl] = await Promise.all([
        fetch(`/api/projects/${projectId}`).then(r => { if (!r.ok) throw new Error(); return r.json() }),
        fetch(`/api/projects/${projectId}/timeline`).then(r => { if (!r.ok) throw new Error(); return r.json() }),
      ])
      setProjectName(proj.name ?? '')
      setData(tl)
    } catch {
      setError('載入失敗，請確認後端連線')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { load() }, [load])

  // ── Group chapters ────────────────────────────────────────
  const renderContent = () => {
    if (!data) return null
    const { chapters, scenes, arcs, acts } = data

    if (chapters.length === 0) {
      return (
        <div style={sc.empty}>
          尚無章節資料。<br />請先在 Workspace 建立章節與場景。
        </div>
      )
    }

    const scenesByChapter = new Map<string, Scene[]>()
    scenes.forEach(s => {
      const list = scenesByChapter.get(s.chapter_id) ?? []
      list.push(s)
      scenesByChapter.set(s.chapter_id, list)
    })

    const actMap  = new Map(acts.map(a => [a.id, a]))

    // Group: arc → act → chapter
    if (arcs.length > 0) {
      // chapters that have arc assignment via act
      const actsByArc = new Map<string, Act[]>()
      acts.forEach(a => {
        const list = actsByArc.get(a.story_arc_id) ?? []
        list.push(a)
        actsByArc.set(a.story_arc_id, list)
      })
      const chaptersByAct = new Map<string, Chapter[]>()
      const unassigned: Chapter[] = []
      chapters.forEach(ch => {
        if (ch.act_id && actMap.has(ch.act_id)) {
          const list = chaptersByAct.get(ch.act_id) ?? []
          list.push(ch)
          chaptersByAct.set(ch.act_id, list)
        } else {
          unassigned.push(ch)
        }
      })

      return (
        <>
          {arcs.map(arc => (
            <div key={arc.id} style={sc.arcSection}>
              <div style={sc.arcHeader}>
                <span style={sc.arcDot} />
                <span style={sc.arcName}>{arc.name}</span>
                {arc.theme && <span style={sc.arcTheme}>{arc.theme}</span>}
              </div>
              {(actsByArc.get(arc.id) ?? []).map(act => (
                <div key={act.id} style={sc.actSection}>
                  <div style={sc.actHeader}>第 {act.order} 幕 · {act.name}</div>
                  <div style={sc.spine}>
                    {(chaptersByAct.get(act.id) ?? []).map(ch => (
                      <ChapterCard
                        key={ch.id}
                        chapter={ch}
                        scenes={scenesByChapter.get(ch.id) ?? []}
                        locMap={locMap}
                        charMap={charMap}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
          {unassigned.length > 0 && (
            <div style={sc.arcSection}>
              <div style={sc.arcHeader}>
                <span style={sc.arcDot} />
                <span style={{ ...sc.arcName, color: T.textMuted }}>未分配章節</span>
              </div>
              <div style={sc.spine}>
                {unassigned.map(ch => (
                  <ChapterCard
                    key={ch.id}
                    chapter={ch}
                    scenes={scenesByChapter.get(ch.id) ?? []}
                    locMap={locMap}
                    charMap={charMap}
                  />
                ))}
              </div>
            </div>
          )}
        </>
      )
    }

    // Flat list (no arcs)
    return (
      <div style={sc.spine}>
        {chapters.map(ch => (
          <ChapterCard
            key={ch.id}
            chapter={ch}
            scenes={scenesByChapter.get(ch.id) ?? []}
            locMap={locMap}
            charMap={charMap}
          />
        ))}
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────
  const chapterCount = data?.chapters.length ?? 0
  const sceneCount   = data?.scenes.length ?? 0

  return (
    <div style={sc.page}>
      {/* Toolbar */}
      <div style={sc.toolbar}>
        <button style={btn.ghost} onClick={() => navigate(`/project/${projectId}/kg`)}>← KG</button>
        <button style={btn.ghost} onClick={() => navigate(`/workspace/${projectId}`)}>✏ Workspace</button>
        <div style={sc.sep} />
        <span style={sc.title}>📅 故事時間軸</span>
        {projectName && <span style={sc.projName}>{projectName}</span>}
        <div style={{ flex: 1 }} />
        {data && (
          <span style={sc.stat}>
            {chapterCount} 章節 · {sceneCount} 場景
            {data.arcs.length > 0 && ` · ${data.arcs.length} 故事弧`}
          </span>
        )}
        <button style={btn.secondary} onClick={load} disabled={loading}>
          {loading ? '載入中…' : '↺ 重新整理'}
        </button>
      </div>

      {/* Body */}
      <div style={sc.body}>
        {error && (
          <div style={sc.errorBox}>{error}</div>
        )}
        {!error && loading && (
          <div style={sc.empty}>載入中…</div>
        )}
        {!error && !loading && renderContent()}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────

const sc: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex', flexDirection: 'column', height: '100vh',
    background: T.bgBase, fontFamily: "'Inter', system-ui, sans-serif", overflow: 'hidden',
  },
  toolbar: {
    height: 48, borderBottom: `1px solid ${T.border}`,
    display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10,
    flexShrink: 0, background: T.bgElevated,
  },
  sep: { width: 1, height: 20, background: T.border },
  title: { fontSize: font.sizes.base, fontWeight: 700, color: T.textPrimary },
  projName: { fontSize: font.sizes.sm, color: T.textMuted },
  stat: { fontSize: font.sizes.xs, color: T.textMuted },

  body: {
    flex: 1, overflowY: 'auto',
    padding: '28px 40px',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
  },
  empty: {
    marginTop: 80, fontSize: font.sizes.base, color: T.textMuted,
    textAlign: 'center', lineHeight: 2,
  },
  errorBox: {
    marginTop: 40, padding: '12px 20px',
    background: T.redDim, border: `1px solid ${T.red}44`,
    borderRadius: 8, color: T.red, fontSize: font.sizes.sm,
  },

  // Arc grouping
  arcSection: {
    width: '100%', maxWidth: 820, marginBottom: 40,
  },
  arcHeader: {
    display: 'flex', alignItems: 'center', gap: 10,
    marginBottom: 16,
  },
  arcDot: {
    width: 10, height: 10, borderRadius: '50%',
    background: '#e879f9', flexShrink: 0,
  },
  arcName: {
    fontSize: font.sizes.lg, fontWeight: 700, color: T.textPrimary,
  },
  arcTheme: {
    fontSize: font.sizes.sm, color: T.textMuted,
    background: T.bgRaised, border: `1px solid ${T.border}`,
    borderRadius: 99, padding: '2px 10px',
  },

  actSection: { marginLeft: 24, marginBottom: 24 },
  actHeader: {
    fontSize: font.sizes.sm, fontWeight: 600,
    color: '#c084fc', marginBottom: 10,
    paddingLeft: 14, borderLeft: `2px solid #c084fc44`,
  },

  // Vertical spine
  spine: {
    width: '100%', maxWidth: 820,
    display: 'flex', flexDirection: 'column', gap: 0,
    borderLeft: `2px solid ${T.border}`,
    paddingLeft: 24,
    marginBottom: 32,
  },

  // Chapter card
  chapterCard: {
    position: 'relative',
    background: T.bgElevated, border: `1px solid ${T.border}`,
    borderRadius: 10, padding: '14px 18px',
    marginBottom: 14, cursor: 'default',
  },
  chapterHeader: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    cursor: 'pointer',
  },
  orderBadge: {
    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
    background: T.accentDim, border: `1px solid ${T.accentBorder}`,
    color: T.accent, fontSize: font.sizes.xs, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  chapterTitle: {
    fontSize: font.sizes.md, fontWeight: 600, color: T.textPrimary,
  },
  wordCount: {
    fontSize: font.sizes.xs, color: T.textMuted,
  },
  summary: {
    marginTop: 8, fontSize: font.sizes.sm, color: T.textSecondary,
    lineHeight: 1.6, paddingLeft: 38,
  },
  tag: {
    fontSize: 10, color: T.accent, background: T.accentDim,
    border: `1px solid ${T.accentBorder}44`, borderRadius: 99,
    padding: '1px 8px', marginLeft: 38,
  },

  // Scene grid
  sceneGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: 8, marginTop: 12, paddingLeft: 38,
  },
  sceneCard: {
    background: T.bgRaised, border: `1px solid ${T.border}`,
    borderRadius: 6, padding: '10px 12px',
  },
  chip: {
    fontSize: 10, color: T.textSecondary, background: T.bgOverlay,
    borderRadius: 99, padding: '2px 8px',
  },
}
