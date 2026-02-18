export const colors = {
  bg: {
    primary: '#111827',
    surface: '#1f2937',
    elevated: '#374151',
    muted: '#4b5563',
    dark: '#0f172a',
    warm: '#292524',
  },
  text: {
    primary: '#f3f4f6',
    bright: '#e5e7eb',
    light: '#d1d5db',
    secondary: '#9ca3af',
    muted: '#6b7280',
    onAccent: '#1f2937',
  },
  accent: '#f59e0b',
  accentLight: '#fbbf24',
  border: {
    default: '#374151',
  },
  status: {
    success: '#22c55e',
    successDark: '#065f46',
    successLight: '#a7f3d0',
    warning: '#f59e0b',
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
