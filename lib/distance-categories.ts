export type DistanceCategory = {
  slug: string
  label: string
  km: number
}

export const DISTANCE_CATEGORIES: DistanceCategory[] = [
  { slug: '1k', label: '1K', km: 1 },
  { slug: '5k', label: '5K', km: 5 },
  { slug: '10k', label: '10K', km: 10 },
  { slug: 'half', label: 'Half Marathon', km: 21.0975 },
  { slug: 'marathon', label: 'Marathon', km: 42.195 },
]
