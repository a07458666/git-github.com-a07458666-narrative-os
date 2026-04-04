/**
 * ChapterTree — Week 6+ with theme tokens
 * - Expandable chapters with scenes
 * - Inline chapter editing (title / outline / tags / pov / status)
 * - Tag chips display
 * - Scene delete
 * - Refreshes scene list when savedSignal changes (new scene saved)
 */

import { useEffect, useRef, useState } from 'react'
import { useSessionStore } from '../store/sessionStore'
import { T, font, btn, inp } from '../theme'

interface Chapter {
  id: string
  title: string
  order: number
  act_id?: string
  status?: string
  pov_character?: string
  outline?: string
  summary?: string
  tags?: string[]
}

interface Scene {
  id: string
  order: number
  summary?: string
  content?: string
  emotional_tone?: string
}

interface Arc { id: string; name: string }
interface Act { id: string; story_arc_id: string; order: number; name: string }

interface Props {
  projectId: string
  onSelectChapter?: (chapterId: string) => void
}

const STATUS_OPTIONS = ['draft', 'revised', 'final']

export default function ChapterTree({ projectId, onSelectChapter }: Props) {
  const [chapters, setChapters]     = useState<Chapter[]>([])
  const [scenes, setScenes]         = useState<Record<string, Scene[]>>({})
  const [expanded, setExpanded]     = useState<Set<string>>(new Set())
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [draft, setDraft]           = useState({ title: '', outline: '', tags: '', pov_character: '', status: 'draft', act_id: '' })
  const [saving, setSaving]         = useState(false)
  const [showNewForm, setShowNewForm] = useState(false)
  const [newTitle, setNewTitle]     = useState('')
  const [creating, setCreating]     = useState(false)
  const [loadError, setLoadError]   = useState<string | null>(null)
  const [sceneErrors, setSceneErrors] = useState<Record<string, string>>({})
  const [summaryLoading, setSummaryLoading] = useState<Record<string, boolean>>({})
  const [arcs, setArcs]             = useState<Arc[]>([])
  const [acts, setActs]             = useState<Act[]>([])  // flattened all acts across arcs
  const newTitleRef                 = useRef<HTMLInputElement>(null)

  const { currentChapterId, currentSceneId, savedSignal,
          setCurrentSceneId, setCurrentChapterId, setEditorContent } = useSessionStore()

  // ── Load chapters + arcs/acts ─────────────────────────────
  const loadChapters = () => {
    setLoadError(null)
    return fetch(`/api/projects/${projectId}/chapters`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(data => { if (Array.isArray(data)) setChapters(data.sort((a, b) => a.order - b.order)) })
      .catch(() => setLoadError('章節載入失敗'))
  }

  const loadArcsAndActs = async () => {
    try {
      const arcData = await fetch(`/api/projects/${projectId}/arcs`).then(r => r.json())
      if (!Array.isArray(arcData)) return
      setArcs(arcData)
      const allActs: Act[] = []
      await Promise.all(
        arcData.map((arc: Arc) =>
          fetch(`/api/projects/${projectId}/arcs/${arc.id}/acts`)
            .then(r => r.json())
            .then((a: Act[]) => { if (Array.isArray(a)) allActs.push(...a) })
            .catch(() => {})
        )
      )
      setActs(allActs.sort((a, b) => a.order - b.order))
    } catch {/* ignore */}
  }

  useEffect(() => { loadChapters(); loadArcsAndActs() }, [projectId]) // eslint-disable-line

  // ── When a scene is saved, reload scenes for current chapter ─
  useEffect(() => {
    if (!savedSignal || !currentChapterId) return
    loadScenesFor(currentChapterId)
  }, [savedSignal]) // eslint-disable-line

  // ── Load scenes for a chapter ─────────────────────────────
  const loadScenesFor = async (chapterId: string) => {
    setSceneErrors(prev => { const next = { ...prev }; delete next[chapterId]; return next })
    try {
      const r = await fetch(`/api/chapters/${chapterId}/scenes`)
      if (!r.ok) throw new Error()
      const data = await r.json()
      if (Array.isArray(data))
        setScenes(prev => ({ ...prev, [chapterId]: data.sort((a: Scene, b: Scene) => a.order - b.order) }))
    } catch {
      setSceneErrors(prev => ({ ...prev, [chapterId]: '場景載入失敗' }))
    }
  }

  // ── Toggle expansion ──────────────────────────────────────
  const toggleChapter = (ch: Chapter) => {
    const next = new Set(expanded)
    if (next.has(ch.id)) {
      next.delete(ch.id)
    } else {
      next.add(ch.id)
      if (!scenes[ch.id]) loadScenesFor(ch.id)
    }
    setExpanded(next)
    setCurrentChapterId(ch.id)
    onSelectChapter?.(ch.id)
  }

  // ── Start editing ─────────────────────────────────────────
  const startEdit = (e: React.MouseEvent, ch: Chapter) => {
    e.stopPropagation()
    setEditingId(ch.id)
    setDraft({
      title:         ch.title,
      outline:       ch.outline ?? '',
      tags:          (ch.tags ?? []).join(', '),
      pov_character: ch.pov_character ?? '',
      status:        ch.status ?? 'draft',
      act_id:        ch.act_id ?? '',
    })
  }

  const cancelEdit = () => { setEditingId(null) }

  const saveEdit = async (chapterId: string) => {
    setSaving(true)
    try {
      const body = {
        title:         draft.title.trim() || undefined,
        outline:       draft.outline,
        tags:          draft.tags.split(',').map(t => t.trim()).filter(Boolean),
        pov_character: draft.pov_character,
        status:        draft.status,
        act_id:        draft.act_id || '',
      }
      const res = await fetch(`/api/projects/${projectId}/chapters/${chapterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setEditingId(null)
        loadChapters()
      }
    } catch {/* ignore */} finally { setSaving(false) }
  }

  // ── Load scene into editor ────────────────────────────────
  const loadScene = (sc: Scene, chapterId: string) => {
    setCurrentSceneId(sc.id)
    setCurrentChapterId(chapterId)
    setEditorContent(sc.content ?? '')
    onSelectChapter?.(chapterId)
  }

  // ── Delete scene ──────────────────────────────────────────
  const deleteScene = async (e: React.MouseEvent, sc: Scene, chapterId: string) => {
    e.stopPropagation()
    if (!window.confirm(`刪除場景 #${sc.order}？`)) return
    try {
      await fetch(`/api/scenes/${sc.id}`, { method: 'DELETE' })
      if (currentSceneId === sc.id) { setCurrentSceneId(null); setEditorContent('') }
      loadScenesFor(chapterId)
    } catch {/* ignore */}
  }

  // ── Create chapter ────────────────────────────────────────
  const handleCreate = async () => {
    if (!newTitle.trim()) return
    setCreating(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/chapters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, order: chapters.length + 1 }),
      })
      if (res.ok) { setNewTitle(''); setShowNewForm(false); loadChapters() }
    } catch {/* ignore */} finally { setCreating(false) }
  }

  // ── Generate AI summary ───────────────────────────────────
  const generateSummary = async (e: React.MouseEvent, ch: Chapter) => {
    e.stopPropagation()
    setSummaryLoading(prev => ({ ...prev, [ch.id]: true }))
    try {
      const res = await fetch(`/api/projects/${projectId}/chapters/${ch.id}/summary`, { method: 'POST' })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setChapters(prev => prev.map(c => c.id === ch.id ? { ...c, summary: data.summary } : c))
    } catch {
      // leave existing summary intact on error; user can retry
    } finally {
      setSummaryLoading(prev => ({ ...prev, [ch.id]: false }))
    }
  }

  useEffect(() => { if (showNewForm) newTitleRef.current?.focus() }, [showNewForm])

  // ── Shared chapter row renderer ───────────────────────────
  const renderChapter = (ch: Chapter) => {
    const isActive  = ch.id === currentChapterId
    const isOpen    = expanded.has(ch.id)
    const isEditing = editingId === ch.id
    const chScenes  = scenes[ch.id] ?? []
    const tags      = ch.tags ?? []
    return (
      <div key={ch.id}>
        <div
          style={{
            ...st.chRow,
            background: isActive ? T.accentDim : 'transparent',
            borderLeft: `2px solid ${isActive ? T.accent : 'transparent'}`,
          }}
          onClick={() => toggleChapter(ch)}
        >
          <span style={st.chevron}>{isOpen ? '▾' : '▸'}</span>
          <span style={st.order}>Ch.{ch.order}</span>
          <span style={{ ...st.chTitle, color: isActive ? T.accent : T.textSecondary }} title={ch.title}>
            {ch.title}
          </span>
          {ch.status && ch.status !== 'draft' && (
            <span style={{ ...st.statusBadge, color: ch.status === 'final' ? T.green : T.yellow }}>
              {ch.status}
            </span>
          )}
          <button style={st.editIcon} onClick={e => startEdit(e, ch)} title="編輯章節">✎</button>
          <button
            style={{ ...st.editIcon, opacity: summaryLoading[ch.id] ? 0.4 : 0.6 }}
            onClick={e => generateSummary(e, ch)}
            disabled={summaryLoading[ch.id]}
            title="AI 生成摘要"
          >{summaryLoading[ch.id] ? '…' : '✦'}</button>
        </div>

        {isEditing && (
          <div style={st.editForm} onClick={e => e.stopPropagation()}>
            <input style={{ ...inp, marginBottom: 6 }} value={draft.title} autoFocus
              onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} placeholder="章節標題" />
            <textarea style={{ ...inp, resize: 'vertical', minHeight: 60, marginBottom: 6 }}
              value={draft.outline} rows={3}
              onChange={e => setDraft(d => ({ ...d, outline: e.target.value }))} placeholder="章節大綱…" />
            <input style={{ ...inp, marginBottom: 6 }} value={draft.tags}
              onChange={e => setDraft(d => ({ ...d, tags: e.target.value }))} placeholder="標籤（逗號分隔）" />
            <input style={{ ...inp, marginBottom: 6 }} value={draft.pov_character}
              onChange={e => setDraft(d => ({ ...d, pov_character: e.target.value }))} placeholder="POV 角色" />
            <select style={{ ...inp, marginBottom: 6 }} value={draft.status}
              onChange={e => setDraft(d => ({ ...d, status: e.target.value }))}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            {acts.length > 0 && (
              <select style={{ ...inp, marginBottom: 10 }} value={draft.act_id}
                onChange={e => setDraft(d => ({ ...d, act_id: e.target.value }))}>
                <option value="">── 未分配幕 ──</option>
                {arcs.map(arc => (
                  <optgroup key={arc.id} label={arc.name}>
                    {acts.filter(a => a.story_arc_id === arc.id).map(act => (
                      <option key={act.id} value={act.id}>Act {act.order}: {act.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            )}
            <div style={{ display: 'flex', gap: 6 }}>
              <button style={btn.primary} onClick={() => saveEdit(ch.id)} disabled={saving}>{saving ? '…' : '儲存'}</button>
              <button style={btn.ghost} onClick={cancelEdit}>取消</button>
            </div>
          </div>
        )}

        {isOpen && !isEditing && (
          <div style={st.chBody}>
            {ch.outline && <div style={st.outlineSnippet}>{ch.outline}</div>}
            {ch.summary && (
              <div style={st.summarySnippet}>
                <span style={st.summaryLabel}>✦ AI 摘要</span>
                {ch.summary}
              </div>
            )}
            {tags.length > 0 && (
              <div style={st.tagRow}>
                {tags.map(t => <span key={t} style={st.tag}>{t}</span>)}
              </div>
            )}
            {sceneErrors[ch.id] ? (
              <div style={st.fetchError}>⚠ {sceneErrors[ch.id]}</div>
            ) : chScenes.length === 0 ? (
              <div style={st.sceneEmpty}>尚無場景</div>
            ) : (
              chScenes.map(sc => {
                const scActive = sc.id === currentSceneId
                return (
                  <div key={sc.id} style={{
                    ...st.sceneRow,
                    background: scActive ? T.greenDim + '60' : 'transparent',
                    borderLeft: `2px solid ${scActive ? T.green : 'transparent'}`,
                    color:      scActive ? T.green : T.textMuted,
                  }} onClick={() => loadScene(sc, ch.id)}>
                    <span style={st.sceneOrder}>#{sc.order}</span>
                    <span style={st.sceneSummary}>{sc.summary || sc.emotional_tone || '場景'}</span>
                    <button style={st.delBtn} onClick={e => deleteScene(e, sc, ch.id)} title="刪除場景">×</button>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={st.wrap}>
      {/* ── Chapter list ─────────────────────────────────── */}
      <div style={st.list}>
        {loadError && (
          <div style={st.fetchError}>⚠ {loadError}</div>
        )}
        {!loadError && chapters.length === 0 && !showNewForm && (
          <div style={st.empty}>尚無章節</div>
        )}

        {/* Arc → Act grouping headers (only shown when arcs exist) */}
        {!loadError && arcs.length > 0 && (() => {
          const chByAct: Record<string, Chapter[]> = {}
          const unassigned: Chapter[] = []
          for (const ch of chapters) {
            if (ch.act_id) { (chByAct[ch.act_id] ??= []).push(ch) }
            else unassigned.push(ch)
          }
          return (
            <>
              {arcs.map(arc => {
                const arcActs = acts.filter(a => a.story_arc_id === arc.id)
                const hasContent = arcActs.some(a => (chByAct[a.id] ?? []).length > 0)
                if (!hasContent && arcActs.length === 0) return null
                return (
                  <div key={arc.id}>
                    <div style={st.arcHeader}>{arc.name}</div>
                    {arcActs.map(act => (
                      <div key={act.id}>
                        <div style={st.actHeader}>Act {act.order} — {act.name}</div>
                        {(chByAct[act.id] ?? []).map(ch => renderChapter(ch))}
                      </div>
                    ))}
                  </div>
                )
              })}
              {unassigned.length > 0 && (
                <div>
                  <div style={st.arcHeader}>未分配章節</div>
                  {unassigned.map(ch => renderChapter(ch))}
                </div>
              )}
            </>
          )
        })()}

        {/* Flat list (no arcs defined) */}
        {!loadError && arcs.length === 0 && chapters.map(ch => renderChapter(ch))}

        {/* ── Inline new chapter form ───────────────────── */}
        {showNewForm && (
          <div style={st.newForm}>
            <input
              ref={newTitleRef}
              style={inp}
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="章節標題…"
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') { setShowNewForm(false); setNewTitle('') }
              }}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button style={btn.primary} onClick={handleCreate} disabled={creating}>
                {creating ? '…' : '建立'}
              </button>
              <button style={btn.ghost} onClick={() => { setShowNewForm(false); setNewTitle('') }}>
                取消
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer: add chapter button ───────────────────── */}
      <div style={st.footer}>
        <button style={{ ...btn.ghost, width: '100%', justifyContent: 'center' }}
          onClick={() => setShowNewForm(v => !v)}>
          + 新增章節
        </button>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────
const st: Record<string, React.CSSProperties> = {
  wrap: {
    flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0,
  },
  list: {
    flex: 1, overflowY: 'auto', padding: '4px 0',
  },
  empty: {
    fontSize: font.sizes.xs, color: T.textMuted, padding: '12px 16px',
  },
  fetchError: {
    fontSize: font.sizes.xs, color: '#f87171', padding: '12px 16px',
  },

  // Chapter row
  chRow: {
    padding: '7px 8px 7px 12px',
    display: 'flex', alignItems: 'center', gap: 5,
    cursor: 'pointer', userSelect: 'none',
  },
  chevron: { fontSize: 9, color: T.textMuted, width: 10, flexShrink: 0 },
  order:   { fontSize: font.sizes.xs, color: T.textMuted, fontFamily: 'monospace', flexShrink: 0 },
  chTitle: {
    fontSize: font.sizes.sm, flex: 1,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  statusBadge: {
    fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const,
    letterSpacing: '0.06em', flexShrink: 0,
  },
  editIcon: {
    background: 'transparent', border: 'none', color: T.textMuted,
    cursor: 'pointer', fontSize: 13, padding: '0 2px', flexShrink: 0, lineHeight: 1,
    opacity: 0.6,
  },

  // Inline edit form
  editForm: {
    padding: '10px 12px',
    background: T.bgRaised,
    borderBottom: `1px solid ${T.border}`,
  },

  // Expanded body (outline, tags, scenes)
  chBody: { paddingLeft: 22 },
  outlineSnippet: {
    fontSize: font.sizes.xs, color: T.textMuted, lineHeight: '1.5',
    padding: '4px 10px 4px 0', whiteSpace: 'pre-wrap',
    borderLeft: `2px solid ${T.border}`, paddingLeft: 8, marginBottom: 6, marginTop: 2,
  },
  summarySnippet: {
    fontSize: font.sizes.xs, color: T.textSecondary, lineHeight: '1.5',
    borderLeft: `2px solid ${T.accent}`, paddingLeft: 8, marginBottom: 6,
  },
  summaryLabel: {
    display: 'block', fontSize: 9, fontWeight: 700, color: T.accent,
    textTransform: 'uppercase' as const, letterSpacing: '0.07em', marginBottom: 3,
  },
  tagRow: {
    display: 'flex', flexWrap: 'wrap' as const, gap: 4, marginBottom: 6,
  },
  tag: {
    fontSize: 10, padding: '2px 7px', borderRadius: 99,
    background: T.accentDim, color: T.accent,
    border: `1px solid ${T.accentBorder}`,
  },

  // Scene rows
  sceneEmpty: { fontSize: font.sizes.xs, color: T.textMuted, padding: '4px 0' },
  sceneRow: {
    padding: '5px 8px 5px 10px',
    display: 'flex', alignItems: 'center', gap: 4,
    cursor: 'pointer', userSelect: 'none' as const,
    borderRadius: 4, margin: '1px 0',
  },
  sceneOrder:   { fontSize: 10, fontFamily: 'monospace', flexShrink: 0, color: T.textMuted },
  sceneSummary: { fontSize: font.sizes.xs, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  delBtn: {
    background: 'transparent', border: 'none', color: T.textMuted,
    cursor: 'pointer', fontSize: 12, padding: '0 2px', flexShrink: 0, lineHeight: 1,
    opacity: 0.5,
  },

  // Arc / Act group headers
  arcHeader: {
    fontSize: 9, fontWeight: 700, color: T.textMuted,
    textTransform: 'uppercase' as const, letterSpacing: '0.1em',
    padding: '8px 12px 3px', borderTop: `1px solid ${T.border}`,
  },
  actHeader: {
    fontSize: font.sizes.xs, color: T.accent, fontWeight: 600,
    padding: '4px 12px 3px 20px',
  },

  // New chapter form
  newForm: {
    padding: '10px 12px',
    borderTop: `1px solid ${T.border}`,
  },

  // Footer
  footer: {
    padding: '8px 12px',
    borderTop: `1px solid ${T.border}`,
    flexShrink: 0,
  },
}
