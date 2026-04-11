/**
 * KGGraph — force-directed graph showing both world entities and story structure.
 *
 * World layer:  Character, Faction, Location, PlotThread, Artifact
 * Story layer:  StoryArc, Act, Chapter (with AI summary shown on hover)
 *
 * Layer toggle lets user focus on either layer or view both at once.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'

/* eslint-disable @typescript-eslint/no-explicit-any */

type LayerFilter = 'all' | 'world' | 'story'

interface GraphNode {
  id: string
  label: string
  type: string
  role?: string
  status?: string
  summary?: string
  order?: number
  [key: string]: unknown
}

interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  type: string
  label?: string
}

interface Props { projectId: string }

// ── Visual config ────────────────────────────────────────────

const WORLD_TYPES  = new Set(['Character', 'Faction', 'Location', 'PlotThread', 'Artifact'])
const STORY_TYPES  = new Set(['StoryArc', 'Act', 'Chapter'])
const WORLD_LINKS  = new Set(['RELATES_TO', 'FACTION_RELATES_TO', 'MEMBER_OF', 'OWNED_BY'])

const TYPE_COLOR: Record<string, string> = {
  // World
  Character:  '#4a9eff',
  Faction:    '#a855f7',
  Location:   '#4ade80',
  PlotThread: '#fbbf24',
  Artifact:   '#f97316',
  // Story
  StoryArc:   '#e879f9',
  Act:        '#c084fc',
  Chapter:    '#94a3b8',
}

const NODE_R: Record<string, number> = {
  StoryArc: 14, Act: 11, Chapter: 9,
  Character: 10, Faction: 10, Location: 10, PlotThread: 10, Artifact: 10,
}

const LINK_COLOR: Record<string, string> = {
  RELATES_TO:         '#4a9eff',
  FACTION_RELATES_TO: '#a855f7',
  MEMBER_OF:          '#4ade80',
  OWNED_BY:           '#f97316',
  IN_ARC:             '#e879f9',
  IN_ACT:             '#c084fc',
  POV_OF:             '#7dd3fc',
  SET_IN:             '#86efac',
}

const WORLD_LEGEND = [
  { type: 'Character',  label: '角色' },
  { type: 'Faction',    label: '派系' },
  { type: 'Location',   label: '地點' },
  { type: 'PlotThread', label: '伏筆' },
  { type: 'Artifact',   label: '器物' },
]

const STORY_LEGEND = [
  { type: 'StoryArc', label: '故事弧' },
  { type: 'Act',      label: '幕' },
  { type: 'Chapter',  label: '章節' },
]

// ── Component ────────────────────────────────────────────────

export default function KGGraph({ projectId }: Props) {
  const [allData, setAllData]     = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] })
  const [layer, setLayer]         = useState<LayerFilter>('all')
  const [loading, setLoading]     = useState(false)
  const [hovered, setHovered]     = useState<GraphNode | null>(null)
  const [dimensions, setDimensions] = useState({ w: 800, h: 600 })
  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef        = useRef<any>(null)

  // ── Derive filtered graph data based on layer ─────────────
  const graphData = (() => {
    if (layer === 'all') return allData
    const keepTypes = layer === 'world' ? WORLD_TYPES : STORY_TYPES
    const nodeIds = new Set(allData.nodes.filter(n => keepTypes.has(n.type)).map(n => n.id))
    const keepLinkTypes = layer === 'world' ? WORLD_LINKS : null  // story: keep all non-world links
    return {
      nodes: allData.nodes.filter(n => keepTypes.has(n.type)),
      links: allData.links.filter(l => {
        const src = typeof l.source === 'string' ? l.source : (l.source as GraphNode).id
        const tgt = typeof l.target === 'string' ? l.target : (l.target as GraphNode).id
        if (!nodeIds.has(src) || !nodeIds.has(tgt)) return false
        if (keepLinkTypes) return keepLinkTypes.has(l.type)
        return true
      }),
    }
  })()

  // ── Fetch ─────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetch(`/api/projects/${projectId}/kg/graph`).then(r => r.json())
      setAllData(data)
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [projectId])

  useEffect(() => { load() }, [load])

  // ── Tune physics ──────────────────────────────────────────
  useEffect(() => {
    const fg = fgRef.current
    if (!fg || graphData.nodes.length === 0) return
    fg.d3Force('charge')?.strength(-150)
    fg.d3Force('link')?.distance(70)
    fg.d3Force('center')?.strength(0.5)
    fg.d3ReheatSimulation()
  }, [graphData])

  // ── Resize observer ───────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const e of entries)
        setDimensions({ w: e.contentRect.width, h: e.contentRect.height })
    })
    ro.observe(el)
    setDimensions({ w: el.clientWidth, h: el.clientHeight })
    return () => ro.disconnect()
  }, [])

  // ── Node painter ──────────────────────────────────────────
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D) => {
    const color  = TYPE_COLOR[node.type as string] ?? '#888'
    const r      = NODE_R[node.type as string] ?? 10
    const x      = node.x as number
    const y      = node.y as number
    const isHov  = hovered?.id === node.id
    const isStory = STORY_TYPES.has(node.type as string)

    // glow
    if (isHov) {
      ctx.beginPath()
      ctx.arc(x, y, r + 6, 0, Math.PI * 2)
      ctx.fillStyle = color + '33'
      ctx.fill()
    }

    if (node.type === 'StoryArc') {
      // Large ring with thick stroke — arc-level container feel
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = color + '22'
      ctx.fill()
      ctx.strokeStyle = color
      ctx.lineWidth = isHov ? 3 : 2.5
      ctx.stroke()
    } else if (node.type === 'Act') {
      // Diamond shape
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(Math.PI / 4)
      ctx.beginPath()
      ctx.rect(-r * 0.75, -r * 0.75, r * 1.5, r * 1.5)
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = isHov ? '#fff' : color + '88'
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.restore()
    } else if (node.type === 'Chapter') {
      // Rounded square
      const s = r * 1.4
      ctx.beginPath()
      ctx.roundRect(x - s / 2, y - s / 2, s, s, 3)
      ctx.fillStyle = node.summary ? color : color + '66'  // dimmer if no summary
      ctx.fill()
      ctx.strokeStyle = isHov ? '#fff' : color + '88'
      ctx.lineWidth = 1.5
      ctx.stroke()
    } else {
      // Circle (world entities)
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = isHov ? '#fff' : color + '88'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // Label
    const lbl = String(node.label ?? node.id)
    ctx.font = isStory ? `bold 11px sans-serif` : '11px sans-serif'
    ctx.fillStyle = isHov ? '#fff' : (isStory ? color : '#aaa')
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(lbl.length > 18 ? lbl.slice(0, 17) + '…' : lbl, x, y + r + 3)
  }, [hovered])

  const countOf = (t: string) => allData.nodes.filter(n => n.type === t).length

  const layerBtnStyle = (l: LayerFilter) => ({
    ...st.btn,
    ...(layer === l ? { background: '#222', color: '#ccc', borderColor: '#555' } : {}),
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Toolbar */}
      <div style={st.toolbar}>
        <button style={st.btn} onClick={load} disabled={loading}>
          {loading ? '載入中…' : '↺ 重新整理'}
        </button>
        <span style={st.stat}>{graphData.nodes.length} nodes · {graphData.links.length} edges</span>

        {/* Layer filter */}
        <div style={st.layerGroup}>
          <button style={layerBtnStyle('all')}   onClick={() => setLayer('all')}>全部</button>
          <button style={layerBtnStyle('world')}  onClick={() => setLayer('world')}>🌍 世界</button>
          <button style={layerBtnStyle('story')}  onClick={() => setLayer('story')}>📖 敘事</button>
        </div>

        <div style={{ flex: 1 }} />

        {/* Legend */}
        <div style={st.legend}>
          {(layer !== 'story' ? WORLD_LEGEND : []).concat(layer !== 'world' ? STORY_LEGEND : []).map(({ type, label }) => (
            <span key={type} style={st.li}>
              <span style={{ ...st.dot, background: TYPE_COLOR[type] }} />
              {label}&nbsp;({countOf(type)})
            </span>
          ))}
        </div>
        <button style={st.btn} onClick={() => fgRef.current?.zoomToFit(400, 60)}>⊡ Fit</button>
      </div>

      {/* Canvas */}
      <div ref={containerRef} style={st.canvas}>
        {graphData.nodes.length === 0 && !loading
          ? <div style={st.empty}>
              {layer === 'story'
                ? '尚無故事結構，請先在 KG Manager → 架構 tab 建立故事弧與章節。'
                : '還沒有 KG 資料，請先在各 tab 新增角色、派系、地點等。'}
            </div>
          : (
            <ForceGraph2D
              ref={fgRef}
              graphData={graphData as any}
              width={dimensions.w}
              height={dimensions.h}
              backgroundColor="#0d0d0d"

              nodeCanvasObject={paintNode}
              nodeCanvasObjectMode={() => 'replace'}
              nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                const r = (NODE_R[node.type as string] ?? 10) + 4
                ctx.fillStyle = color
                ctx.beginPath()
                ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
                ctx.fill()
              }}

              linkColor={(link: any) => LINK_COLOR[link.type] ?? '#333'}
              linkWidth={(link: any) => STORY_TYPES.has((typeof link.source === 'string' ? link.source : (link.source as GraphNode).type) as string) ? 1 : 1.5}
              linkDirectionalArrowLength={5}
              linkDirectionalArrowRelPos={0.88}
              linkDirectionalArrowColor={(link: any) => LINK_COLOR[link.type] ?? '#333'}
              linkLabel={(link: any) => link.label ?? link.type}

              onNodeHover={(node: any) => setHovered(node ?? null)}
              onNodeDragEnd={(node: any) => { node.fx = node.x; node.fy = node.y }}
              onNodeClick={(node: any) => { node.fx = undefined; node.fy = undefined }}
              onEngineStop={() => fgRef.current?.zoomToFit(400, 60)}

              warmupTicks={80}
              cooldownTicks={100}
              d3AlphaDecay={0.03}
              d3VelocityDecay={0.4}
            />
          )
        }

        {/* Hover tooltip */}
        {hovered && (
          <div style={st.tooltip}>
            <div style={{ color: TYPE_COLOR[hovered.type] ?? '#888', fontSize: 10, marginBottom: 3, fontWeight: 700, letterSpacing: '0.05em' }}>
              {hovered.type.toUpperCase()}
            </div>
            <div style={{ fontWeight: 600, color: '#e0e0e0', fontSize: 14, marginBottom: 2 }}>
              {hovered.label}
            </div>
            {hovered.role   && <div style={{ color: '#888', fontSize: 11 }}>{String(hovered.role)}</div>}
            {hovered.status && hovered.type !== 'Chapter' && (
              <div style={{ color: '#888', fontSize: 11 }}>{String(hovered.status)}</div>
            )}
            {/* Chapter: show status badge + AI summary */}
            {hovered.type === 'Chapter' && (
              <>
                {hovered.status && (
                  <div style={{ fontSize: 10, color: hovered.status === 'final' ? '#4ade80' : hovered.status === 'revised' ? '#fbbf24' : '#666', marginBottom: 4 }}>
                    {String(hovered.status).toUpperCase()}
                  </div>
                )}
                {hovered.summary
                  ? <div style={{ fontSize: 11, color: '#ccc', lineHeight: 1.5, marginTop: 4, maxWidth: 260 }}>
                      {String(hovered.summary)}
                    </div>
                  : <div style={{ fontSize: 10, color: '#444', fontStyle: 'italic', marginTop: 4 }}>
                      尚無 AI 摘要（點 ✦ 生成）
                    </div>
                }
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const st: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
    padding: '7px 14px', borderBottom: '1px solid #2a2a2a', background: '#141414', flexWrap: 'wrap',
  },
  btn: { background: 'transparent', border: '1px solid #333', color: '#666', cursor: 'pointer', fontSize: 12, padding: '3px 10px', borderRadius: 4 },
  layerGroup: { display: 'flex', gap: 2 },
  stat:   { fontSize: 11, color: '#444' },
  legend: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  li:     { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#555' },
  dot:    { width: 7, height: 7, borderRadius: '50%', display: 'inline-block' },
  canvas: { flex: 1, overflow: 'hidden', position: 'relative', background: '#0d0d0d' },
  empty:  { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: 14, padding: 40, textAlign: 'center' },
  tooltip: {
    position: 'absolute', bottom: 14, left: 14, pointerEvents: 'none',
    background: '#1c1c1c', border: '1px solid #333', borderRadius: 6,
    padding: '8px 14px', boxShadow: '0 4px 20px rgba(0,0,0,0.6)', minWidth: 140, maxWidth: 280,
  },
}
