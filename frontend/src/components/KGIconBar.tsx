/**
 * KGIconBar — VS Code Activity Bar style.
 * A narrow vertical strip of icons between the editor and Director panel.
 * Clicking an icon toggles the corresponding KGContextPanel.
 * Clicking the active icon closes the panel.
 */
import { T } from '../theme'
import type { KGPanelTab } from './KGContextPanel'

interface Props {
  active: KGPanelTab | null
  onToggle: (tab: KGPanelTab) => void
}

const ICONS: { tab: KGPanelTab; icon: string; label: string }[] = [
  { tab: 'chars', icon: '👤', label: '角色' },
  { tab: 'world', icon: '🌍', label: '世界' },
  { tab: 'plot',  icon: '📖', label: '伏筆' },
]

export default function KGIconBar({ active, onToggle }: Props) {
  return (
    <div style={st.bar}>
      {ICONS.map(({ tab, icon, label }) => {
        const isActive = active === tab
        return (
          <button
            key={tab}
            style={{
              ...st.iconBtn,
              background: isActive ? T.accentDim : 'transparent',
              borderLeft: isActive ? `2px solid ${T.accent}` : '2px solid transparent',
              color: isActive ? T.accent : T.textMuted,
            }}
            title={label}
            onClick={() => onToggle(tab)}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>{icon}</span>
            <span style={st.label}>{label}</span>
          </button>
        )
      })}
    </div>
  )
}

const st: Record<string, React.CSSProperties> = {
  bar: {
    width: 48,
    borderLeft: `1px solid ${T.border}`,
    background: T.bgElevated,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 8,
    gap: 2,
    flexShrink: 0,
  },
  iconBtn: {
    width: '100%',
    border: 'none',
    borderRight: 'none',
    borderTop: 'none',
    borderBottom: 'none',
    cursor: 'pointer',
    padding: '10px 0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    transition: 'background 0.15s, color 0.15s',
  },
  label: {
    fontSize: 9,
    fontWeight: 600,
    letterSpacing: '0.04em',
  },
}
