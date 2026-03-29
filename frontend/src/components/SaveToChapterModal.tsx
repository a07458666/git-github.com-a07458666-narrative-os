/**
 * SaveToChapterModal
 * - If currentSceneId is set → PATCH existing scene (update content)
 * - If not → POST new scene to selected/new chapter
 * - Calls bumpSavedSignal() after success so ChapterTree refreshes
 */

import { useEffect, useState } from 'react'
import { useSessionStore } from '../store/sessionStore'
import { T, font, btn, inp } from '../theme'

interface Props {
  onClose: () => void
  onSaved: () => void
}

interface Chapter {
  id: string
  title: string
  order: number
}

export default function SaveToChapterModal({ onClose, onSaved }: Props) {
  const { project, editorContent, currentSceneId, currentChapterId,
          setCurrentSceneId, setCurrentChapterId, bumpSavedSignal } = useSessionStore()
  const [chapters, setChapters]             = useState<Chapter[]>([])
  const [selectedChapterId, setSelected]    = useState<string>(currentChapterId ?? '')
  const [showNewChapter, setShowNewChapter] = useState(false)
  const [newTitle, setNewTitle]             = useState('')
  const [newOrder, setNewOrder]             = useState(1)
  const [saving, setSaving]                 = useState(false)
  const [error, setError]                   = useState('')

  const isUpdate = Boolean(currentSceneId)

  useEffect(() => {
    if (!project) return
    fetch(`/api/projects/${project.id}/chapters`)
      .then(r => r.json())
      .then((data: Chapter[]) => {
        if (!Array.isArray(data)) return
        const sorted = [...data].sort((a, b) => a.order - b.order)
        setChapters(sorted)
        if (!currentChapterId && sorted.length > 0)
          setSelected(sorted[0].id)
        setNewOrder(sorted.length + 1)
      })
      .catch(() => {})
  }, [project]) // eslint-disable-line

  const handleCreateChapter = async (): Promise<string | null> => {
    if (!project) return null
    if (!newTitle.trim()) { setError('請輸入章節標題'); return null }
    const res = await fetch(`/api/projects/${project.id}/chapters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: newTitle, order: newOrder }),
    })
    if (!res.ok) { setError(await res.text()); return null }
    const ch = await res.json()
    return ch.id
  }

  const handleSave = async () => {
    setError('')
    setSaving(true)
    try {
      // ── Update existing scene ──────────────────────────
      if (isUpdate) {
        const res = await fetch(`/api/scenes/${currentSceneId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: editorContent }),
        })
        if (!res.ok) throw new Error(await res.text())
        bumpSavedSignal()
        onSaved()
        return
      }

      // ── Create new scene ───────────────────────────────
      let chapterId = selectedChapterId
      if (showNewChapter) {
        const newId = await handleCreateChapter()
        if (!newId) { setSaving(false); return }
        chapterId = newId
      }
      if (!chapterId) { setError('請選擇或建立章節'); setSaving(false); return }

      const existingScenes = await fetch(`/api/chapters/${chapterId}/scenes`).then(r => r.json())
      const nextOrder = Array.isArray(existingScenes) ? existingScenes.length + 1 : 1

      const res = await fetch(`/api/chapters/${chapterId}/scenes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editorContent, order: nextOrder }),
      })
      if (!res.ok) throw new Error(await res.text())
      const scene = await res.json()
      setCurrentSceneId(scene.id)
      setCurrentChapterId(chapterId)
      bumpSavedSignal()
      onSaved()
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={st.overlay}>
      <div style={st.modal}>
        {/* Header */}
        <div style={st.header}>
          <span style={st.title}>
            {isUpdate ? '更新場景' : '儲存場景'}
          </span>
          <button style={st.closeBtn} onClick={onClose}>✕</button>
        </div>

        {error && <p style={st.error}>{error}</p>}

        {isUpdate ? (
          <p style={st.hint}>
            將目前編輯器內容更新至場景 <code style={{ color: T.accent }}>{currentSceneId?.slice(0, 8)}…</code>
          </p>
        ) : (
          <>
            {!showNewChapter ? (
              <div style={{ marginBottom: 16 }}>
                <div style={st.label}>選擇章節</div>
                {chapters.length === 0 ? (
                  <p style={{ color: T.textMuted, fontSize: font.sizes.sm, marginBottom: 8 }}>尚無章節</p>
                ) : (
                  <select
                    style={{ ...inp, marginBottom: 6 }}
                    value={selectedChapterId}
                    onChange={e => setSelected(e.target.value)}
                  >
                    {chapters.map(ch => (
                      <option key={ch.id} value={ch.id}>
                        Ch.{ch.order} — {ch.title}
                      </option>
                    ))}
                  </select>
                )}
                <button style={st.linkBtn} onClick={() => setShowNewChapter(true)}>
                  + 建立新章節
                </button>
              </div>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <div style={st.label}>新章節標題</div>
                <input
                  style={{ ...inp, marginBottom: 8 }}
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                  placeholder="章節標題…"
                  autoFocus
                />
                <div style={st.label}>排序</div>
                <input
                  style={{ ...inp, width: 80, marginBottom: 8 }}
                  type="number"
                  value={newOrder}
                  onChange={e => setNewOrder(Number(e.target.value))}
                  min={1}
                />
                <button style={st.linkBtn} onClick={() => setShowNewChapter(false)}>
                  ← 返回章節列表
                </button>
              </div>
            )}
          </>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button style={btn.ghost} onClick={onClose}>取消</button>
          <button style={btn.success} onClick={handleSave} disabled={saving}>
            {saving ? '儲存中…' : (isUpdate ? '更新' : '儲存場景')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────
const st: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: T.bgElevated,
    border: `1px solid ${T.border}`,
    borderRadius: 10,
    padding: '20px 24px',
    width: 400,
    maxWidth: '90vw',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16,
  },
  title: { fontSize: font.sizes.base, fontWeight: 600, color: T.textPrimary },
  closeBtn: {
    background: 'transparent', border: 'none', color: T.textMuted,
    cursor: 'pointer', fontSize: 16,
  },
  label: {
    fontSize: font.sizes.xs, color: T.textMuted, marginBottom: 6, fontWeight: 600,
    textTransform: 'uppercase' as const, letterSpacing: '0.06em',
  },
  hint: { fontSize: font.sizes.sm, color: T.textSecondary, marginBottom: 16, lineHeight: '1.5' },
  linkBtn: {
    background: 'transparent', border: 'none', color: T.accent,
    cursor: 'pointer', fontSize: font.sizes.sm, padding: '4px 0',
    display: 'block', marginTop: 4,
  },
  error: {
    color: T.red, fontSize: font.sizes.sm, marginBottom: 12,
    background: T.redDim + '40', padding: '6px 10px', borderRadius: 6,
  },
}
