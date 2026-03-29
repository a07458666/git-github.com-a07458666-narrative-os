import { useEffect, useState } from 'react'
import type { KGFaction } from '../../types/messages'
import { inp, label, sectionTitle, saveBtn, cancelBtn, s } from './cardStyles'

interface Props {
  projectId: string
  faction: KGFaction | null
  onSaved: (f: KGFaction) => void
  onCancel: () => void
}

type FormState = Partial<Omit<KGFaction, 'id' | 'project_id'>>

export default function FactionCard({ projectId, faction, onSaved, onCancel }: Props) {
  const [form, setForm] = useState<FormState>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setForm(faction ? { ...faction } : { power_level: 5, members: [] })
  }, [faction])

  const set = (field: keyof FormState, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    if (!form.name?.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    try {
      const url = faction
        ? `/api/projects/${projectId}/kg/factions/${faction.id}`
        : `/api/projects/${projectId}/kg/factions`
      const body = { ...form }
      if (typeof body.members === 'string') {
        body.members = (body.members as unknown as string).split(',').map((s) => s.trim()).filter(Boolean)
      }
      const res = await fetch(url, {
        method: faction ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await res.text())
      onSaved(await res.json())
    } catch (e) { setError(String(e)) } finally { setSaving(false) }
  }

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <span style={s.cardTitle}>{faction ? 'Edit Faction' : 'New Faction'}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={cancelBtn} onClick={onCancel}>Cancel</button>
          <button style={saveBtn} onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
      {error && <p style={s.error}>{error}</p>}
      <div style={s.scrollArea}>
        <div style={sectionTitle}>Identity</div>
        <F label="Name *" value={form.name ?? ''} onChange={(v) => set('name', v)} />
        <F label="Ideology" value={form.ideology ?? ''} onChange={(v) => set('ideology', v)} multiline />
        <F label="Goals" value={form.goals ?? ''} onChange={(v) => set('goals', v)} multiline />
        <F label="Resources" value={form.resources ?? ''} onChange={(v) => set('resources', v)} multiline />

        <div style={sectionTitle}>Power</div>
        <div style={{ marginBottom: 10 }}>
          <div style={label}>Power Level (1–10)</div>
          <input style={{ ...inp, width: 80 }} type="number" min={1} max={10}
            value={form.power_level ?? 5}
            onChange={(e) => set('power_level', Number(e.target.value))} />
        </div>

        <div style={sectionTitle}>Members</div>
        <F label="Member IDs (comma-separated)"
          value={Array.isArray(form.members) ? form.members.join(', ') : (form.members ?? '')}
          onChange={(v) => set('members', v)} />
      </div>
    </div>
  )
}

function F({ label: lbl, value, onChange, multiline }: { label: string; value: string; onChange: (v: string) => void; multiline?: boolean }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={label}>{lbl}</div>
      {multiline
        ? <textarea style={{ ...inp, resize: 'vertical', minHeight: 48, fontFamily: 'inherit', lineHeight: '1.5', width: '100%' }}
            value={value} onChange={(e) => onChange(e.target.value)} />
        : <input style={inp} value={value} onChange={(e) => onChange(e.target.value)} />}
    </div>
  )
}
