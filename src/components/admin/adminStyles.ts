import { StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

// Shared style fragments used across multiple admin sub-components.
// Anything truly local to one component lives in that component's own
// StyleSheet.create.
export const adminStyles = StyleSheet.create({
  // Common card backgrounds
  itemCard: { backgroundColor: colors.bg.surface, padding: 16, borderRadius: 12, marginBottom: 12 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  itemTitle: { fontSize: 16, fontWeight: '600', color: colors.text.primary, flex: 1 },
  itemSub: { fontSize: 14, color: colors.text.secondary, marginBottom: 4 },
  itemDesc: { fontSize: 14, color: colors.text.muted, marginTop: 4 },
  itemDate: { fontSize: 12, color: colors.text.muted },
  itemFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 12, fontWeight: '600', color: colors.white },

  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.accent, marginBottom: 12 },
  emptyText: { color: colors.text.muted, fontSize: 14, fontStyle: 'italic' },

  listContent: { padding: 16, paddingBottom: 32 },
});
