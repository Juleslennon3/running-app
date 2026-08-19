export function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = Math.floor(totalSeconds % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

// Average pace since the start of the activity.
export function formatPace(elapsedSeconds: number, distanceKm: number) {
  if (distanceKm <= 0) return '—'
  return `${formatPaceFromSecPerKm(elapsedSeconds / distanceKm)} /km`
}

export function formatPaceFromSecPerKm(secPerKm: number | null) {
  if (secPerKm == null || !isFinite(secPerKm) || secPerKm <= 0) return '—'
  const minutes = Math.floor(secPerKm / 60)
  const seconds = Math.round(secPerKm % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')} /km`
}
