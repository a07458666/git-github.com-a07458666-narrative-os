import { useEffect, useState } from 'react'
import type { KGPlotThread } from '../../types/messages'
import { inp, sectionTitle, saveBtn, cancelBtn, s } from './cardStyles'

interface Props {
  projectId: string
  thread: KGPlotThread | null
  onSaved: (t: KGPlotThread) => void
  onCancel: () => void
}

const labelStyle = { fontSize: 11, color: '#555', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }
const taStyle = { ...inp, resize: 'vertical' as const, minHeight: 60, fontFamily: 'inherit', lineHeight: '1.5', width: '100%' }

export default function PlotThreadCard({ projectId, thread, onSaved, onCancel }: Props) {
  const [form, setForm] = useState({ name: '', description: '', planted_in: '', planted_at: '' })
  const [resolveMode, setResolveMode] = useState(false)
  const [resolutionScene, setResolutionScene] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (thread) {
      setForm({ name: thread.name, description: thread.description, planted_in: thread.planted_in, planted_at: thread.planted_at })
    } else {
      setForm({ name: '', description: '', planted_in: '', planted_at: '' })
    }
    setResolveMode(false)
    setResolutionScene('')
  }, [thread])

  const isResolved = thread?.status === 'resolved'
  const isActive = thread?.status === 'active'

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    try {
      const url = `/api/projects/${projectId}/kg/threads`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error(await res.text())
      onSaved(await res.json())
    } catch (e) { setError(String(e)) } finally { setSaving(false) }
  }

  const handleResolve = async () => {
    if (!thread) return
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/projects/${projectId}/kg/threads/${thread.id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution_scene: resolutionScene }),
      })
      if (!res.ok) throw new Error(await res.text())
      onSaved(await res.json())
    } catch (e) { setError(String(e)) } finally { setSaving(false) }
  }

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <span style={s.cardTitle}>
          {thread ? thread.name : 'New Plot Thread'}
          {thread && (
            <span style={{
              marginLeft: 8, fontSize: 11, padding: '2px 8px', borderRadius: 99,
              background: isResolved ? '#1a2a1a' : '#2a1a1a',
              color: isResolved ? '#86efac' : '#fde68a',
              border: `1px solid ${isResolved ? '#2a4a2a' : '#4a3a1a'}`,
            }}>
              {thread.status}
            </span>
          )}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={cancelBtn} onClick={onCancel}>Cancel</button>
          {!thread && (
            <button style={saveBtn} onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Create'}</button>
          )}
          {isActive && !resolveMode && (
            <button style={{ ...saveBtn, background: '#2a2a1a', borderColor: '#4a4a2a', color: '#fde68a' }}
              onClick={() => setResolveMode(true)}>
              Resolve →
            </button>
          )}
        </div>
      </div>
      {error && <p style={s.error}>{error}</p>}

      <div style={s.scrollArea}>
        {/* View / Edit mode */}
        {thread ? (
          <>
            <div style={sectionTitle}>Details</div>
            <div style={{ marginBottom: 8 }}>
              <div style={labelStyle}>Description</div>
              <p style={{ color: '#bbb', fontSize: 13, lineHeight: '1.6' }}>{thread.description || '—'}</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
              <div>
                <div style={labelStyle}>Planted In (scene)</div>
                <p style={{ color: '#bbb', fontSize: 13 }}>{thread.planted_in || '—'}</p>
              </div>
              <div>
                <div style={labelStyle}>Planted At (story time)</div>
                <p style={{ color: '#bbb', fontSize: 13 }}>{thread.planted_at || '—'}</p>
              </div>
            </div>
            {isResolved && thread.resolution_scene && (
              <div style={{ marginTop: 12, padding: '10px 14px', background: '#1a2a1a', borderRadius: 6, border: '1px solid #2a4a2a' }}>
                <div style={labelStyle}>Resolution</div>
                <p style={{ color: '#86efac', fontSize: 13 }}>{thread.resolution_scene}</p>
              </div>
            )}

            {/* Resolve form */}
            {resolveMode && (
              <div style={{ marginTop: 20 }}>
                <div style={sectionTitle}>Resolve Thread</div>
                <div style={{ marginBottom: 10 }}>
                  <div style={labelStyle}>Resolution Note (optional)</div>
                  <textarea style={taStyle} value={resolutionScene}
                    onChange={(e) => setResolutionScene(e.target.value)}
                    placeholder="Describe how this foreshadowing was resolved…" />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button style={cancelBtn} onClick={() => setResolveMode(false)}>Cancel</button>
                  <button style={saveBtn} onClick={handleResolve} disabled={saving}>
                    {saving ? 'Resolving…' : 'Confirm Resolve'}
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Create mode */
          <>
            <div style={sectionTitle}>New Thread</div>
            {[
              ['Name *', 'name', false],
              ['Description', 'description', true],
              ['Planted In (scene ID)', 'planted_in', false],
              ['Planted At (story time)', 'planted_at', false],
            ].map(([lbl, field, multi]) => (
              <div key={field as string} style={{ marginBottom: 10 }}>
                <div style={labelStyle}>{lbl as string}</div>
                {multi
                  ? <textarea style={taStyle} value={form[field as keyof typeof form]}
                      onChange={(e) => setForm((f) => ({ ...f, [field as string]: e.target.value }))} />
                  : <input style={inp} value={form[field as keyof typeof form]}
                      onChange={(e) => setForm((f) => ({ ...f, [field as string]: e.target.value }))} />}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
