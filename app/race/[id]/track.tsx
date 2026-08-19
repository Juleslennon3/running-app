import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { useSession } from '../../../lib/auth-context'
import { formatDuration, formatPaceFromSecPerKm } from '../../../lib/format'
import { supabase } from '../../../lib/supabase'
import { cardShadow, colors } from '../../../lib/theme'
import { useGpsTracking } from '../../../lib/use-gps-tracking'

const LIVE_UPDATE_MS = 5000

export default function TrackRaceScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const { session } = useSession()

  const [targetDistanceKm, setTargetDistanceKm] = useState<number | null>(null)
  const [result, setResult] = useState<{ durationSeconds: number; distanceKm: number; rank: number; totalFinished: number; dnf: boolean } | null>(null)
  const [liveRank, setLiveRank] = useState<{ rank: number; total: number } | null>(null)

  const { phase, elapsedSeconds, distanceMeters, currentPaceSecPerKm, start, finish } = useGpsTracking({
    targetDistanceKm,
    onFinish: handleFinish,
  })

  const distanceMetersRef = useRef(0)
  useEffect(() => {
    distanceMetersRef.current = distanceMeters
  }, [distanceMeters])

  useEffect(() => {
    fetchTargetDistance()
  }, [])

  useEffect(() => {
    if (phase !== 'tracking') return

    const interval = setInterval(async () => {
      const liveDistanceKm = Number((distanceMetersRef.current / 1000).toFixed(3))

      await supabase
        .from('race_participants')
        .update({ distance_km: liveDistanceKm })
        .eq('race_id', id)
        .eq('user_id', session?.user.id)
        .is('duration_seconds', null)

      fetchLiveRank()
    }, LIVE_UPDATE_MS)

    return () => clearInterval(interval)
  }, [phase, id, session])

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

  async function fetchLiveRank() {
    const { data, error } = await supabase
      .from('race_participants')
      .select('user_id, distance_km, duration_seconds')
      .eq('race_id', id)

    console.log("LIVE RANK ERROR:", error)

    if (error || !data) return

    function isDnf(r: { duration_seconds: number | null; distance_km: number | null }) {
      return r.duration_seconds !== null && !!targetDistanceKm && (r.distance_km ?? 0) < targetDistanceKm
    }

    const validFinishers = data
      .filter((r: any) => r.duration_seconds !== null && !isDnf(r))
      .sort((a: any, b: any) => a.duration_seconds - b.duration_seconds)
    const inProgress = data
      .filter((r: any) => r.duration_seconds === null)
      .sort((a: any, b: any) => (b.distance_km ?? 0) - (a.distance_km ?? 0))
    const dnfd = data.filter((r: any) => isDnf(r))

    const ordered = [...validFinishers, ...inProgress, ...dnfd]
    const myIndex = ordered.findIndex((r: any) => r.user_id === session?.user.id)

    if (myIndex >= 0) {
      setLiveRank({ rank: myIndex + 1, total: ordered.length })
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
    const remainingKm = targetDistanceKm != null ? Math.max(0, targetDistanceKm - distanceKm) : null
    const etaSeconds = remainingKm != null && currentPaceSecPerKm ? remainingKm * currentPaceSecPerKm : null

    return (
      <View style={styles.centerContainer}>
        {liveRank && (
          <View style={styles.positionBadge}>
            <Text style={styles.positionNumber}>{liveRank.rank}</Text>
            <Text style={styles.positionSlash}>/{liveRank.total}</Text>
          </View>
        )}

        <Text style={styles.liveTimer}>{formatDuration(elapsedSeconds)}</Text>
        <Text style={styles.liveDistance}>{distanceKm.toFixed(2)} km</Text>
        {targetDistanceKm && (
          <Text style={styles.liveTarget}>of {targetDistanceKm} km target</Text>
        )}

        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{remainingKm != null ? remainingKm.toFixed(2) : '—'}</Text>
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
  positionBadge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 8,
  },
  positionNumber: {
    fontSize: 96,
    fontWeight: '900',
    color: colors.accent,
    lineHeight: 96,
  },
  positionSlash: {
    fontSize: 34,
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
