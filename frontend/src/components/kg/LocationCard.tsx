import { useEffect, useState } from 'react'
import type { KGLocation } from '../../types/messages'
import { inp, sectionTitle, saveBtn, cancelBtn, s } from './cardStyles'

interface Props {
  projectId: string
  location: KGLocation | null
  onSaved: (l: KGLocation) => void
  onCancel: () => void
}

type FormState = Partial<Omit<KGLocation, 'id' | 'project_id'>>

const labelStyle = { fontSize: 11, color: '#555', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em' }

export default function LocationCard({ projectId, location, onSaved, onCancel }: Props) {
  const [form, setForm] = useState<FormState>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(location ? { ...location } : {})
  }, [location])

  const set = (field: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    if (!form.name?.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    try {
      const url = location
        ? `/api/projects/${projectId}/kg/locations/${location.id}`
        : `/api/projects/${projectId}/kg/locations`
      const res = await fetch(url, {
        method: location ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error(await res.text())
      onSaved(await res.json())
    } catch (e) { setError(String(e)) } finally { setSaving(false) }
  }

  const ta = { ...inp, resize: 'vertical' as const, minHeight: 60, fontFamily: 'inherit', lineHeight: '1.5', width: '100%' }

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <span style={s.cardTitle}>{location ? 'Edit Location' : 'New Location'}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={cancelBtn} onClick={onCancel}>Cancel</button>
          <button style={saveBtn} onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      {error && <p style={s.error}>{error}</p>}
      <div style={s.scrollArea}>
        <div style={sectionTitle}>Details</div>

        {[
          ['Name *', 'name', false],
          ['Description', 'description', true],
          ['Atmosphere', 'atmosphere', true],
          ['Parent Location', 'parent_location', false],
          ['Story Significance', 'significance', true],
        ].map(([lbl, field, multi]) => (
          <div key={field as string} style={{ marginBottom: 10 }}>
            <div style={labelStyle}>{lbl as string}</div>
            {multi
              ? <textarea style={ta} value={(form as Record<string, string>)[field as string] ?? ''}
                  onChange={(e) => set(field as keyof FormState, e.target.value)} />
              : <input style={inp} value={(form as Record<string, string>)[field as string] ?? ''}
                  onChange={(e) => set(field as keyof FormState, e.target.value)} />}
          </div>
        ))}
      </div>
    </div>
  )
}
