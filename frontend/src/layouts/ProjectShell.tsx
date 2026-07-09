/**
 * ProjectShell — unified navigation shell for all project-scoped pages.
 *
 * Renders a persistent top bar with project name + tab navigation, then
 * delegates content rendering to React Router's <Outlet />.
 *
 * Tab routing:
 *   /project/:id            → Overview
 *   /project/:id/write      → Workspace
 *   /project/:id/plan       → Timeline
 *   /project/:id/world      → KGManager
 *   /project/:id/analyze    → StoryHealth
 */

import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate, useParams } from 'react-router-dom'
import { T, font, btn } from '../theme'
import type { CSSProperties } from 'react'

const TABS = [
  { path: '',        label: '📊 概覽',   exact: true },
  { path: 'write',   label: '✏ 寫作'   },
  { path: 'plan',    label: '📅 規劃'   },
  { path: 'world',   label: '🌍 世界'   },
  { path: 'analyze', label: '🩺 分析'   },
]

export default function ProjectShell() {
  const { projectId }   = useParams<{ projectId: string }>()
  const navigate        = useNavigate()
  const location        = useLocation()
  const [projectName, setProjectName] = useState('')

  useEffect(() => {
    if (!projectId) return
    fetch(`/api/projects/${projectId}`)
      .then(r => r.json())
      .then(d => setProjectName(d.name ?? ''))
      .catch(() => {})
  }, [projectId])

  function isActive(tab: typeof TABS[0]): boolean {
    const base = `/project/${projectId}`
    if (tab.exact) return location.pathname === base || location.pathname === `${base}/`
    return location.pathname.startsWith(`${base}/${tab.path}`)
  }

  return (
    <div style={sh.root}>
      {/* ── Shell nav bar ────────────────────────────────── */}
      <div style={sh.nav}>
        <button style={sh.logo} onClick={() => navigate('/')}>NarrativeOS</button>
        <div style={sh.logoSep} />
        <span style={sh.projName}>{projectName}</span>

        <div style={{ flex: 1 }} />

        <div style={sh.tabs}>
          {TABS.map(tab => (
            <button
              key={tab.path}
              style={{ ...sh.tab, ...(isActive(tab) ? sh.tabActive : {}) }}
              onClick={() => navigate(`/project/${projectId}/${tab.path}`)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />
        <button style={btn.ghost} onClick={() => navigate('/logs')}>📋 Logs</button>
      </div>

      {/* ── Content area ────────────────────────────────── */}
      <div style={sh.content}>
        <Outlet />
      </div>
    </div>
  )
}

// ── Styles ──────────────────────────────────────────────────

const sh: Record<string, CSSProperties> = {
  root: {
    display: 'flex', flexDirection: 'column', height: '100vh',
    background: T.bgBase, overflow: 'hidden',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  nav: {
    height: 48, flexShrink: 0,
    background: T.bgElevated, borderBottom: `1px solid ${T.border}`,
    display: 'flex', alignItems: 'center', padding: '0 16px', gap: 10,
  },
  logo: {
    ...btn.ghost,
    fontSize: font.sizes.base, fontWeight: 700,
    color: T.textPrimary, letterSpacing: '-0.3px',
    padding: '4px 0',
  } as CSSProperties,
  logoSep: {
    width: 1, height: 18, background: T.border, flexShrink: 0,
  },
  projName: {
    fontSize: font.sizes.sm, color: T.textSecondary,
    maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  tabs: {
    display: 'flex', gap: 2, alignItems: 'center',
  },
  tab: {
    background: 'transparent', border: 'none',
    color: T.textMuted, cursor: 'pointer',
    fontSize: font.sizes.sm, fontWeight: 500,
    padding: '5px 13px', borderRadius: 6,
    fontFamily: "'Inter', system-ui, sans-serif",
    transition: 'background 0.12s, color 0.12s',
  },
  tabActive: {
    background: T.accentDim,
    color: T.accent,
    fontWeight: 600,
  },
  content: {
    flex: 1, overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
  },
}
