export type AbilityTier = 'beginner' | 'mixed' | 'elite'

export const ABILITY_TIERS: { key: AbilityTier; label: string; description: string }[] = [
  { key: 'beginner', label: 'Beginner field', description: 'Everyone’s pacing an easy, conversational effort.' },
  { key: 'mixed', label: 'Mixed ability', description: 'A real fun-run spread — elites at the front, walkers at the back.' },
  { key: 'elite', label: 'Elite field', description: 'Fast. Every runner here is racing near their limit.' },
]

const TIER_PACE_SECONDS_PER_KM: Record<AbilityTier, { mean: number; stddev: number; min: number; max: number }> = {
  elite: { mean: 210, stddev: 18, min: 165, max: 260 },
  mixed: { mean: 360, stddev: 100, min: 195, max: 720 },
  beginner: { mean: 480, stddev: 55, min: 380, max: 680 },
}

function sampleNormal(mean: number, stddev: number) {
  const u1 = Math.random()
  const u2 = Math.random()
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
  return mean + z * stddev
}

export type SimulatedRunner = {
  id: number
  name: string
  timeSeconds: number
}

export function generateField({
  distanceKm,
  fieldSize,
  tier,
}: {
  distanceKm: number
  fieldSize: number
  tier: AbilityTier
}): SimulatedRunner[] {
  const { mean, stddev, min, max } = TIER_PACE_SECONDS_PER_KM[tier]

  const field: SimulatedRunner[] = []
  for (let i = 0; i < fieldSize; i++) {
    const paceSecPerKm = Math.min(max, Math.max(min, sampleNormal(mean, stddev)))
    field.push({
      id: i,
      name: `Runner ${i + 1}`,
      timeSeconds: Math.round(paceSecPerKm * distanceKm),
    })
  }

  return field.sort((a, b) => a.timeSeconds - b.timeSeconds)
}

export function rankAgainstField({
  elapsedSeconds,
  userDistanceKm,
  targetDistanceKm,
  field,
}: {
  elapsedSeconds: number
  userDistanceKm: number
  targetDistanceKm: number
  field: SimulatedRunner[]
}) {
  const entries = field.map((runner) => {
    const finished = elapsedSeconds >= runner.timeSeconds
    const distanceKm = finished ? targetDistanceKm : targetDistanceKm * (elapsedSeconds / runner.timeSeconds)
    return { finished, distanceKm, timeSeconds: runner.timeSeconds, isUser: false }
  })

  entries.push({ finished: false, distanceKm: userDistanceKm, timeSeconds: elapsedSeconds, isUser: true })

  const finishers = entries.filter((e) => e.finished).sort((a, b) => a.timeSeconds - b.timeSeconds)
  const inProgress = entries.filter((e) => !e.finished).sort((a, b) => b.distanceKm - a.distanceKm)
  const ordered = [...finishers, ...inProgress]

  const userIndex = ordered.findIndex((e) => e.isUser)

  return {
    rank: userIndex >= 0 ? userIndex + 1 : ordered.length,
    total: ordered.length,
  }
}
