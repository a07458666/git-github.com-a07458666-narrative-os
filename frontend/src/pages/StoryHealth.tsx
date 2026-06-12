/**
 * StoryHealth — 故事健康度儀表板
 *
 * Three panels:
 *  1. 節奏曲線  — per-chapter avg tension bar chart
 *  2. 伏筆生命週期 — Gantt-style plot thread timeline
 *  3. 角色弧線進度 — arc_start → current → arc_end cards with mini timeline
 */

import { useCallback, useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { T, font, btn, badge } from '../theme'

// ── Types ────────────────────────────────────────────────────

interface PacingEntry {
  id: string; order: number; title: string; status: string
  narrative_function: string
  avg_tension: number | null; max_tension: number | null
  min_tension: number | null; scene_count: number
}

interface ArcEntry {
  id: string; name: string
  arc_start: string; arc_end: string; current_state: string
  chapter_orders: (number | null)[]
}

interface ThreadEntry {
  id: string; name: string; status: string; description: string
  planted_at: string
  planted_chapter_order: number | null; planted_chapter_title: string | null
  resolved_chapter_order: number | null; resolved_chapter_title: string | null
}

interface Stats {
  total_chapters: number; total_scenes: number
  active_threads: number; resolved_threads: number; arc_count: number
}

interface HealthData {
  pacing: PacingEntry[]; arcs: ArcEntry[]
  threads: ThreadEntry[]; stats: Stats
}

// ── Helpers ───────────────────────────────────────────────────

function tensionColor(t: number | null): string {
  if (t == null || t === 0) return T.textMuted
  if (t <= 3) return T.green
  if (t <= 6) return T.yellow
  return T.red
}

const FUNC_COLOR: Record<string, string> = {
  高潮: T.red, 轉折: T.yellow, 鋪墊: T.blue, 解決: T.green,
}

const THREAD_STATUS_LABEL: Record<string, string> = {
  active: '進行中', resolved: '已收線', abandoned: '放棄',
}

// ── Panel: 節奏曲線 ───────────────────────────────────────────

function PacingChart({ pacing }: { pacing: PacingEntry[] }) {
  const [hovered, setHovered] = useState<PacingEntry | null>(null)
  const BAR_AREA_H = 88
  const BAR_W = 32

  if (pacing.length === 0) return <Empty text="尚無章節資料" />

  const tensions = pacing.map(p => p.avg_tension ?? 0).filter(t => t > 0)
  const globalAvg = tensions.length > 0
    ? tensions.reduce((a, b) => a + b, 0) / tensions.length
    : 0
  const avgLineY = globalAvg > 0
    ? BAR_AREA_H - Math.round((globalAvg / 10) * BAR_AREA_H)
    : null

  return (
    <div>
      {/* Tooltip */}
      <div style={{ height: 28, marginBottom: 4, display: 'flex', alignItems: 'center' }}>
        {hovered ? (
          <span style={{ fontSize: font.sizes.xs, color: T.textSecondary }}>
            第 {hovered.order} 章《{hovered.title}》
            {hovered.avg_tension != null
              ? ` — 平均張力 ${hovered.avg_tension.toFixed(1)} ／ 最高 ${hovered.max_tension}`
              : ' — 尚無場景'}
            {hovered.narrative_function && ` ／ ${hovered.narrative_function}`}
          </span>
        ) : (
          <span style={{ fontSize: font.sizes.xs, color: T.textMuted }}>
            滑入查看章節詳情
            {globalAvg > 0 && ` · 全篇平均張力 ${globalAvg.toFixed(1)}`}
          </span>
        )}
      </div>

      {/* Chart */}
      <div style={{ overflowX: 'auto', paddingBottom: 6 }}>
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 3,
          width: pacing.length * (BAR_W + 3),
          position: 'relative',
        }}>
          {/* Average dashed line */}
          {avgLineY != null && (
            <div style={{
              position: 'absolute', left: 0, right: 0,
              top: avgLineY,
              borderTop: `1px dashed ${T.textMuted}44`,
              pointerEvents: 'none', zIndex: 1,
            }} />
          )}

          {pacing.map(ch => {
            const t = ch.avg_tension
            const barH = t != null && t > 0
              ? Math.max(4, Math.round((t / 10) * BAR_AREA_H))
              : 0
            const empty = ch.scene_count === 0
            const funcColor = FUNC_COLOR[ch.narrative_function] ?? null

            return (
              <div
                key={ch.id}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: BAR_W, flexShrink: 0 }}
                onMouseEnter={() => setHovered(ch)}
                onMouseLeave={() => setHovered(null)}
              >
                {/* Narrative function marker */}
                <div style={{ height: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {funcColor && (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: funcColor }} />
                  )}
                </div>

                {/* Bar column */}
                <div style={{ width: BAR_W, height: BAR_AREA_H, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', position: 'relative' }}>
                  {empty ? (
                    <div style={{
                      width: '75%', margin: '0 auto', height: 4,
                      background: T.border, borderRadius: 2,
                      border: `1px dashed ${T.border}`,
                    }} />
                  ) : (
                    <div style={{
                      width: '75%', margin: '0 auto', height: barH,
                      background: tensionColor(t),
                      borderRadius: '3px 3px 0 0',
                      opacity: 0.85,
                      boxShadow: hovered?.id === ch.id ? `0 0 8px ${tensionColor(t)}88` : 'none',
                      transition: 'box-shadow 0.15s',
                    }} />
                  )}
                </div>

                {/* Chapter order */}
                <div style={{ fontSize: 9, color: hovered?.id === ch.id ? T.textSecondary : T.textMuted, marginTop: 3, lineHeight: 1 }}>
                  {ch.order}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
        {([['≤3 低張力', T.green], ['4-6 中張力', T.yellow], ['≥7 高張力', T.red]] as [string, string][]).map(([label, color]) => (
          <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: T.textMuted }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: color, opacity: 0.85 }} />
            {label}
          </span>
        ))}
        {Object.entries(FUNC_COLOR).map(([fn, color]) => (
          <span key={fn} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: T.textMuted }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
            {fn}
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: T.textMuted }}>
          <span style={{ width: 12, borderTop: `1px dashed ${T.textMuted}44`, display: 'inline-block' }} />
          全篇平均
        </span>
      </div>
    </div>
  )
}

// ── Panel: 伏筆生命週期 ───────────────────────────────────────

function ThreadTimeline({ threads, totalChapters }: { threads: ThreadEntry[], totalChapters: number }) {
  if (threads.length === 0) return <Empty text="尚無伏筆資料" />
  if (totalChapters === 0) return <Empty text="尚無章節，無法顯示時間軸" />

  const SLOT_W = 36
  const ROW_H  = 44
  const LEFT_W = 220

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ display: 'flex', minWidth: LEFT_W + totalChapters * SLOT_W }}>

        {/* Left: thread name + status */}
        <div style={{ width: LEFT_W, flexShrink: 0 }}>
          <div style={{ height: 22, borderBottom: `1px solid ${T.border}` }} />
          {threads.map(t => {
            const isLate = t.status === 'active'
              && t.planted_chapter_order != null
              && totalChapters >= 5
              && t.planted_chapter_order <= totalChapters * 0.7
            return (
              <div key={t.id} style={{
                height: ROW_H, display: 'flex', alignItems: 'center', gap: 7,
                paddingRight: 12, borderBottom: `1px solid ${T.border}22`,
              }}>
                <span style={{
                  ...badge(
                    t.status === 'resolved' ? T.green
                      : t.status === 'abandoned' ? T.textMuted
                      : T.yellow,
                    t.status === 'resolved' ? T.greenDim
                      : t.status === 'abandoned' ? T.bgOverlay
                      : T.yellowDim,
                  ),
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>
                  {THREAD_STATUS_LABEL[t.status] ?? t.status}
                </span>
                <span style={{
                  fontSize: font.sizes.sm, color: T.textPrimary,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                }}>
                  {t.name}
                </span>
                {isLate && (
                  <span title="伏筆未收線，建議在結尾前安排解決" style={{ flexShrink: 0, fontSize: 12 }}>⚠️</span>
                )}
              </div>
            )
          })}
        </div>

        {/* Right: Gantt bars */}
        <div style={{ flex: 1, overflowX: 'auto' }}>
          {/* Chapter ruler */}
          <div style={{
            display: 'flex', height: 22,
            borderBottom: `1px solid ${T.border}`,
          }}>
            {Array.from({ length: totalChapters }, (_, i) => (
              <div key={i} style={{
                width: SLOT_W, flexShrink: 0, textAlign: 'center',
                fontSize: 9, color: T.textMuted,
                borderLeft: `1px solid ${T.border}44`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {i + 1}
              </div>
            ))}
          </div>

          {/* Thread rows */}
          {threads.map(t => {
            const startOrder = t.planted_chapter_order ?? 1
            const endOrder   = t.resolved_chapter_order ?? totalChapters
            const startX = (startOrder - 1) * SLOT_W
            const barW   = Math.max(SLOT_W, (endOrder - startOrder + 1) * SLOT_W)
            const barColor = t.status === 'resolved' ? T.green
              : t.status === 'abandoned' ? T.textMuted
              : T.yellow
            const isOngoing = !t.resolved_chapter_order && t.status === 'active'

            return (
              <div key={t.id} style={{
                height: ROW_H, position: 'relative',
                width: totalChapters * SLOT_W,
                borderBottom: `1px solid ${T.border}22`,
              }}>
                {/* Grid lines */}
                {Array.from({ length: totalChapters }, (_, i) => (
                  <div key={i} style={{
                    position: 'absolute', left: i * SLOT_W, top: 0, bottom: 0,
                    width: 1, background: `${T.border}44`,
                  }} />
                ))}
                {/* Bar */}
                <div
                  title={`${t.name}\n種植：${t.planted_chapter_order != null ? `第 ${t.planted_chapter_order} 章` : '未記錄'}${t.resolved_chapter_order != null ? `\n收線：第 ${t.resolved_chapter_order} 章` : '\n（未收線）'}`}
                  style={{
                    position: 'absolute',
                    left: startX, top: '50%', transform: 'translateY(-50%)',
                    width: isOngoing ? totalChapters * SLOT_W - startX : barW,
                    height: 16,
                    background: barColor,
                    opacity: isOngoing ? 0.5 : 0.75,
                    borderRadius: 3,
                    borderRight: isOngoing ? `2px dashed ${barColor}` : 'none',
                    backgroundImage: isOngoing
                      ? `repeating-linear-gradient(90deg, transparent, transparent 6px, ${T.bgBase}44 6px, ${T.bgBase}44 8px)`
                      : 'none',
                  }}
                />
                {/* Start dot */}
                <div style={{
                  position: 'absolute',
                  left: startX + 2, top: '50%', transform: 'translateY(-50%)',
                  width: 8, height: 8, borderRadius: '50%',
                  background: barColor, border: `2px solid ${T.bgElevated}`,
                }} />
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Panel: 角色弧線進度 ───────────────────────────────────────

function ArcCards({ arcs, totalChapters }: { arcs: ArcEntry[], totalChapters: number }) {
  if (arcs.length === 0) {
    return <Empty text="尚無設定弧線（arc_start + arc_end）的角色" />
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 12 }}>
      {arcs.map(arc => {
        const appearances = arc.chapter_orders
          .filter((o): o is number => o != null)
          .sort((a, b) => a - b)
        const lastAppearance = appearances.length > 0 ? appearances[appearances.length - 1] : 0
        const completionPct = totalChapters > 0 ? (lastAppearance / totalChapters) * 100 : 0
        const hasWarning = appearances.length === 0 || (completionPct < 65 && totalChapters >= 5)

        return (
          <div key={arc.id} style={{
            background: T.bgRaised, border: `1px solid ${hasWarning ? T.yellow + '55' : T.border}`,
            borderRadius: 10, padding: '14px 16px',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            {/* Name */}
            <div style={{ fontSize: font.sizes.md, fontWeight: 700, color: T.textPrimary }}>
              🎭 {arc.name}
            </div>

            {/* Arc flow */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <ArcRow label="起" color={T.blue}    text={arc.arc_start} />
              {arc.current_state && (
                <ArcRow label="現" color={T.yellow} text={arc.current_state} />
              )}
              <ArcRow label="終" color={T.green}   text={arc.arc_end} />
            </div>

            {/* Mini chapter dot timeline */}
            {totalChapters > 0 && (
              <div style={{ position: 'relative', height: 18, marginTop: 2 }}>
                {/* Track */}
                <div style={{
                  position: 'absolute', left: 0, right: 0, top: '50%',
                  height: 2, background: T.bgOverlay, transform: 'translateY(-50%)',
                }} />
                {/* End marker */}
                <div style={{
                  position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)',
                  width: 6, height: 6, borderRadius: '50%', background: T.border,
                }} />
                {/* Appearance dots */}
                {appearances.map(order => (
                  <div
                    key={order}
                    title={`第 ${order} 章`}
                    style={{
                      position: 'absolute',
                      left: `${((order - 1) / totalChapters) * 100}%`,
                      top: '50%', transform: 'translate(-50%, -50%)',
                      width: 8, height: 8, borderRadius: '50%',
                      background: T.accent,
                      border: `1px solid ${T.bgRaised}`,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Warning / completion info */}
            {appearances.length > 0 ? (
              <div style={{ fontSize: font.sizes.xs, color: hasWarning ? T.yellow : T.textMuted }}>
                {hasWarning ? '⚠ ' : ''}
                {appearances.length} 個 POV 場景 · 最後出現於 {completionPct.toFixed(0)}% 處
                {hasWarning && totalChapters >= 5 && ' — 弧線可能尚未完成'}
              </div>
            ) : (
              <div style={{ fontSize: font.sizes.xs, color: T.red }}>
                ⚠ 未找到此角色的 POV 場景記錄
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function ArcRow({ label, color, text }: { label: string; color: string; text: string }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
      <span style={{
        fontSize: 10, fontWeight: 700, color,
        background: `${color}22`, borderRadius: 4,
        padding: '1px 5px', flexShrink: 0, marginTop: 1,
      }}>
        {label}
      </span>
      <span style={{ fontSize: font.sizes.sm, color: T.textSecondary, lineHeight: 1.5 }}>
        {text}
      </span>
    </div>
  )
}

// ── Shared empty state ────────────────────────────────────────

function Empty({ text }: { text: string }) {
  return (
    <div style={{ padding: '20px 0', fontSize: font.sizes.sm, color: T.textMuted }}>
      {text}
    </div>
  )
}

// ── Stat chip ─────────────────────────────────────────────────

function StatChip({ value, label, warn }: { value: number; label: string; warn?: boolean }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 2, padding: '8px 16px',
      background: T.bgRaised, border: `1px solid ${warn ? T.yellow + '66' : T.border}`,
      borderRadius: 8,
    }}>
      <span style={{ fontSize: font.sizes.xl, fontWeight: 700, color: warn ? T.yellow : T.textPrimary }}>
        {value}
      </span>
      <span style={{ fontSize: font.sizes.xs, color: T.textMuted }}>{label}</span>
    </div>
  )
}

// ── Panel wrapper ─────────────────────────────────────────────

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      width: '100%', maxWidth: 900,
      background: T.bgElevated, border: `1px solid ${T.border}`,
      borderRadius: 12, padding: '18px 22px',
    }}>
      <div style={{
        fontSize: font.sizes.base, fontWeight: 700, color: T.textPrimary,
        marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {title}
      </div>
      {children}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────

export default function StoryHealth() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()

  const [data, setData]               = useState<HealthData | null>(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [projectName, setProjectName] = useState('')

  const load = useCallback(async () => {
    if (!projectId) return
    setLoading(true); setError(null)
    try {
      const [proj, health] = await Promise.all([
        fetch(`/api/projects/${projectId}`).then(r => { if (!r.ok) throw new Error(); return r.json() }),
        fetch(`/api/projects/${projectId}/story-health`).then(r => { if (!r.ok) throw new Error(); return r.json() }),
      ])
      setProjectName(proj.name ?? '')
      setData(health)
    } catch {
      setError('載入失敗，請確認後端連線')
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => { load() }, [load])

  const s = data?.stats
  const totalChapters = s?.total_chapters ?? 0

  return (
    <div style={sc.page}>
      {/* Toolbar */}
      <div style={sc.toolbar}>
        <button style={btn.ghost} onClick={() => navigate(`/project/${projectId}/kg`)}>← KG</button>
        <button style={btn.ghost} onClick={() => navigate(`/project/${projectId}/timeline`)}>📅 時間軸</button>
        <button style={btn.ghost} onClick={() => navigate(`/workspace/${projectId}`)}>✏ Workspace</button>
        <div style={sc.sep} />
        <span style={sc.title}>🩺 故事健康度</span>
        {projectName && <span style={sc.projName}>{projectName}</span>}
        <div style={{ flex: 1 }} />
        <button style={btn.secondary} onClick={load} disabled={loading}>
          {loading ? '載入中…' : '↺ 重新整理'}
        </button>
      </div>

      {/* Body */}
      <div style={sc.body}>
        {error && <div style={sc.errorBox}>{error}</div>}
        {!error && loading && <div style={sc.loading}>載入中…</div>}
        {!error && !loading && data && (
          <>
            {/* Stats row */}
            <div style={sc.statsRow}>
              <StatChip value={s!.total_chapters} label="章節" />
              <StatChip value={s!.total_scenes}   label="場景" />
              <StatChip value={s!.active_threads}  label="進行中伏筆" warn={s!.active_threads > 0} />
              <StatChip value={s!.resolved_threads} label="已收線伏筆" />
              <StatChip value={s!.arc_count}       label="角色弧線" />
            </div>

            {/* Panel 1: Pacing */}
            <Panel title="📈 節奏曲線 — 章節張力分布">
              <PacingChart pacing={data.pacing} />
            </Panel>

            {/* Panel 2: Plot threads */}
            <Panel title="🧵 伏筆生命週期">
              <ThreadTimeline threads={data.threads} totalChapters={totalChapters} />
            </Panel>

            {/* Panel 3: Character arcs */}
            <Panel title="🎭 角色弧線進度">
              <ArcCards arcs={data.arcs} totalChapters={totalChapters} />
            </Panel>
          </>
        )}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────

const sc: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex', flexDirection: 'column', height: '100vh',
    background: T.bgBase, fontFamily: "'Inter', system-ui, sans-serif", overflow: 'hidden',
  },
  toolbar: {
    height: 48, borderBottom: `1px solid ${T.border}`,
    display: 'flex', alignItems: 'center', padding: '0 20px', gap: 10,
    flexShrink: 0, background: T.bgElevated,
  },
  sep:      { width: 1, height: 20, background: T.border },
  title:    { fontSize: font.sizes.base, fontWeight: 700, color: T.textPrimary },
  projName: { fontSize: font.sizes.sm, color: T.textMuted },

  body: {
    flex: 1, overflowY: 'auto',
    padding: '28px 40px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20,
  },
  statsRow: {
    display: 'flex', gap: 10, flexWrap: 'wrap',
    width: '100%', maxWidth: 900,
  },
  loading: { marginTop: 80, fontSize: font.sizes.base, color: T.textMuted },
  errorBox: {
    marginTop: 40, padding: '12px 20px',
    background: T.redDim, border: `1px solid ${T.red}44`,
    borderRadius: 8, color: T.red, fontSize: font.sizes.sm,
  },
}
