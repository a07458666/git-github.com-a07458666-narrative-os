/**
 * KGGraph — force-directed KG visualisation using react-force-graph-2d.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'

/* eslint-disable @typescript-eslint/no-explicit-any */

interface GraphNode {
  id: string
  label: string
  type: string
  role?: string
  status?: string
  [key: string]: unknown
}

interface GraphLink {
  source: string | GraphNode
  target: string | GraphNode
  type: string
  label?: string
}

interface Props { projectId: string }

const TYPE_COLOR: Record<string, string> = {
  Character:  '#4a9eff',
  Faction:    '#a855f7',
  Location:   '#4ade80',
  PlotThread: '#fbbf24',
  Artifact:   '#f97316',
}

const LINK_COLOR: Record<string, string> = {
  RELATES_TO:          '#4a9eff',
  FACTION_RELATES_TO:  '#a855f7',
  MEMBER_OF:           '#4ade80',
  OWNED_BY:            '#f97316',
}

const LEGEND = [
  { type: 'Character',  label: '角色' },
  { type: 'Faction',    label: '派系' },
  { type: 'Location',   label: '地點' },
  { type: 'PlotThread', label: '伏筆' },
  { type: 'Artifact',   label: '器物' },
]

const NODE_R = 10

export default function KGGraph({ projectId }: Props) {
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] })
  const [loading, setLoading]   = useState(false)
  const [hovered, setHovered]   = useState<GraphNode | null>(null)
  const [dimensions, setDimensions] = useState({ w: 800, h: 600 })
  const containerRef = useRef<HTMLDivElement>(null)
  const fgRef        = useRef<any>(null)

  // ── Fetch ────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetch(`/api/projects/${projectId}/kg/graph`).then(r => r.json())
      setGraphData(data)
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [projectId])

  useEffect(() => { load() }, [load])

  // ── Tune force simulation after data loads ────────────────
  useEffect(() => {
    const fg = fgRef.current
    if (!fg || graphData.nodes.length === 0) return
    fg.d3Force('charge')?.strength(-120)   // mild repulsion
    fg.d3Force('link')?.distance(60)       // shorter links
    fg.d3Force('center')?.strength(0.6)    // stronger pull to center
    fg.d3ReheatSimulation()
  }, [graphData])

  // ── Resize observer ──────────────────────────────────────
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

  // ── Node canvas: circle + always-visible label ────────────
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D) => {
    const color = TYPE_COLOR[node.type as string] ?? '#888'
    const x = node.x as number
    const y = node.y as number
    const isHov = hovered?.id === node.id

    // glow on hover
    if (isHov) {
      ctx.beginPath()
      ctx.arc(x, y, NODE_R + 6, 0, Math.PI * 2)
      ctx.fillStyle = color + '33'
      ctx.fill()
    }

    // circle
    ctx.beginPath()
    ctx.arc(x, y, NODE_R, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    ctx.strokeStyle = isHov ? '#fff' : color + '88'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // label below node
    const lbl = String(node.label ?? node.id)
    ctx.font = '11px sans-serif'
    ctx.fillStyle = isHov ? '#fff' : '#aaa'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(lbl, x, y + NODE_R + 3)
  }, [hovered])

  const countOf = (t: string) => graphData.nodes.filter(n => n.type === t).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Toolbar */}
      <div style={st.toolbar}>
        <button style={st.btn} onClick={load} disabled={loading}>
          {loading ? '載入中…' : '↺ 重新整理'}
        </button>
        <span style={st.stat}>{graphData.nodes.length} nodes · {graphData.links.length} edges</span>
        <div style={{ flex: 1 }} />
        <div style={st.legend}>
          {LEGEND.map(({ type, label }) => (
            <span key={type} style={st.li}>
              <span style={{ ...st.dot, background: TYPE_COLOR[type] }} />
              {label}&nbsp;({countOf(type)})
            </span>
          ))}
        </div>
        <button style={st.btn} onClick={() => fgRef.current?.zoomToFit(400, 60)}>⊡ Fit</button>
      </div>

      {/* Canvas area */}
      <div ref={containerRef} style={st.canvas}>
        {graphData.nodes.length === 0 && !loading
          ? <div style={st.empty}>還沒有 KG 資料，請先在各 tab 新增角色、派系、地點等。</div>
          : (
            <ForceGraph2D
              ref={fgRef}
              graphData={graphData as any}
              width={dimensions.w}
              height={dimensions.h}
              backgroundColor="#0d0d0d"

              /* Custom node: circle + label */
              nodeCanvasObject={paintNode}
              nodeCanvasObjectMode={() => 'replace'}
              nodePointerAreaPaint={(node: any, color: string, ctx: CanvasRenderingContext2D) => {
                ctx.fillStyle = color
                ctx.beginPath()
                ctx.arc(node.x, node.y, NODE_R + 4, 0, Math.PI * 2)
                ctx.fill()
              }}

              /* Links */
              linkColor={(link: any) => LINK_COLOR[link.type] ?? '#444'}
              linkWidth={1.5}
              linkDirectionalArrowLength={5}
              linkDirectionalArrowRelPos={0.88}
              linkDirectionalArrowColor={(link: any) => LINK_COLOR[link.type] ?? '#444'}
              linkLabel={(link: any) => link.label ?? link.type}

              /* Interaction */
              onNodeHover={(node: any) => setHovered(node ?? null)}
              onNodeDragEnd={(node: any) => { node.fx = node.x; node.fy = node.y }}
              onNodeClick={(node: any) => { node.fx = undefined; node.fy = undefined }}
              onEngineStop={() => fgRef.current?.zoomToFit(400, 60)}

              /* Physics */
              warmupTicks={80}
              cooldownTicks={100}
              d3AlphaDecay={0.03}
              d3VelocityDecay={0.4}
            />
          )
        }

        {/* Hover tooltip — bottom-left */}
        {hovered && (
          <div style={st.tooltip}>
            <div style={{ color: TYPE_COLOR[hovered.type] ?? '#888', fontSize: 10, marginBottom: 3, fontWeight: 700, letterSpacing: '0.05em' }}>
              {hovered.type.toUpperCase()}
            </div>
            <div style={{ fontWeight: 600, color: '#e0e0e0', fontSize: 14 }}>{hovered.label}</div>
            {hovered.role   && <div style={{ color: '#888', fontSize: 11, marginTop: 3 }}>{String(hovered.role)}</div>}
            {hovered.status && <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>{String(hovered.status)}</div>}
          </div>
        )}
      </div>
    </div>
  )
}

const st: Record<string, React.CSSProperties> = {
  toolbar: {
    display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
    padding: '7px 14px', borderBottom: '1px solid #2a2a2a', background: '#141414',
  },
  btn:  { background: 'transparent', border: '1px solid #333', color: '#666', cursor: 'pointer', fontSize: 12, padding: '3px 10px', borderRadius: 4 },
  stat: { fontSize: 11, color: '#444' },
  legend: { display: 'flex', gap: 10 },
  li:   { display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#555' },
  dot:  { width: 7, height: 7, borderRadius: '50%', display: 'inline-block' },
  canvas: { flex: 1, overflow: 'hidden', position: 'relative', background: '#0d0d0d' },
  empty: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#333', fontSize: 14 },
  tooltip: {
    position: 'absolute', bottom: 14, left: 14, pointerEvents: 'none',
    background: '#1c1c1c', border: '1px solid #333', borderRadius: 6,
    padding: '8px 14px', boxShadow: '0 4px 20px rgba(0,0,0,0.6)', minWidth: 110,
  },
}
