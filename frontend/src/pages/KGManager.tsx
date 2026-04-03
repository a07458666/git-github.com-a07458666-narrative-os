import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { KGArtifact, KGCharacter, KGFaction, KGLocation, KGPlotThread } from '../types/messages'
import { T, font, btn, inp } from '../theme'
import KGList from '../components/kg/KGList'
import CharacterCard from '../components/kg/CharacterCard'
import FactionCard from '../components/kg/FactionCard'
import LocationCard from '../components/kg/LocationCard'
import PlotThreadCard from '../components/kg/PlotThreadCard'
import ArtifactCard from '../components/kg/ArtifactCard'
import KGGraph from '../components/kg/KGGraph'
import { s as cardS } from '../components/kg/cardStyles'

type Tab = 'characters' | 'factions' | 'locations' | 'threads' | 'artifacts' | 'structure' | 'graph'

const TABS: { id: Tab; label: string }[] = [
  { id: 'characters', label: 'Characters' },
  { id: 'factions', label: 'Factions' },
  { id: 'locations', label: 'Locations' },
  { id: 'threads', label: 'Plot Threads' },
  { id: 'artifacts', label: 'Artifacts' },
  { id: 'structure', label: '📐 架構' },
  { id: 'graph', label: '🕸 Graph' },
]

interface StoryArc { id: string; name: string; theme: string; emotional_goal: string }
interface Act { id: string; story_arc_id: string; order: number; name: string }

export default function KGManager() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<Tab>('characters')
  const [projectName, setProjectName] = useState('')

  // ── Data state ────────────────────────────────────────────
  const [characters, setCharacters] = useState<KGCharacter[]>([])
  const [factions, setFactions] = useState<KGFaction[]>([])
  const [locations, setLocations] = useState<KGLocation[]>([])
  const [threads, setThreads] = useState<KGPlotThread[]>([])
  const [artifacts, setArtifacts] = useState<KGArtifact[]>([])
  const [loading, setLoading] = useState(false)

  // ── Structure (Arc/Act) state ─────────────────────────────
  const [arcs, setArcs] = useState<StoryArc[]>([])
  const [actsByArc, setActsByArc] = useState<Record<string, Act[]>>({})
  const [newArcName, setNewArcName] = useState('')
  const [newArcTheme, setNewArcTheme] = useState('')
  const [creatingArc, setCreatingArc] = useState(false)
  const [newActName, setNewActName] = useState<Record<string, string>>({})
  const [creatingAct, setCreatingAct] = useState<Record<string, boolean>>({})
  const [expandedArcs, setExpandedArcs] = useState<Set<string>>(new Set())
  const arcNameRef = useRef<HTMLInputElement>(null)

  // ── Selection / edit state ────────────────────────────────
  const [selectedChar, setSelectedChar] = useState<KGCharacter | null>(null)
  const [editingChar, setEditingChar] = useState<KGCharacter | null | 'new'>('none' as unknown as null)
  const [selectedFaction, setSelectedFaction] = useState<KGFaction | null>(null)
  const [editingFaction, setEditingFaction] = useState<KGFaction | null | 'new'>('none' as unknown as null)
  const [selectedLocation, setSelectedLocation] = useState<KGLocation | null>(null)
  const [editingLocation, setEditingLocation] = useState<KGLocation | null | 'new'>('none' as unknown as null)
  const [selectedThread, setSelectedThread] = useState<KGPlotThread | null>(null)
  const [editingThread, setEditingThread] = useState<KGPlotThread | null | 'new'>('none' as unknown as null)
  const [selectedArtifact, setSelectedArtifact] = useState<KGArtifact | null>(null)
  const [editingArtifact, setEditingArtifact] = useState<KGArtifact | null | 'new'>('none' as unknown as null)

  // ── Fetch project name ────────────────────────────────────
  useEffect(() => {
    if (!projectId) return
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((p) => setProjectName(p.name ?? ''))
      .catch(() => {})
  }, [projectId])

  // ── Fetch data on tab change ──────────────────────────────
  const fetchTab = useCallback(async (tab: Tab) => {
    if (!projectId) return
    if (tab === 'graph' || tab === 'structure') return  // these fetch their own data
    setLoading(true)
    try {
      const endpointMap: Record<Exclude<Tab, 'graph' | 'structure'>, string> = {
        characters: 'characters',
        factions: 'factions',
        locations: 'locations',
        threads: 'threads',
        artifacts: 'artifacts',
      }
      const res = await fetch(`/api/projects/${projectId}/kg/${endpointMap[tab as Exclude<Tab, 'graph' | 'structure'>]}`)
      const data = await res.json()
      if (tab === 'characters') setCharacters(data)
      else if (tab === 'factions') setFactions(data)
      else if (tab === 'locations') setLocations(data)
      else if (tab === 'threads') setThreads(data)
      else if (tab === 'artifacts') setArtifacts(data)
    } catch {/* ignore */} finally { setLoading(false) }
  }, [projectId])

  useEffect(() => { fetchTab(activeTab) }, [activeTab, fetchTab])

  // ── Structure: Arc/Act handlers ───────────────────────────
  const loadArcs = useCallback(async () => {
    if (!projectId) return
    try {
      const data = await fetch(`/api/projects/${projectId}/arcs`).then(r => r.json())
      if (Array.isArray(data)) setArcs(data)
    } catch {/* ignore */}
  }, [projectId])

  const loadActsForArc = useCallback(async (arcId: string) => {
    if (!projectId) return
    try {
      const data = await fetch(`/api/projects/${projectId}/arcs/${arcId}/acts`).then(r => r.json())
      if (Array.isArray(data)) setActsByArc(prev => ({ ...prev, [arcId]: data }))
    } catch {/* ignore */}
  }, [projectId])

  useEffect(() => { if (activeTab === 'structure') loadArcs() }, [activeTab, loadArcs])

  const toggleArc = async (arcId: string) => {
    setExpandedArcs(prev => {
      const next = new Set(prev)
      if (next.has(arcId)) { next.delete(arcId); return next }
      next.add(arcId)
      return next
    })
    if (!actsByArc[arcId]) await loadActsForArc(arcId)
  }

  const handleCreateArc = async () => {
    if (!newArcName.trim() || !projectId) return
    setCreatingArc(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/arcs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newArcName.trim(), theme: newArcTheme.trim() }),
      })
      if (res.ok) { setNewArcName(''); setNewArcTheme(''); await loadArcs() }
    } catch {/* ignore */} finally { setCreatingArc(false) }
  }

  const handleDeleteArc = async (arcId: string) => {
    if (!window.confirm('刪除故事弧？其下的幕不會自動刪除章節的關聯。') || !projectId) return
    await fetch(`/api/projects/${projectId}/arcs/${arcId}`, { method: 'DELETE' })
    setArcs(prev => prev.filter(a => a.id !== arcId))
    setActsByArc(prev => { const next = { ...prev }; delete next[arcId]; return next })
  }

  const handleCreateAct = async (arcId: string) => {
    const name = newActName[arcId]?.trim()
    if (!name || !projectId) return
    const existingActs = actsByArc[arcId] ?? []
    setCreatingAct(prev => ({ ...prev, [arcId]: true }))
    try {
      const res = await fetch(`/api/projects/${projectId}/arcs/${arcId}/acts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, order: existingActs.length + 1 }),
      })
      if (res.ok) {
        setNewActName(prev => ({ ...prev, [arcId]: '' }))
        await loadActsForArc(arcId)
      }
    } catch {/* ignore */} finally { setCreatingAct(prev => ({ ...prev, [arcId]: false })) }
  }

  const handleDeleteAct = async (arcId: string, actId: string) => {
    if (!projectId) return
    await fetch(`/api/projects/${projectId}/arcs/${arcId}/acts/${actId}`, { method: 'DELETE' })
    setActsByArc(prev => ({ ...prev, [arcId]: (prev[arcId] ?? []).filter(a => a.id !== actId) }))
  }

  // ── Delete helper ─────────────────────────────────────────
  const deleteEntity = async (tab: Tab, id: string) => {
    const endpointMap: Record<Exclude<Tab, 'graph' | 'structure'>, string> = {
      characters: 'characters', factions: 'factions',
      locations: 'locations', threads: 'threads', artifacts: 'artifacts',
    }
    if (tab === 'graph' || tab === 'structure') return
    await fetch(`/api/projects/${projectId}/kg/${endpointMap[tab as Exclude<Tab, 'graph' | 'structure'>]}/${id}`, { method: 'DELETE' })
    fetchTab(tab)
  }

  if (!projectId) { navigate('/'); return null }

  // ── Render tab content ────────────────────────────────────
  const renderContent = () => {
    switch (activeTab) {
      case 'characters': return (
        <TabPane>
          <KGList
            items={characters} selectedId={selectedChar?.id ?? null} label="Characters" loading={loading}
            onSelect={(c) => { setSelectedChar(c); setEditingChar(c) }}
            onNew={() => { setSelectedChar(null); setEditingChar(null) }}
            onDelete={(id) => deleteEntity('characters', id)}
            renderMeta={(c) => c.role}
          />
          {(editingChar as unknown) !== 'none'
            ? <CharacterCard projectId={projectId} character={editingChar as KGCharacter | null}
                onSaved={(c) => { setCharacters((prev) => upsert(prev, c)); setEditingChar(c); setSelectedChar(c) }}
                onCancel={() => setEditingChar('none' as unknown as null)} />
            : <div style={cardS.emptyCard}>Select a character or create a new one</div>}
        </TabPane>
      )

      case 'factions': return (
        <TabPane>
          <KGList
            items={factions} selectedId={selectedFaction?.id ?? null} label="Factions" loading={loading}
            onSelect={(f) => { setSelectedFaction(f); setEditingFaction(f) }}
            onNew={() => { setSelectedFaction(null); setEditingFaction(null) }}
            onDelete={(id) => deleteEntity('factions', id)}
            renderMeta={(f) => `Power: ${f.power_level}`}
          />
          {(editingFaction as unknown) !== 'none'
            ? <FactionCard projectId={projectId} faction={editingFaction as KGFaction | null}
                onSaved={(f) => { setFactions((prev) => upsert(prev, f)); setEditingFaction(f); setSelectedFaction(f) }}
                onCancel={() => setEditingFaction('none' as unknown as null)} />
            : <div style={cardS.emptyCard}>Select a faction or create a new one</div>}
        </TabPane>
      )

      case 'locations': return (
        <TabPane>
          <KGList
            items={locations} selectedId={selectedLocation?.id ?? null} label="Locations" loading={loading}
            onSelect={(l) => { setSelectedLocation(l); setEditingLocation(l) }}
            onNew={() => { setSelectedLocation(null); setEditingLocation(null) }}
            onDelete={(id) => deleteEntity('locations', id)}
            renderMeta={(l) => l.atmosphere}
          />
          {(editingLocation as unknown) !== 'none'
            ? <LocationCard projectId={projectId} location={editingLocation as KGLocation | null}
                onSaved={(l) => { setLocations((prev) => upsert(prev, l)); setEditingLocation(l); setSelectedLocation(l) }}
                onCancel={() => setEditingLocation('none' as unknown as null)} />
            : <div style={cardS.emptyCard}>Select a location or create a new one</div>}
        </TabPane>
      )

      case 'threads': return (
        <TabPane>
          <KGList
            items={threads} selectedId={selectedThread?.id ?? null} label="Plot Threads" loading={loading}
            onSelect={(t) => { setSelectedThread(t); setEditingThread(t) }}
            onNew={() => { setSelectedThread(null); setEditingThread(null) }}
            onDelete={(id) => deleteEntity('threads', id)}
            renderMeta={(t) => (
              <span style={{ color: t.status === 'resolved' ? '#86efac' : '#fde68a' }}>{t.status}</span>
            )}
          />
          {(editingThread as unknown) !== 'none'
            ? <PlotThreadCard projectId={projectId} thread={editingThread as KGPlotThread | null}
                onSaved={(t) => { setThreads((prev) => upsert(prev, t)); setEditingThread(t); setSelectedThread(t) }}
                onCancel={() => setEditingThread('none' as unknown as null)} />
            : <div style={cardS.emptyCard}>Select a thread or create a new one</div>}
        </TabPane>
      )

      case 'artifacts': return (
        <TabPane>
          <KGList
            items={artifacts} selectedId={selectedArtifact?.id ?? null} label="Artifacts" loading={loading}
            onSelect={(a) => { setSelectedArtifact(a); setEditingArtifact(a) }}
            onNew={() => { setSelectedArtifact(null); setEditingArtifact(null) }}
            onDelete={(id) => deleteEntity('artifacts', id)}
            renderMeta={(a) => a.power}
          />
          {(editingArtifact as unknown) !== 'none'
            ? <ArtifactCard projectId={projectId} artifact={editingArtifact as KGArtifact | null}
                onSaved={(a) => { setArtifacts((prev) => upsert(prev, a)); setEditingArtifact(a); setSelectedArtifact(a) }}
                onCancel={() => setEditingArtifact('none' as unknown as null)} />
            : <div style={cardS.emptyCard}>Select an artifact or create a new one</div>}
        </TabPane>
      )

      case 'structure': return (
        <div style={arcSt.wrap}>
          {/* Create arc form */}
          <div style={arcSt.createBox}>
            <div style={arcSt.createTitle}>新增故事弧</div>
            <input ref={arcNameRef} style={{ ...inp, marginBottom: 6 }} placeholder="故事弧名稱"
              value={newArcName} onChange={e => setNewArcName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreateArc() }} />
            <input style={{ ...inp, marginBottom: 8 }} placeholder="主題（選填）"
              value={newArcTheme} onChange={e => setNewArcTheme(e.target.value)} />
            <button style={btn.primary} onClick={handleCreateArc} disabled={creatingArc || !newArcName.trim()}>
              {creatingArc ? '…' : '+ 建立'}
            </button>
          </div>

          {/* Arc list */}
          <div style={arcSt.list}>
            {arcs.length === 0 && <div style={arcSt.empty}>尚無故事弧，請先建立</div>}
            {arcs.map(arc => {
              const isOpen = expandedArcs.has(arc.id)
              const acts = actsByArc[arc.id] ?? []
              return (
                <div key={arc.id} style={arcSt.arcCard}>
                  <div style={arcSt.arcHeader} onClick={() => toggleArc(arc.id)}>
                    <span style={arcSt.chevron}>{isOpen ? '▾' : '▸'}</span>
                    <span style={arcSt.arcName}>{arc.name}</span>
                    {arc.theme && <span style={arcSt.arcTheme}>{arc.theme}</span>}
                    <span style={arcSt.actCount}>{acts.length} 幕</span>
                    <button style={arcSt.delBtn} onClick={e => { e.stopPropagation(); handleDeleteArc(arc.id) }}>×</button>
                  </div>

                  {isOpen && (
                    <div style={arcSt.actBody}>
                      {acts.map(act => (
                        <div key={act.id} style={arcSt.actRow}>
                          <span style={arcSt.actOrder}>Act {act.order}</span>
                          <span style={arcSt.actName}>{act.name}</span>
                          <button style={arcSt.delBtn} onClick={() => handleDeleteAct(arc.id, act.id)}>×</button>
                        </div>
                      ))}
                      {acts.length === 0 && <div style={arcSt.empty}>尚無幕</div>}

                      {/* Inline add act */}
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <input
                          style={{ ...inp, flex: 1, fontSize: 12 }}
                          placeholder="幕名稱（如：起 / 承 / 轉 / 合）"
                          value={newActName[arc.id] ?? ''}
                          onChange={e => setNewActName(prev => ({ ...prev, [arc.id]: e.target.value }))}
                          onKeyDown={e => { if (e.key === 'Enter') handleCreateAct(arc.id) }}
                        />
                        <button style={{ ...btn.secondary, fontSize: 11 }}
                          onClick={() => handleCreateAct(arc.id)}
                          disabled={creatingAct[arc.id] || !(newActName[arc.id] ?? '').trim()}>
                          {creatingAct[arc.id] ? '…' : '+ 幕'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )

      case 'graph': return (
        <div style={{ height: '100%', overflow: 'hidden' }}>
          <KGGraph projectId={projectId} />
        </div>
      )
    }
  }

  return (
    <div style={styles.root}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <button style={styles.backBtn} onClick={() => navigate(`/workspace/${projectId}`)}>← Workspace</button>
        <span style={styles.title}>KG Manager{projectName ? ` — ${projectName}` : ''}</span>
      </div>

      {/* Tab bar */}
      <div style={styles.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            style={{ ...styles.tab, ...(activeTab === tab.id ? styles.tabActive : {}) }}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={styles.content}>
        {renderContent()}
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────
function TabPane({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>{children}</div>
}

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id)
  if (idx === -1) return [...list, item]
  const next = [...list]
  next[idx] = item
  return next
}

// ── Structure tab styles ──────────────────────────────────────
const arcSt: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', height: '100%', overflow: 'hidden', gap: 0 },
  createBox: {
    width: 260, flexShrink: 0, padding: 20,
    borderRight: `1px solid ${T.border}`, overflowY: 'auto',
  },
  createTitle: { fontSize: font.sizes.xs, fontWeight: 700, color: T.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 },
  list: { flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 },
  empty: { fontSize: font.sizes.sm, color: T.textMuted, padding: '8px 0' },
  arcCard: { background: T.bgElevated, border: `1px solid ${T.border}`, borderRadius: 6, overflow: 'hidden' },
  arcHeader: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
    cursor: 'pointer', userSelect: 'none',
  },
  chevron: { fontSize: 9, color: T.textMuted, width: 10, flexShrink: 0 },
  arcName: { fontSize: font.sizes.base, fontWeight: 600, color: T.textPrimary, flex: 1 },
  arcTheme: { fontSize: font.sizes.xs, color: T.textMuted, fontStyle: 'italic' },
  actCount: { fontSize: 10, color: T.textMuted, flexShrink: 0 },
  delBtn: {
    background: 'transparent', border: 'none', color: T.textMuted,
    cursor: 'pointer', fontSize: 14, padding: '0 4px', flexShrink: 0, lineHeight: 1, opacity: 0.6,
  },
  actBody: { padding: '8px 14px 14px 28px', borderTop: `1px solid ${T.border}`, background: T.bgRaised },
  actRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '5px 0', borderBottom: `1px solid ${T.border}`,
  },
  actOrder: { fontSize: 10, color: T.textMuted, fontFamily: 'monospace', width: 40, flexShrink: 0 },
  actName: { flex: 1, fontSize: font.sizes.sm, color: T.textSecondary },
}

// ── Styles ────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', height: '100vh', background: T.bgBase, overflow: 'hidden' },
  topBar: {
    height: 48, background: T.bgBase, borderBottom: `1px solid ${T.border}`,
    display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, flexShrink: 0,
  },
  backBtn: { ...btn.ghost, fontSize: font.sizes.base },
  title: { fontSize: font.sizes.base, fontWeight: 600, color: T.textPrimary },
  tabBar: {
    display: 'flex', borderBottom: `1px solid ${T.border}`,
    background: T.bgElevated, padding: '0 16px', flexShrink: 0,
  },
  tab: {
    background: 'transparent', border: 'none', borderBottom: '2px solid transparent',
    color: T.textMuted, cursor: 'pointer', fontSize: font.sizes.sm,
    padding: '11px 18px', fontFamily: 'inherit', fontWeight: 500,
  },
  tabActive: { color: T.accent, borderBottom: `2px solid ${T.accent}` },
  content: { flex: 1, overflow: 'hidden' },
}
