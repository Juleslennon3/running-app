import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { useSession } from '../../../lib/auth-context'
import { useGpsTracking } from '../../../lib/use-gps-tracking'
import { supabase } from '../../../lib/supabase'
import { cardShadow, colors } from '../../../lib/theme'

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function formatPace(elapsedSeconds: number, distanceKm: number) {
  if (distanceKm <= 0) return '—'
  const secPerKm = elapsedSeconds / distanceKm
  const minutes = Math.floor(secPerKm / 60)
  const seconds = Math.round(secPerKm % 60)
  return `${minutes}:${seconds.toString().padStart(2, '0')} /km`
}

export default function TrackRaceScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const { session } = useSession()

  const [targetDistanceKm, setTargetDistanceKm] = useState<number | null>(null)
  const [result, setResult] = useState<{ durationSeconds: number; distanceKm: number; rank: number; totalFinished: number; dnf: boolean } | null>(null)

  const { phase, elapsedSeconds, distanceMeters, start, finish } = useGpsTracking({
    targetDistanceKm,
    onFinish: handleFinish,
  })

  useEffect(() => {
    fetchTargetDistance()
  }, [])

  async function fetchTargetDistance() {
    const { data, error } = await supabase
      .from('races')
      .select('target_distance_km')
      .eq('id', id)
      .single()

    console.log("TARGET DISTANCE ERROR:", error)

    if (!error && data) {
      setTargetDistanceKm(data.target_distance_km)
    }
  }

  async function handleFinish({ durationSeconds, distanceKm }: { durationSeconds: number; distanceKm: number }) {
    const dnf = !!targetDistanceKm && distanceKm < targetDistanceKm

    const { error } = await supabase
      .from('race_participants')
      .update({ distance_km: distanceKm, duration_seconds: durationSeconds })
      .eq('race_id', id)
      .eq('user_id', session?.user.id)

    console.log("FINISH RACE UPDATE ERROR:", error)

    const { data: others, error: othersError } = await supabase
      .from('race_participants')
      .select('duration_seconds, distance_km')
      .eq('race_id', id)
      .not('duration_seconds', 'is', null)

    console.log("OTHERS FOR RANK ERROR:", othersError)

    const finishers = (others ?? []).filter(
      (r: any) => !targetDistanceKm || (r.distance_km ?? 0) >= targetDistanceKm
    )
    const faster = finishers.filter((r: any) => r.duration_seconds < durationSeconds).length

    setResult({
      durationSeconds,
      distanceKm,
      rank: faster + 1,
      totalFinished: finishers.length,
      dnf,
    })

    const { error: eloError } = await supabase.rpc('apply_elo_for_finish', {
      p_race_id: id,
      p_finisher_id: session?.user.id,
    })

    console.log("APPLY ELO ERROR:", eloError)
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
          Run Club needs location access to track your distance and pace during a live race.
          Enable it in your device settings, then come back here.
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
        <Text style={styles.title}>Ready to race?</Text>
        {targetDistanceKm && (
          <Text style={styles.message}>Target distance: {targetDistanceKm} km</Text>
        )}
        <TouchableOpacity style={styles.startButton} onPress={start}>
          <Text style={styles.startButtonText}>Start</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (phase === 'tracking') {
    const distanceKm = distanceMeters / 1000

    return (
      <View style={styles.centerContainer}>
        <Text style={styles.liveTimer}>{formatDuration(elapsedSeconds)}</Text>
        <Text style={styles.liveDistance}>{distanceKm.toFixed(2)} km</Text>
        {targetDistanceKm && (
          <Text style={styles.liveTarget}>of {targetDistanceKm} km target</Text>
        )}
        <Text style={styles.livePace}>{formatPace(elapsedSeconds, distanceKm)}</Text>

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
            {result.dnf ? 'DNF' : `${rankLabel(result.rank)} place`}
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
      <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
        <Text style={styles.secondaryButtonText}>View leaderboard</Text>
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
  livePace: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 8,
  },
  resultRank: {
    fontSize: 40,
    fontWeight: 'bold',
    color: colors.accent,
    marginBottom: 10,
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
