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

// Gradients for hero-style surfaces. Kept subtle - the app's identity is
// still black + yellow, this just adds depth instead of flat fills.
export const gradients = {
  accent: ['#f4ff6e', '#e8ff2e', '#c8dc12'] as [string, string, string],
  hero: ['#1c2b12', '#111214'] as [string, string],
  card: ['#161a10', '#111214'] as [string, string],
}

// A small set of muted, dark-friendly hues used for avatar backgrounds so
// people aren't all rendered in the same yellow-on-green circle. Picked
// deterministically per username so the same person always gets the same
// color across the app.
const AVATAR_PALETTE = [
  { bg: '#1c2b12', text: '#e8ff2e' }, // yellow (accent)
  { bg: '#2b2210', text: '#ffc93c' }, // amber
  { bg: '#0f2b28', text: '#2de0c5' }, // teal
  { bg: '#0f2030', text: '#4db8ff' }, // sky
  { bg: '#241530', text: '#b98aff' }, // violet
  { bg: '#2e1616', text: '#ff8a65' }, // coral
]

export function avatarColors(seed: string | null | undefined) {
  if (!seed) return AVATAR_PALETTE[0]
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  }
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}