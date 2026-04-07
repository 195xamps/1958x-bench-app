// SpaceMono is loaded in app/_layout.tsx via useFonts
export const fonts = {
  mono: 'SpaceMono',
  system: undefined, // React Native system default
} as const;

export const typography = {
  // Screen-level titles (tab headers, modal titles, screen names)
  screenTitle: {
    fontFamily: fonts.mono,
    fontSize: 24,
    fontWeight: '700' as const,
  },
  // Section headers within a screen
  sectionTitle: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '700' as const,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
  },
  // Card/item titles
  cardTitle: {
    fontFamily: fonts.mono,
    fontSize: 15,
    fontWeight: '600' as const,
  },
} as const;
