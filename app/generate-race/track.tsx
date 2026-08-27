import { useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { useSession } from '../../lib/auth-context'
import { formatDuration, formatPaceFromSecPerKm } from '../../lib/format'
import { AbilityTier, generateField, rankAgainstField } from '../../lib/simulated-race'
import { supabase } from '../../lib/supabase'
import { cardShadow, colors } from '../../lib/theme'
import { useGpsTracking } from '../../lib/use-gps-tracking'

export default function GenerateRaceTrackScreen() {
  const router = useRouter()
  const { session } = useSession()
  const params = useLocalSearchParams<{ distanceKm: string; fieldSize: string; tier: string }>()

  const targetDistanceKm = Number(params.distanceKm)
  const fieldSize = Number(params.fieldSize)
  const tier = (params.tier as AbilityTier) ?? 'mixed'

  const field = useMemo(
    () => generateField({ distanceKm: targetDistanceKm, fieldSize, tier }),
    [targetDistanceKm, fieldSize, tier]
  )

  const [result, setResult] = useState<{ durationSeconds: number; distanceKm: number; rank: number; total: number; dnf: boolean } | null>(null)

  const { phase, elapsedSeconds, distanceMeters, currentPaceSecPerKm, start, finish } = useGpsTracking({
    targetDistanceKm,
    onFinish: handleFinish,
  })

  async function handleFinish({ durationSeconds, distanceKm }: { durationSeconds: number; distanceKm: number }) {
    const dnf = distanceKm < targetDistanceKm
    const { rank, total } = rankAgainstField({
      elapsedSeconds: durationSeconds,
      userDistanceKm: distanceKm,
      targetDistanceKm,
      field,
    })

    setResult({ durationSeconds, distanceKm, rank, total, dnf })

    const { error } = await supabase.from('generated_race_attempts').insert({
      user_id: session?.user.id,
      distance_km: targetDistanceKm,
      field_size: fieldSize,
      ability_tier: tier,
      duration_seconds: durationSeconds,
      distance_km_covered: distanceKm,
      rank: dnf ? null : rank,
      total_field: total,
      dnf,
    })

    console.log("GENERATED RACE ATTEMPT INSERT ERROR:", error)
  }

  function rankLabel(rank: number) {
    if (rank === 1) return '1st'
    if (rank === 2) return '2nd'
    if (rank === 3) return '3rd'
    return `${rank}th`
  }

  if (phase === 'requesting') {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.message}>Requesting location access…</Text>
      </View>
    )
  }

  if (phase === 'denied') {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.title}>Location access needed</Text>
        <Text style={styles.message}>
          Run Club needs location access to track your distance and pace during a race.
        </Text>
        <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
          <Text style={styles.secondaryButtonText}>Go back</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (phase === 'ready') {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.title}>{fieldSize}-person field, ready?</Text>
        <Text style={styles.message}>{targetDistanceKm} km · {tier} ability</Text>
        <TouchableOpacity style={styles.startButton} onPress={start}>
          <Text style={styles.startButtonText}>Start</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (phase === 'tracking') {
    const distanceKm = distanceMeters / 1000
    const remainingKm = Math.max(0, targetDistanceKm - distanceKm)
    const etaSeconds = currentPaceSecPerKm ? remainingKm * currentPaceSecPerKm : null
    const live = rankAgainstField({ elapsedSeconds, userDistanceKm: distanceKm, targetDistanceKm, field })

    return (
      <View style={styles.centerContainer}>
        <View style={styles.positionBadge}>
          <Text style={styles.positionNumber}>{live.rank}</Text>
          <Text style={styles.positionSlash}>/{live.total}</Text>
        </View>

        <Text style={styles.liveTimer}>{formatDuration(elapsedSeconds)}</Text>
        <Text style={styles.liveDistance}>{distanceKm.toFixed(2)} km</Text>
        <Text style={styles.liveTarget}>of {targetDistanceKm} km target</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{remainingKm.toFixed(2)}</Text>
            <Text style={styles.statLabel}>km left</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxLive]}>
            <Text style={[styles.statValue, styles.statValueLive]}>{formatPaceFromSecPerKm(currentPaceSecPerKm).replace(' /km', '')}</Text>
            <Text style={[styles.statLabel, styles.statLabelLive]}>pace now /km</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{etaSeconds != null ? formatDuration(etaSeconds) : '—'}</Text>
            <Text style={styles.statLabel}>est. left</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.finishButton} onPress={finish}>
          <Text style={styles.finishButtonText}>Finish</Text>
        </TouchableOpacity>
      </View>
    )
  }

  // finished
  return (
    <View style={styles.centerContainer}>
      {result ? (
        <>
          <Text style={[styles.resultRank, result.dnf && styles.resultRankDnf]}>
            {result.dnf ? 'DNF' : `${rankLabel(result.rank)} of ${result.total}`}
          </Text>
          <Text style={styles.message}>
            {result.dnf
              ? `You covered ${result.distanceKm.toFixed(2)} of ${targetDistanceKm} km — didn't finish the distance`
              : `${formatDuration(result.durationSeconds)} · ${result.distanceKm.toFixed(2)} km`}
          </Text>
        </>
      ) : (
        <Text style={styles.message}>Saving your result…</Text>
      )}
      <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace('/generate-race')}>
        <Text style={styles.secondaryButtonText}>Generate another race</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  startButton: {
    backgroundColor: colors.accent,
    borderRadius: 60,
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  startButtonText: {
    color: colors.background,
    fontSize: 20,
    fontWeight: 'bold',
  },
  finishButton: {
    backgroundColor: colors.danger,
    borderRadius: 60,
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
    ...cardShadow,
  },
  finishButtonText: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: 'bold',
  },
  positionBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  positionNumber: {
    fontSize: 80,
    fontWeight: '900',
    color: colors.accent,
    lineHeight: 80,
  },
  positionSlash: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.textSecondary,
    marginLeft: 2,
  },
  liveTimer: {
    fontSize: 56,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  liveDistance: {
    fontSize: 28,
    fontWeight: '600',
    color: colors.accent,
    marginTop: 12,
  },
  liveTarget: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    marginTop: 28,
    gap: 12,
  },
  statBox: {
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    minWidth: 88,
    ...cardShadow,
  },
  statBoxLive: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  statValueLive: {
    fontSize: 22,
    color: colors.accent,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 4,
  },
  statLabelLive: {
    color: colors.accent,
    fontWeight: '600',
  },
  resultRank: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.accent,
    marginBottom: 10,
    textAlign: 'center',
  },
  resultRankDnf: {
    color: colors.danger,
  },
  secondaryButton: {
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginTop: 10,
    ...cardShadow,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
})
