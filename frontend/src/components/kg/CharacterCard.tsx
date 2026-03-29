import { useEffect, useState } from 'react'
import type { KGCharacter } from '../../types/messages'
import { inp, ta, label, sectionTitle, saveBtn, cancelBtn, formGrid, s } from './cardStyles'

interface Props {
  projectId: string
  character: KGCharacter | null  // null = create mode
  onSaved: (c: KGCharacter) => void
  onCancel: () => void
}

type FormState = Partial<Omit<KGCharacter, 'id' | 'project_id'>>

export default function CharacterCard({ projectId, character, onSaved, onCancel }: Props) {
  const [form, setForm] = useState<FormState>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (character) {
      setForm({ ...character })
    } else {
      setForm({ role: 'supporting', speech_samples: [], aliases: [] })
    }
  }, [character])

  const set = (field: keyof FormState, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  const handleSave = async () => {
    if (!form.name?.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    try {
      const url = character
        ? `/api/projects/${projectId}/kg/characters/${character.id}`
        : `/api/projects/${projectId}/kg/characters`
      const method = character ? 'PATCH' : 'POST'
      const body: FormState = { ...form }
      // Convert comma-separated strings to arrays for list fields
      if (typeof body.speech_samples === 'string') {
        body.speech_samples = (body.speech_samples as unknown as string).split('\n').map(s => s.trim()).filter(Boolean)
      }
      if (typeof body.aliases === 'string') {
        body.aliases = (body.aliases as unknown as string).split(',').map(s => s.trim()).filter(Boolean)
      }
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error(await res.text())
      onSaved(await res.json())
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <span style={s.cardTitle}>{character ? 'Edit Character' : 'New Character'}</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={cancelBtn} onClick={onCancel}>Cancel</button>
          <button style={saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      {error && <p style={s.error}>{error}</p>}

      <div style={s.scrollArea}>
        {/* Basic */}
        <div style={sectionTitle}>Basic</div>
        <div style={formGrid}>
          <Field label="Name *" value={form.name ?? ''} onChange={(v) => set('name', v)} />
          <Field label="Role" value={form.role ?? ''} onChange={(v) => set('role', v)} type="select"
            options={['protagonist', 'antagonist', 'supporting']} />
          <Field label="Gender" value={form.gender ?? ''} onChange={(v) => set('gender', v)} />
          <Field label="Age" value={form.age ?? ''} onChange={(v) => set('age', v)} />
        </div>
        <Field label="Appearance" value={form.appearance ?? ''} onChange={(v) => set('appearance', v)} multiline />

        {/* GOLEM Psychology */}
        <div style={sectionTitle}>GOLEM Psychology</div>
        <Field label="Core Desire" value={form.core_desire ?? ''} onChange={(v) => set('core_desire', v)} multiline />
        <Field label="Core Fear" value={form.core_fear ?? ''} onChange={(v) => set('core_fear', v)} multiline />
        <Field label="Wound" value={form.wound ?? ''} onChange={(v) => set('wound', v)} multiline />
        <Field label="Core Belief" value={form.belief ?? ''} onChange={(v) => set('belief', v)} multiline />
        <Field label="Moral Code" value={form.moral_code ?? ''} onChange={(v) => set('moral_code', v)} multiline />

        {/* Behavior */}
        <div style={sectionTitle}>Behavior & Voice</div>
        <Field label="Behavior Pattern" value={form.behavior_pattern ?? ''} onChange={(v) => set('behavior_pattern', v)} multiline />
        <Field label="Speech Style" value={form.speech_style ?? ''} onChange={(v) => set('speech_style', v)} multiline />
        <Field label="Speech Samples (one per line)"
          value={Array.isArray(form.speech_samples) ? form.speech_samples.join('\n') : (form.speech_samples ?? '')}
          onChange={(v) => set('speech_samples', v)} multiline rows={4} />

        {/* Arc */}
        <div style={sectionTitle}>Story Arc</div>
        <Field label="Arc Start" value={form.arc_start ?? ''} onChange={(v) => set('arc_start', v)} multiline />
        <Field label="Arc End (target)" value={form.arc_end ?? ''} onChange={(v) => set('arc_end', v)} multiline />
        <Field label="Current State" value={form.current_state ?? ''} onChange={(v) => set('current_state', v)} multiline />

        {/* Meta */}
        <div style={sectionTitle}>Meta</div>
        <div style={formGrid}>
          <Field label="Faction ID" value={form.faction_id ?? ''} onChange={(v) => set('faction_id', v)} />
          <Field label="Aliases (comma-separated)"
            value={Array.isArray(form.aliases) ? form.aliases.join(', ') : (form.aliases ?? '')}
            onChange={(v) => set('aliases', v)} />
        </div>
      </div>
    </div>
  )
}

// ── Reusable field ────────────────────────────────────────────
interface FieldProps {
  label: string
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  rows?: number
  type?: 'text' | 'select'
  options?: string[]
}

function Field({ label: lbl, value, onChange, multiline, rows = 2, type = 'text', options }: FieldProps) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={label}>{lbl}</div>
      {type === 'select' ? (
        <select style={inp} value={value} onChange={(e) => onChange(e.target.value)}>
          {options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : multiline ? (
        <textarea style={{ ...ta, minHeight: rows * 22 }} value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <input style={inp} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  )
}
