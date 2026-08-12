export const colors = {
  accent: '#e8ff2e',
  background: '#0a0b0d',
  card: '#111214',
  border: '#1e2023',
  textPrimary: '#f5f5f2',
  textSecondary: '#6b6e73',
  danger: '#ff5c5c',
}

// Shared card elevation, used on every card-like surface so the app has one
// consistent sense of depth instead of flat bordered boxes everywhere.
export const cardShadow = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 6 },
  shadowOpacity: 0.35,
  shadowRadius: 12,
  elevation: 6,
}

// Shared section-label look: small, secondary, uppercase, letter-spaced.
export const sectionLabel = {
  fontSize: 13,
  fontWeight: '700' as const,
  color: colors.textSecondary,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.8,
}