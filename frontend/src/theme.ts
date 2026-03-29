/**
 * NarrativeOS Design System — single source of truth for all colours, spacing, and typography.
 * Based on Linear's warm-gray dark palette + Indigo accent.
 *
 * Usage:
 *   import { T, btn, inp } from '../theme'
 *   <div style={{ background: T.bgBase, color: T.textPrimary }}>
 */
import type { CSSProperties } from 'react'

// ─────────────────────────────────────────────
// Colour tokens
// ─────────────────────────────────────────────

export const T = {
  // Background layers (4-step depth, warm-gray)
  bgBase:     '#1C1B22',   // main page background
  bgElevated: '#252430',   // sidebar, panels
  bgRaised:   '#2E2C3A',   // cards, hover
  bgOverlay:  '#3A3848',   // active selection, tooltip bg

  // Text
  textPrimary:   '#F0EEF8',   // headings, important labels
  textSecondary: '#9C99B0',   // meta, secondary labels
  textMuted:     '#5C5A6E',   // placeholder, disabled
  textLink:      '#7C6FFF',   // clickable links

  // Borders
  border:      '#2A2838',   // default border
  borderLight: '#343244',   // hover/active border

  // Accent — Indigo
  accent:       '#7C6FFF',
  accentDim:    '#2D2660',
  accentBorder: '#4D43A8',
  accentHover:  '#6457E8',

  // Semantic
  green:     '#4ADE80',
  greenDim:  '#14532D',
  yellow:    '#FBBF24',
  yellowDim: '#78350F',
  red:       '#F87171',
  redDim:    '#7F1D1D',
  blue:      '#60A5FA',
  blueDim:   '#1E3A5F',
} as const

// ─────────────────────────────────────────────
// Typography
// ─────────────────────────────────────────────

export const font = {
  family: "'Inter', system-ui, sans-serif",
  mono:   "'Geist Mono', 'Fira Code', monospace",
  sizes: {
    xs:   11,
    sm:   12,
    base: 14,
    md:   15,
    lg:   16,
    xl:   18,
    '2xl': 22,
    '3xl': 28,
  },
} as const

// ─────────────────────────────────────────────
// Spacing
// ─────────────────────────────────────────────

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
} as const

// ─────────────────────────────────────────────
// Reusable component style factories
// ─────────────────────────────────────────────

/** Button variants */
export const btn = {
  primary: {
    background: T.accentDim,
    border: `1px solid ${T.accentBorder}`,
    color: T.accent,
    cursor: 'pointer',
    fontSize: font.sizes.sm,
    fontWeight: 600,
    padding: '5px 14px',
    borderRadius: 6,
    fontFamily: font.family,
  } as CSSProperties,

  secondary: {
    background: T.bgRaised,
    border: `1px solid ${T.border}`,
    color: T.textSecondary,
    cursor: 'pointer',
    fontSize: font.sizes.sm,
    fontWeight: 500,
    padding: '5px 12px',
    borderRadius: 6,
    fontFamily: font.family,
  } as CSSProperties,

  ghost: {
    background: 'transparent',
    border: 'none',
    color: T.textMuted,
    cursor: 'pointer',
    fontSize: font.sizes.sm,
    padding: '5px 10px',
    borderRadius: 6,
    fontFamily: font.family,
  } as CSSProperties,

  success: {
    background: T.greenDim,
    border: `1px solid #1f6b3a`,
    color: T.green,
    cursor: 'pointer',
    fontSize: font.sizes.sm,
    fontWeight: 600,
    padding: '5px 14px',
    borderRadius: 6,
    fontFamily: font.family,
  } as CSSProperties,

  danger: {
    background: T.redDim,
    border: `1px solid #7f2a2a`,
    color: T.red,
    cursor: 'pointer',
    fontSize: font.sizes.sm,
    fontWeight: 500,
    padding: '5px 12px',
    borderRadius: 6,
    fontFamily: font.family,
  } as CSSProperties,
}

/** Input / Textarea */
export const inp: CSSProperties = {
  background: T.bgRaised,
  border: `1px solid ${T.border}`,
  borderRadius: 6,
  padding: '7px 11px',
  color: T.textPrimary,
  fontSize: font.sizes.base,
  outline: 'none',
  width: '100%',
  fontFamily: font.family,
  lineHeight: '1.5',
}

export const ta: CSSProperties = {
  ...inp,
  resize: 'vertical',
}

/** Form label */
export const label: CSSProperties = {
  fontSize: font.sizes.xs,
  color: T.textMuted,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.07em',
  marginBottom: 5,
  display: 'block',
}

/** Section title inside a card */
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

/** Top bar shared across pages */
export const topBar: CSSProperties = {
  height: 48,
  background: T.bgBase,
  borderBottom: `1px solid ${T.border}`,
  display: 'flex',
  alignItems: 'center',
  padding: '0 20px',
  gap: 12,
  flexShrink: 0,
}

/** Small badge / chip */
export function badge(color: string, bg: string): CSSProperties {
  return {
    fontSize: font.sizes.xs,
    fontWeight: 600,
    color,
    background: bg,
    border: `1px solid ${color}33`,
    borderRadius: 99,
    padding: '2px 8px',
  }
}
