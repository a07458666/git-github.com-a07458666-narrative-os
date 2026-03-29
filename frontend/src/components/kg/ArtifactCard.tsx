import { useEffect, useState } from 'react'
import type { KGArtifact } from '../../types/messages'
import { inp, sectionTitle, saveBtn, cancelBtn, s } from './cardStyles'

interface Props {
  projectId: string
  artifact: KGArtifact | null
  onSaved: (a: KGArtifact) => void
  onCancel: () => void
}

const labelStyle = { fontSize: 11, color: '#555', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }

export default function ArtifactCard({ projectId, artifact, onSaved, onCancel }: Props) {
  const [form, setForm] = useState({ name: '', description: '', power: '', history: '', current_owner: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(artifact
      ? { name: artifact.name, description: artifact.description, power: artifact.power, history: artifact.history, current_owner: artifact.current_owner }
      : { name: '', description: '', power: '', history: '', current_owner: '' })
  }, [artifact])

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    try {
      const url = artifact
        ? `/api/projects/${projectId}/kg/artifacts/${artifact.id}`
        : `/api/projects/${projectId}/kg/artifacts`
      const res = await fetch(url, {
        method: artifact ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error(await res.text())
      onSaved(await res.json())
    } catch (e) { setError(String(e)) } finally { setSaving(false) }
  }

  const ta = { ...inp, resize: 'vertical' as const, minHeight: 60, fontFamily: 'inherit', lineHeight: '1.5', width: '100%' }
  const fields: [string, keyof typeof form, boolean][] = [
    ['Name *', 'name', false],
    ['Description', 'description', true],
    ['Power / Ability', 'power', true],
    ['History', 'history', true],
    ['Current Owner (character ID)', 'current_owner', false],
  ]

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <span style={s.cardTitle}>{artifact ? 'Edit Artifact' : 'New Artifact'}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={cancelBtn} onClick={onCancel}>Cancel</button>
          <button style={saveBtn} onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      {error && <p style={s.error}>{error}</p>}
      <div style={s.scrollArea}>
        <div style={sectionTitle}>Details</div>
        {fields.map(([lbl, field, multi]) => (
          <div key={field} style={{ marginBottom: 10 }}>
            <div style={labelStyle}>{lbl}</div>
            {multi
              ? <textarea style={ta} value={form[field]} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} />
              : <input style={inp} value={form[field]} onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))} />}
          </div>
        ))}
      </div>
    </div>
  )
}
