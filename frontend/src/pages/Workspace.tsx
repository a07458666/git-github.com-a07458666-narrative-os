import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { ServerMessage } from '../types/messages'
import { useWebSocket } from '../hooks/useWebSocket'
import { useSessionStore } from '../store/sessionStore'
import ChapterTree from '../components/ChapterTree'
import EditorPane from '../components/EditorPane'
import AgentChat from '../components/AgentChat'
import KGIconBar from '../components/KGIconBar'
import KGContextPanel from '../components/KGContextPanel'
import type { KGPanelTab } from '../components/KGContextPanel'
import { T, font, btn } from '../theme'

export default function Workspace() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const store = useSessionStore()

  // ── Panel collapse / KG sidebar state ─────────────────────
  const [treeCollapsed, setTreeCollapsed]   = useState(false)
  const [chatCollapsed, setChatCollapsed]   = useState(false)
  const [activeKGTab, setActiveKGTab]       = useState<KGPanelTab | null>(null)
  const [injectText, setInjectText]         = useState('')

  const handleKGToggle = (tab: KGPanelTab) => {
    setActiveKGTab(prev => prev === tab ? null : tab)
  }

  // Each inject gets a unique string so useEffect in AgentChat always fires
  const handleInject = (text: string) => {
    setChatCollapsed(false)          // auto-expand Director when injecting
    setInjectText(text + '\u200B')   // zero-width space makes it unique each time
  }

  const handleMessage = useCallback((msg: ServerMessage) => {
    switch (msg.type) {
      case 'session_start':
        store.setProject(msg.project)
        store.addMessage({ role: 'system', content: `Session started — ${msg.project.name}` })
        store.setPhase('idle')
        break
      case 'status':
        store.addMessage({ role: 'system', content: msg.message })
        break
      case 'suggestions':
        store.addMessage({ role: 'agent', content: msg.content, kg_nodes: msg.kg_nodes })
        store.setPhase('confirming')
        // Auto-expand chat when agent responds
        setChatCollapsed(false)
        break
      case 'scene_start':
        store.setPhase('writing')
        break
      case 'scene_chunk':
        store.appendSceneChunk(msg.content)
        break
      case 'scene_end': {
        store.finalizeScene(msg.char_count)
        const filename = msg.draft_path?.split('/').pop() ?? msg.draft_path
        store.addMessage({
          role: 'system',
          content: `場景生成完成（${msg.char_count?.toLocaleString() ?? 0} 字）\n草稿已儲存：${filename}`,
        })
        store.setPhase('kg_review')
        break
      }
      case 'kg_suggestions':
        store.setPendingKGChanges(msg.changes)
        store.addMessage({ role: 'agent', content: 'Scene analysed. Review KG changes below.' })
        store.setPhase('kg_review')
        break
      case 'kg_updates_applied':
        store.addMessage({ role: 'agent', content: 'KG updated.', applied_results: msg.results })
        store.setPhase('idle')
        break
      case 'project_status':
        store.addMessage({
          role: 'system',
          content:
            `Characters: ${msg.characters.map((c) => c.name).join(', ')}\n` +
            `Active threads: ${msg.active_threads.map((t) => t.name).join(', ')}`,
        })
        break
      case 'error':
        store.addMessage({ role: 'error', content: msg.message })
        store.setPhase('idle')
        break
      case 'session_end':
        store.addMessage({ role: 'system', content: `Session ended. ${msg.summary}` })
        store.setPhase('idle')
        break
    }
  }, [store])

  const { send, status } = useWebSocket(projectId ?? null, { onMessage: handleMessage })

  useEffect(() => {
    return () => store.clearSession()
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!projectId) { navigate('/'); return null }

  const { project } = store

  return (
    <div style={st.root}>
      {/* ── Top bar ─────────────────────────────────────────── */}
      <div style={st.topBar}>
        <button style={btn.ghost} onClick={() => navigate('/')}>← Projects</button>
        <div style={st.divider} />
        <span style={st.projectName}>{project?.name ?? projectId}</span>
        {project?.summary && (
          <span style={st.kgStat}>
            {project.summary.character_count} 角色 · {project.summary.active_thread_count} 伏筆
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button style={btn.secondary} onClick={() => navigate(`/project/${projectId}/kg`)}>
          KG →
        </button>
        {/* Chat toggle */}
        <button
          style={{ ...btn.ghost, fontSize: 16 }}
          title={chatCollapsed ? '展開 Director' : '收合 Director'}
          onClick={() => setChatCollapsed(v => !v)}
        >
          {chatCollapsed ? '◧' : '◨'}
        </button>
      </div>

      {/* ── Three-pane workspace ─────────────────────────────── */}
      <div style={st.workspace}>
        {/* Left: Chapter tree */}
        <div style={{ ...st.treeWrap, width: treeCollapsed ? 36 : 240 }}>
          {treeCollapsed ? (
            <button style={st.collapseBtn} title="展開章節" onClick={() => setTreeCollapsed(false)}>›</button>
          ) : (
            <>
              <div style={st.panelHeader}>
                <span style={st.panelTitle}>章節</span>
                <button style={st.collapseIconBtn} title="收合" onClick={() => setTreeCollapsed(true)}>‹</button>
              </div>
              <ChapterTree
                projectId={projectId}
                onSelectChapter={(chapterId) => store.setCurrentChapterId(chapterId)}
              />
            </>
          )}
        </div>

        {/* Center: Editor */}
        <EditorPane />

        {/* KG context panel (slides in from right of editor) */}
        {activeKGTab && (
          <KGContextPanel projectId={projectId} tab={activeKGTab} onInject={handleInject} />
        )}

        {/* KG icon bar (VS Code Activity Bar style) */}
        <KGIconBar active={activeKGTab} onToggle={handleKGToggle} />

        {/* Right: Agent chat */}
        {!chatCollapsed && (
          <AgentChat onSend={send} wsStatus={status} injectText={injectText} />
        )}
      </div>
    </div>
  )
}

const st: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden', background: T.bgBase },
  topBar: {
    height: 48, background: T.bgBase, borderBottom: `1px solid ${T.border}`,
    display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10, flexShrink: 0,
  },
  divider: { width: 1, height: 18, background: T.border, flexShrink: 0 },
  projectName: { fontSize: font.sizes.base, fontWeight: 600, color: T.textPrimary },
  kgStat: { fontSize: font.sizes.xs, color: T.textMuted },
  workspace: { display: 'flex', flex: 1, overflow: 'hidden' },

  // Chapter tree panel
  treeWrap: {
    borderRight: `1px solid ${T.border}`, flexShrink: 0,
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    background: T.bgElevated, transition: 'width 0.2s ease',
  },
  panelHeader: {
    display: 'flex', alignItems: 'center', padding: '10px 14px',
    borderBottom: `1px solid ${T.border}`, flexShrink: 0,
  },
  panelTitle: { fontSize: font.sizes.xs, fontWeight: 600, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', flex: 1 },
  collapseIconBtn: {
    background: 'transparent', border: 'none', color: T.textMuted,
    cursor: 'pointer', fontSize: 14, padding: '2px 4px', lineHeight: 1,
  },
  collapseBtn: {
    width: 36, height: '100%', background: 'transparent', border: 'none',
    color: T.textMuted, cursor: 'pointer', fontSize: 16,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
}
