import type { CSSProperties } from 'react'
import { T, font } from '../../theme'

export const inp: CSSProperties = {
  background: T.bgRaised,
  border: `1px solid ${T.border}`,
  borderRadius: 6,
  padding: '7px 11px',
  color: T.textPrimary,
  fontSize: font.sizes.base,
  outline: 'none',
  width: '100%',
  fontFamily: 'inherit',
  lineHeight: '1.5',
}

export const ta: CSSProperties = {
  ...inp,
  resize: 'vertical',
}

export const label: CSSProperties = {
  fontSize: font.sizes.xs,
  color: T.textMuted,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: 5,
  display: 'block',
}

export const sectionTitle: CSSProperties = {
  fontSize: font.sizes.xs,
  fontWeight: 700,
  color: T.accent,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginTop: 20,
  marginBottom: 10,
  borderBottom: `1px solid ${T.accentDim}`,
  paddingBottom: 5,
}

export const saveBtn: CSSProperties = {
  background: T.greenDim,
  border: '1px solid #1f6b3a',
  color: T.green,
  padding: '6px 16px',
  borderRadius: 6,
  fontSize: font.sizes.base,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

export const cancelBtn: CSSProperties = {
  background: T.bgRaised,
  border: `1px solid ${T.border}`,
  color: T.textSecondary,
  padding: '6px 12px',
  borderRadius: 6,
  fontSize: font.sizes.base,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

export const formGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '0 16px',
}

export const s: Record<string, CSSProperties> = {
  card: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    background: T.bgElevated,
    overflow: 'hidden',
  },
  cardHeader: {
    padding: '14px 20px',
    borderBottom: `1px solid ${T.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
    background: T.bgElevated,
  },
  cardTitle: {
    fontSize: font.sizes.md,
    fontWeight: 600,
    color: T.textPrimary,
  },
  error: {
    color: T.red,
    fontSize: font.sizes.sm,
    padding: '8px 20px',
    background: T.redDim + '40',
  },
  scrollArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
  },
  emptyCard: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: T.textMuted,
    fontSize: font.sizes.md,
    background: T.bgElevated,
  },
}
