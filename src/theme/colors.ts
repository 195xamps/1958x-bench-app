export const colors = {
  bg: {
    primary: '#111827',
    surface: '#1f2937',
    elevated: '#374151',
  },
  text: {
    primary: '#f3f4f6',
    bright: '#e5e7eb',
    secondary: '#9ca3af',
    muted: '#6b7280',
    onAccent: '#1f2937',
  },
  accent: '#f59e0b',
  border: {
    default: '#374151',
  },
  status: {
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    purple: '#8b5cf6',
  },
  white: '#ffffff',
  transparent: 'transparent',
} as const;

export type Colors = typeof colors;
