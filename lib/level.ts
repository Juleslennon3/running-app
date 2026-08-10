const LEVEL_TIERS: { minKm: number; label: string }[] = [
  { minKm: 0, label: 'New Runner' },
  { minKm: 25, label: 'Runner' },
  { minKm: 100, label: 'Competitor' },
  { minKm: 300, label: 'Elite' },
]

export function getLevelLabel(totalDistanceKm: number): string {
  let label = LEVEL_TIERS[0].label

  for (const tier of LEVEL_TIERS) {
    if (totalDistanceKm >= tier.minKm) {
      label = tier.label
    }
  }

  return label
}
