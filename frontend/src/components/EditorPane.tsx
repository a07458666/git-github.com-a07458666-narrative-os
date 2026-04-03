/**
 * EditorPane — Week 6 + Week 7 + UI Redesign
 * - 串流階段：純文字 div（避免 ProseMirror 閃爍）
 * - scene_end 後：TipTap 富文字編輯器
 * - Toolbar：Bold / Italic / H1 / H2 + 字數 + Save + ⚡ Check
 * - Auto-save：2s debounce PATCH /api/scenes/{id}
 * - ConsistencyPanel：點 Check 後顯示在編輯區下方
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import CharacterCount from '@tiptap/extension-character-count'
import { useSessionStore } from '../store/sessionStore'
import SaveToChapterModal from './SaveToChapterModal'
import ConsistencyPanel from './ConsistencyPanel'
import { T, font, btn } from '../theme'

// ── Toolbar ───────────────────────────────────────────────────
function Toolbar({ editor }: { editor: ReturnType<typeof useEditor> }) {
  if (!editor) return null

  const toolBtn = (active: boolean): React.CSSProperties => ({
    background:   active ? T.accentDim : 'transparent',
    border:       `1px solid ${active ? T.accentBorder : T.border}`,
    color:        active ? T.accent : T.textMuted,
    cursor:       'pointer',
    borderRadius: 5,
    fontSize:     font.sizes.sm,
    fontWeight:   600,
    padding:      '3px 9px',
    lineHeight:   '1.4',
    fontFamily:   'inherit',
  })

  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      <button style={toolBtn(editor.isActive('bold'))}
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleBold().run() }}>B</button>
      <button style={{ ...toolBtn(editor.isActive('italic')), fontStyle: 'italic' }}
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleItalic().run() }}>I</button>
      <div style={{ width: 1, height: 14, background: T.border, margin: '0 4px' }} />
      <button style={toolBtn(editor.isActive('heading', { level: 1 }))}
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 1 }).run() }}>H1</button>
      <button style={toolBtn(editor.isActive('heading', { level: 2 }))}
        onMouseDown={e => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run() }}>H2</button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export default function EditorPane() {
  const { sceneBuffer, phase, editorContent, currentSceneId, currentChapterId, setEditorContent } = useSessionStore()
  const [showModal, setShowModal]           = useState(false)
  const [saveStatus, setSaveStatus]         = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [showConsistency, setShowConsistency] = useState(false)
  const [checkLoading, setCheckLoading]     = useState(false)
  const [checkIssues, setCheckIssues]       = useState<object[]>([])
  const [checkError, setCheckError]         = useState<string | null>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: '確認場景方向後開始寫作…' }),
      CharacterCount,
    ],
    content: '',
    editorProps: {
      attributes: {
        style: [
          `font-size:${font.sizes.md}px`,
          'line-height:1.9',
          `color:${T.textPrimary}`,
          'outline:none',
          'min-height:300px',
          'font-family:inherit',
        ].join(';'),
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      setEditorContent(html)
      setSaveStatus('unsaved')
      if (currentSceneId) {
        if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
        autoSaveTimer.current = setTimeout(() => doAutoSave(html, currentSceneId), 2000)
      }
    },
  })

  const doAutoSave = useCallback(async (html: string, sceneId: string) => {
    setSaveStatus('saving')
    try {
      await fetch(`/api/scenes/${sceneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: html }),
      })
      setSaveStatus('saved')
    } catch {
      setSaveStatus('unsaved')
    }
  }, [])

  // Load content into TipTap after scene_end
  useEffect(() => {
    if (phase !== 'writing' && editorContent && editor) {
      const html = editorContent.trimStart().startsWith('<')
        ? editorContent
        : editorContent
            .split(/\n{2,}/)
            .map(para => `<p>${para.replace(/\n/g, '<br />')}</p>`)
            .filter(p => p !== '<p></p>')
            .join('')
      editor.commands.setContent(html)
    }
  }, [editorContent, phase]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!editorContent && editor) editor.commands.setContent('')
  }, [editorContent]) // eslint-disable-line react-hooks/exhaustive-deps

  // Consistency check
  const handleCheck = useCallback(async () => {
    const content = editor ? editor.getText() : editorContent
    if (!content.trim()) return
    const pathMatch = window.location.pathname.match(/\/workspace\/([^/]+)/)
    const projectId = pathMatch ? pathMatch[1] : currentChapterId
    if (!projectId) return

    setShowConsistency(true)
    setCheckLoading(true)
    setCheckIssues([])
    setCheckError(null)
    try {
      const res = await fetch(`/api/projects/${projectId}/consistency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scene_content: content }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setCheckIssues(data.issues ?? [])
    } catch {
      setCheckError('一致性檢查失敗，請重試')
    } finally {
      setCheckLoading(false)
    }
  }, [editor, editorContent, currentChapterId])

  const charCount = editor?.storage.characterCount.characters() ?? 0

  const saveColor: Record<typeof saveStatus, string> = {
    saved: T.green, saving: T.yellow, unsaved: T.textMuted,
  }
  const saveLabel: Record<typeof saveStatus, string> = {
    saved: 'Saved', saving: 'Saving…', unsaved: 'Unsaved',
  }

  return (
    <div style={st.pane}>
      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div style={st.toolbar}>
        <Toolbar editor={editor} />
        <div style={{ flex: 1 }} />
        {currentSceneId && (
          <span style={{ fontSize: font.sizes.xs, color: saveColor[saveStatus], marginRight: 8 }}>
            ● {saveLabel[saveStatus]}
          </span>
        )}
        <span style={{ fontSize: font.sizes.xs, color: T.textMuted, marginRight: 12 }}>
          {charCount.toLocaleString()} 字
        </span>
        {phase === 'writing' && (
          <span style={{ fontSize: font.sizes.sm, color: T.green, fontWeight: 600 }}>● 撰寫中…</span>
        )}
        {phase !== 'writing' && (
          <>
            <button style={st.checkBtn} onClick={handleCheck} disabled={checkLoading}>
              ⚡ Check
            </button>
            <button style={btn.success} onClick={() => setShowModal(true)}>
              Save to Chapter
            </button>
          </>
        )}
      </div>

      {/* ── Editor content ──────────────────────────────────── */}
      <div style={st.scrollArea}>
        <div style={st.editorWrap}>
          {phase === 'writing' && sceneBuffer && (
            <div style={st.streamArea}>{sceneBuffer}</div>
          )}
          <div style={{ display: phase === 'writing' ? 'none' : 'block' }}>
            <EditorContent editor={editor} />
          </div>
        </div>
      </div>

      {/* ── Consistency panel ───────────────────────────────── */}
      {showConsistency && (
        <ConsistencyPanel
          issues={checkIssues as Parameters<typeof ConsistencyPanel>[0]['issues']}
          loading={checkLoading}
          error={checkError}
          onDismiss={() => { setShowConsistency(false); setCheckError(null) }}
        />
      )}

      {/* ── Save to Chapter modal ───────────────────────────── */}
      {showModal && (
        <SaveToChapterModal
          onClose={() => setShowModal(false)}
          onSaved={() => setShowModal(false)}
        />
      )}
    </div>
  )
}

const st: Record<string, React.CSSProperties> = {
  pane: {
    flex: 1, display: 'flex', flexDirection: 'column',
    background: T.bgBase, overflow: 'hidden', minWidth: 0,
  },
  toolbar: {
    padding: '8px 20px', borderBottom: `1px solid ${T.border}`,
    display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
    minHeight: 44, background: T.bgElevated,
  },
  checkBtn: {
    ...btn.secondary,
    color: T.accent, borderColor: T.accentBorder,
    background: T.accentDim,
  },
  scrollArea: {
    flex: 1, overflowY: 'auto',
    display: 'flex', justifyContent: 'center',
  },
  editorWrap: {
    width: '100%', maxWidth: 720,
    padding: '40px 48px 80px',
  },
  streamArea: {
    fontSize: font.sizes.md, lineHeight: '1.9',
    color: T.textPrimary, whiteSpace: 'pre-wrap',
  },
}
