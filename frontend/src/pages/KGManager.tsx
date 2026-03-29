import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import type { KGArtifact, KGCharacter, KGFaction, KGLocation, KGPlotThread } from '../types/messages'
import { T, font, btn } from '../theme'
import KGList from '../components/kg/KGList'
import CharacterCard from '../components/kg/CharacterCard'
import FactionCard from '../components/kg/FactionCard'
import LocationCard from '../components/kg/LocationCard'
import PlotThreadCard from '../components/kg/PlotThreadCard'
import ArtifactCard from '../components/kg/ArtifactCard'
import KGGraph from '../components/kg/KGGraph'
import { s as cardS } from '../components/kg/cardStyles'

type Tab = 'characters' | 'factions' | 'locations' | 'threads' | 'artifacts' | 'graph'

const TABS: { id: Tab; label: string }[] = [
  { id: 'characters', label: 'Characters' },
  { id: 'factions', label: 'Factions' },
  { id: 'locations', label: 'Locations' },
  { id: 'threads', label: 'Plot Threads' },
  { id: 'artifacts', label: 'Artifacts' },
  { id: 'graph', label: '🕸 Graph' },
]

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
    if (tab === 'graph') return  // graph fetches its own data
    setLoading(true)
    try {
      const endpointMap: Record<Exclude<Tab, 'graph'>, string> = {
        characters: 'characters',
        factions: 'factions',
        locations: 'locations',
        threads: 'threads',
        artifacts: 'artifacts',
      }
      const res = await fetch(`/api/projects/${projectId}/kg/${endpointMap[tab as Exclude<Tab, 'graph'>]}`)
      const data = await res.json()
      if (tab === 'characters') setCharacters(data)
      else if (tab === 'factions') setFactions(data)
      else if (tab === 'locations') setLocations(data)
      else if (tab === 'threads') setThreads(data)
      else if (tab === 'artifacts') setArtifacts(data)
    } catch {/* ignore */} finally { setLoading(false) }
  }, [projectId])

  useEffect(() => { fetchTab(activeTab) }, [activeTab, fetchTab])

  // ── Delete helper ─────────────────────────────────────────
  const deleteEntity = async (tab: Tab, id: string) => {
    const endpointMap: Record<Exclude<Tab, 'graph'>, string> = {
      characters: 'characters', factions: 'factions',
      locations: 'locations', threads: 'threads', artifacts: 'artifacts',
    }
    if (tab === 'graph') return
    await fetch(`/api/projects/${projectId}/kg/${endpointMap[tab as Exclude<Tab, 'graph'>]}/${id}`, { method: 'DELETE' })
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
