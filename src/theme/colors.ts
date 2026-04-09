export const colors = {
  bg: {
    primary: '#0d1117',    // darker — more contrast from surface
    surface: '#161d2a',    // richer blue-dark — clearly distinct from primary
    elevated: '#1f2d42',   // noticeably lighter — cards pop from surface
    muted: '#2d3a4f',
    dark: '#0a0f18',
    warm: '#1e1a16',
  },
  text: {
    primary: '#f3f4f6',
    bright: '#e5e7eb',
    light: '#d1d5db',
    secondary: '#9ca3af',
    muted: '#6b7280',
    onAccent: '#0d1117',   // updated to match new primary
  },
  accent: '#d97706',       // amber-600 — deeper, richer, distinct from warning
  accentLight: '#f59e0b',  // amber-400 — old accent, now used as light variant
  cream: '#f3e9d2',        // parchment/faceplate — evokes aged schematic paper
  border: {
    default: '#1f2d42',    // matches elevated so borders feel natural
  },
  status: {
    success: '#22c55e',
    successDark: '#065f46',
    successLight: '#a7f3d0',
    warning: '#f59e0b',    // amber-400 — clearly distinct from accent now
    error: '#ef4444',
    info: '#3b82f6',
    infoLight: '#60a5fa',
    purple: '#8b5cf6',
  },
  shadow: '#000000',
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
  brand: {
    google: '#4285f4',
  },
} as const;

export type Colors = typeof colors;
