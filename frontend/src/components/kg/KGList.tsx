import type { CSSProperties } from 'react'

interface KGListItem {
  id: string
  name: string
}

interface Props<T extends KGListItem> {
  items: T[]
  selectedId: string | null
  onSelect: (item: T) => void
  onNew: () => void
  onDelete?: (id: string) => void
  renderMeta?: (item: T) => React.ReactNode
  label: string
  loading?: boolean
}

export default function KGList<T extends KGListItem>({
  items, selectedId, onSelect, onNew, onDelete, renderMeta, label, loading,
}: Props<T>) {
  return (
    <div style={s.panel}>
      <div style={s.header}>
        <span style={s.label}>{label}</span>
        <button style={s.newBtn} onClick={onNew}>+ New</button>
      </div>
      <div style={s.list}>
        {loading && <p style={s.muted}>Loading…</p>}
        {!loading && items.length === 0 && (
          <p style={s.muted}>No {label.toLowerCase()} yet.</p>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              ...s.item,
              ...(selectedId === item.id ? s.selected : {}),
            }}
            onClick={() => onSelect(item)}
          >
            <div style={s.itemRow}>
              <span style={s.name}>{item.name}</span>
              {onDelete && (
                <button
                  style={s.delBtn}
                  onClick={(e) => { e.stopPropagation(); onDelete(item.id) }}
                  title="Delete"
                >
                  ×
                </button>
              )}
            </div>
            {renderMeta && <div style={s.meta}>{renderMeta(item)}</div>}
          </div>
        ))}
      </div>
    </div>
  )
}

const s: Record<string, CSSProperties> = {
  panel: {
    width: 220, flexShrink: 0,
    borderRight: '1px solid #2a2a2a',
    display: 'flex', flexDirection: 'column',
    background: '#141414', overflowY: 'hidden',
  },
  header: {
    padding: '12px 14px', borderBottom: '1px solid #2a2a2a',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  label: { fontSize: 12, fontWeight: 600, color: '#666', textTransform: 'uppercase', letterSpacing: '0.08em' },
  newBtn: {
    background: '#1a4a2a', border: '1px solid #2a6a3a',
    color: '#86efac', fontSize: 12, padding: '3px 10px',
    borderRadius: 4, cursor: 'pointer',
  },
  list: { flex: 1, overflowY: 'auto', padding: '6px 0' },
  muted: { color: '#444', fontSize: 13, padding: '12px 14px' },
  item: {
    padding: '8px 14px', cursor: 'pointer',
    borderLeft: '2px solid transparent',
  },
  selected: {
    background: '#1a1f1a', borderLeft: '2px solid #4ade80',
  },
  itemRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 13, color: '#ccc' },
  delBtn: {
    background: 'transparent', border: 'none',
    color: '#555', cursor: 'pointer', fontSize: 16,
    lineHeight: 1, padding: '0 2px',
  },
  meta: { fontSize: 11, color: '#555', marginTop: 2 },
}
