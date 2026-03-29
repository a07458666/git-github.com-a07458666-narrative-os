import { useEffect, useRef, useState } from 'react'
import type { ClientMessage, KGChanges } from '../types/messages'
import { useSessionStore } from '../store/sessionStore'
import { T, font, btn, inp } from '../theme'

interface Props {
  onSend: (msg: ClientMessage) => void
  wsStatus: 'disconnected' | 'connecting' | 'connected' | 'error'
  injectText?: string   // Ctrl+Click from KGContextPanel appends here
}

export default function AgentChat({ onSend, wsStatus, injectText }: Props) {
  const { messages, phase, pendingKGChanges } = useSessionStore()
  const [inputText, setInputText]   = useState('')

  // Append injected KG text and focus textarea
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!injectText) return
    setInputText(prev => prev ? `${prev} ${injectText.trim()}` : injectText.trim())
    setTimeout(() => textareaRef.current?.focus(), 0)
  }, [injectText])
  const [showParams, setShowParams] = useState(false)
  const [pov, setPov]               = useState('')
  const [location, setLocation]     = useState('')
  const [targetWords, setTargetWords] = useState('800')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (listRef.current)
      listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messages])

  useEffect(() => {
    if (phase === 'confirming') setShowParams(false)
  }, [phase])

  const handleSendIntent = () => {
    const text = inputText.trim()
    if (!text || wsStatus !== 'connected') return
    useSessionStore.getState().addMessage({ role: 'user', content: text })
    onSend({ type: 'intent', content: text })
    setInputText('')
    useSessionStore.getState().setPhase('suggesting')
  }

  const handleConfirmDirection = () => {
    const text = inputText.trim()
    if (!text || wsStatus !== 'connected') return
    useSessionStore.getState().addMessage({ role: 'user', content: `Confirmed: ${text}` })
    onSend({
      type: 'confirm_direction',
      direction: text,
      pov_character: pov || undefined,
      location: location || undefined,
      target_words: Number(targetWords) || 800,
    })
    setInputText(''); setPov(''); setLocation(''); setShowParams(false)
    useSessionStore.getState().setPhase('writing')
  }

  const handleSkip = () => {
    onSend({ type: 'skip' })
    useSessionStore.getState().setPhase('idle')
  }

  const handleRefine = () => {
    const text = inputText.trim()
    if (!text) return
    useSessionStore.getState().addMessage({ role: 'user', content: `Refine: ${text}` })
    onSend({ type: 'refine_intent', content: text })
    setInputText('')
  }

  const handleApplyKG = (apply: boolean) => {
    onSend({ type: 'confirm_kg_updates', apply })
    useSessionStore.getState().clearPendingKG()
    useSessionStore.getState().setPhase('idle')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (phase === 'idle') handleSendIntent()
      else if (phase === 'confirming') handleConfirmDirection()
    }
  }

  const placeholder =
    phase === 'idle'       ? '想寫什麼？輸入意圖…' :
    phase === 'confirming' ? '輸入你的方向選擇（例：方向1）…' :
    phase === 'writing'    ? '場景生成中…' :
    phase === 'kg_review'  ? '審查 KG 更新中…' :
    '等待 Director…'

  const wsColor =
    wsStatus === 'connected'   ? T.green :
    wsStatus === 'connecting'  ? T.yellow :
    wsStatus === 'error'       ? T.red : T.textMuted

  return (
    <div style={st.panel}>
      {/* ── Header ──────────────────────────────────────────── */}
      <div style={st.header}>
        <span style={st.headerTitle}>Director</span>
        <div style={{ flex: 1 }} />
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: wsColor, flexShrink: 0 }} />
        <span style={{ fontSize: font.sizes.xs, color: T.textMuted }}>{wsStatus}</span>
      </div>

      {/* ── Phase badge ─────────────────────────────────────── */}
      {phase !== 'idle' && (
        <div style={st.phaseBadge}>
          <span style={{ ...st.phaseText, color: phaseColor(phase) }}>
            {phaseLabel(phase)}
          </span>
        </div>
      )}

      {/* ── Message list ────────────────────────────────────── */}
      <div ref={listRef} style={st.messageList}>
        {messages.map(m => (
          <div key={m.id} style={{ ...st.message, ...roleSt(m.role) }}>
            {m.role !== 'scene' && m.role !== 'system' && (
              <div style={{ ...st.roleLabel, color: roleLabelColor(m.role) }}>
                {roleLabel(m.role)}
              </div>
            )}
            <div style={{
              ...st.messageContent,
              color: m.role === 'system' ? T.textMuted : m.role === 'error' ? T.red : T.textSecondary,
            }}>
              {m.content}
            </div>
            {m.kg_nodes && m.kg_nodes.length > 0 && (
              <div style={st.kgNodes}>KG: {m.kg_nodes.join(', ')}</div>
            )}
            {m.applied_results && (
              <div style={{ marginTop: 8, fontSize: font.sizes.xs, color: T.green, lineHeight: '1.5' }}>
                {m.applied_results.map((r, i) => <div key={i}>{r}</div>)}
              </div>
            )}
          </div>
        ))}

        {/* KG review */}
        {phase === 'kg_review' && pendingKGChanges && (
          <div style={st.kgReview}>
            <div style={st.kgReviewTitle}>Proposed KG Updates</div>
            <KGDiff changes={pendingKGChanges} />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button style={btn.success} onClick={() => handleApplyKG(true)}>Apply All</button>
              <button style={btn.secondary} onClick={() => handleApplyKG(false)}>Skip</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Scene params ────────────────────────────────────── */}
      {phase === 'confirming' && showParams && (
        <div style={st.params}>
          <input style={inp} placeholder="POV 角色" value={pov} onChange={e => setPov(e.target.value)} />
          <input style={inp} placeholder="地點" value={location} onChange={e => setLocation(e.target.value)} />
          <input style={{ ...inp, width: 120 }} placeholder="目標字數" type="number" value={targetWords} onChange={e => setTargetWords(e.target.value)} />
        </div>
      )}

      {/* ── Input area ──────────────────────────────────────── */}
      {(phase === 'idle' || phase === 'confirming') && (
        <div style={st.inputArea}>
          <textarea
            ref={textareaRef}
            style={st.textarea}
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={wsStatus !== 'connected'}
            rows={3}
          />
          <div style={st.actions}>
            {phase === 'idle' && (
              <button style={btn.primary} onClick={handleSendIntent} disabled={wsStatus !== 'connected' || !inputText.trim()}>
                Query KG →
              </button>
            )}
            {phase === 'confirming' && (
              <>
                <button style={btn.ghost} onClick={() => setShowParams(v => !v)}>
                  {showParams ? '隱藏參數' : '場景參數'}
                </button>
                <button style={btn.secondary} onClick={handleRefine} disabled={!inputText.trim()}>精修</button>
                <button style={btn.secondary} onClick={handleSkip}>跳過</button>
                <button style={btn.primary} onClick={handleConfirmDirection} disabled={!inputText.trim()}>
                  確認 →
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── KG Diff ───────────────────────────────────────────────────
function KGDiff({ changes }: { changes: KGChanges }) {
  const { character_state_changes = [], relationship_changes = [], new_plot_threads = [], resolved_plot_threads = [] } = changes

  if (!character_state_changes.length && !relationship_changes.length && !new_plot_threads.length && !resolved_plot_threads.length)
    return <p style={{ color: T.textMuted, fontSize: font.sizes.sm }}>No changes detected.</p>

  return (
    <div style={{ fontSize: font.sizes.sm, lineHeight: '1.6' }}>
      {character_state_changes.map((c, i) => (
        <div key={i} style={{ marginBottom: 5 }}>
          <span style={{ color: T.blue }}>{c.character_name}</span>:{' '}
          <span style={{ color: T.textMuted }}>{c.old_state}</span>
          {' → '}
          <span style={{ color: T.green }}>{c.new_state}</span>
        </div>
      ))}
      {relationship_changes.map((r, i) => {
        const sign = r.trust_delta >= 0 ? '+' : ''
        return (
          <div key={i} style={{ marginBottom: 5 }}>
            <span style={{ color: T.blue }}>{r.char_a}↔{r.char_b}</span>{' '}
            trust <span style={{ color: r.trust_delta >= 0 ? T.green : T.red }}>{sign}{r.trust_delta}</span>
            {r.reason && <span style={{ color: T.textMuted }}> ({r.reason})</span>}
          </div>
        )
      })}
      {new_plot_threads.map((t, i) => (
        <div key={i} style={{ marginBottom: 5 }}>
          <span style={{ color: T.yellow }}>+ {t.name}</span>: {t.description}
        </div>
      ))}
      {resolved_plot_threads.map((t, i) => (
        <div key={i} style={{ marginBottom: 5 }}>
          <span style={{ color: T.green }}>✓ Resolved</span>: {t.thread_name}
        </div>
      ))}
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────
function phaseLabel(p: string) {
  const map: Record<string, string> = {
    suggesting: '思考中…', confirming: '選擇方向', writing: '撰寫中…', kg_review: '審查 KG',
  }
  return map[p] ?? p
}
function phaseColor(p: string) {
  if (p === 'writing') return T.green
  if (p === 'suggesting') return T.yellow
  if (p === 'kg_review') return T.blue
  return T.accent
}
function roleLabel(role: string) {
  if (role === 'agent') return 'Director'
  if (role === 'user')  return 'You'
  if (role === 'error') return 'Error'
  return ''
}
function roleLabelColor(role: string) {
  if (role === 'agent') return T.accent
  if (role === 'user')  return T.blue
  if (role === 'error') return T.red
  return T.textMuted
}
function roleSt(role: string): React.CSSProperties {
  if (role === 'agent') return { background: T.bgRaised, borderColor: T.accentBorder + '60' }
  if (role === 'user')  return { background: T.bgRaised, borderColor: T.blueDim, alignSelf: 'flex-end' }
  if (role === 'system') return { background: 'transparent', border: 'none', padding: '2px 0' }
  if (role === 'error') return { background: T.redDim + '40', borderColor: T.redDim }
  return {}
}

// ── Styles ────────────────────────────────────────────────────
const st: Record<string, React.CSSProperties> = {
  panel: {
    width: 340, flexShrink: 0,
    borderLeft: `1px solid ${T.border}`,
    display: 'flex', flexDirection: 'column',
    background: T.bgElevated, overflow: 'hidden',
  },
  header: {
    padding: '11px 16px', borderBottom: `1px solid ${T.border}`,
    display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
  },
  headerTitle: {
    fontSize: font.sizes.xs, fontWeight: 700, color: T.textMuted,
    textTransform: 'uppercase', letterSpacing: '0.08em',
  },
  phaseBadge: {
    padding: '5px 16px', borderBottom: `1px solid ${T.border}`,
    background: T.bgBase, flexShrink: 0,
  },
  phaseText: { fontSize: font.sizes.xs, fontWeight: 600, letterSpacing: '0.04em' },
  messageList: {
    flex: 1, overflowY: 'auto', padding: 12,
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  message: {
    padding: '10px 12px', borderRadius: 8,
    border: `1px solid ${T.border}`, background: T.bgBase,
  },
  roleLabel: {
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.07em', marginBottom: 4,
  },
  messageContent: { fontSize: font.sizes.sm, lineHeight: '1.65', whiteSpace: 'pre-wrap' },
  kgNodes: { marginTop: 6, fontSize: 10, color: T.textMuted, fontFamily: 'monospace' },
  kgReview: {
    margin: '6px 0', padding: '14px 14px',
    background: T.bgBase, border: `1px solid ${T.border}`, borderRadius: 8,
  },
  kgReviewTitle: {
    fontSize: font.sizes.xs, fontWeight: 700, color: T.textSecondary,
    textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
  },
  params: {
    padding: '10px 12px', borderTop: `1px solid ${T.border}`,
    display: 'flex', flexDirection: 'column', gap: 6,
    background: T.bgBase, flexShrink: 0,
  },
  inputArea: {
    borderTop: `1px solid ${T.border}`, padding: '10px 12px',
    display: 'flex', flexDirection: 'column', gap: 8,
    background: T.bgBase, flexShrink: 0,
  },
  textarea: {
    background: T.bgRaised, border: `1px solid ${T.border}`,
    borderRadius: 8, padding: '10px 12px',
    color: T.textPrimary, fontSize: font.sizes.sm, lineHeight: '1.55',
    resize: 'none', outline: 'none', width: '100%', fontFamily: 'inherit',
  },
  actions: { display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' },
}
