import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { useSession } from '../../../lib/auth-context'
import { supabase } from '../../../lib/supabase'
import { cardShadow, colors } from '../../../lib/theme'
import { useGpsTracking } from '../../../lib/use-gps-tracking'

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

export default function WorkoutTrackScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const { session } = useSession()

  const [workout, setWorkout] = useState<any>(null)
  const [result, setResult] = useState<{ durationSeconds: number; distanceKm: number } | null>(null)

  const targetDistanceKm = workout ? workout.reps * workout.distance_per_rep_km : null

  const { phase, elapsedSeconds, distanceMeters, start, finish } = useGpsTracking({
    targetDistanceKm,
    onFinish: handleFinish,
  })

  useEffect(() => {
    fetchWorkout()
  }, [])

  async function fetchWorkout() {
    const { data, error } = await supabase
      .from('workouts')
      .select('reps, distance_per_rep_km, rest_seconds, name')
      .eq('id', id)
      .single()

    console.log("WORKOUT TRACK FETCH ERROR:", error)

    if (!error && data) {
      setWorkout(data)
    }
  }

  async function handleFinish({ durationSeconds, distanceKm }: { durationSeconds: number; distanceKm: number }) {
    const { error } = await supabase
      .from('workout_assignments')
      .update({ distance_km: distanceKm, duration_seconds: durationSeconds, completed_at: new Date().toISOString() })
      .eq('workout_id', id)
      .eq('user_id', session?.user.id)

    console.log("WORKOUT COMPLETE UPDATE ERROR:", error)

    setResult({ durationSeconds, distanceKm })
  }

  if (!workout) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.message}>Loading…</Text>
      </View>
    )
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
          Run Club needs location access to track your distance and pace during a workout.
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
        <Text style={styles.title}>{workout.name}</Text>
        <Text style={styles.message}>
          {workout.reps} x {workout.distance_per_rep_km} km
          {workout.rest_seconds ? ` · ${workout.rest_seconds}s rest between reps` : ''}
        </Text>
        <TouchableOpacity style={styles.startButton} onPress={start}>
          <Text style={styles.startButtonText}>Start</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (phase === 'tracking') {
    const distanceKm = distanceMeters / 1000
    const currentRep = Math.min(workout.reps, Math.floor(distanceKm / workout.distance_per_rep_km) + 1)

    return (
      <View style={styles.centerContainer}>
        <Text style={styles.repLabel}>Rep {currentRep} of {workout.reps}</Text>
        <Text style={styles.liveTimer}>{formatDuration(elapsedSeconds)}</Text>
        <Text style={styles.liveDistance}>{distanceKm.toFixed(2)} km</Text>
        <Text style={styles.liveTarget}>of {(workout.reps * workout.distance_per_rep_km).toFixed(1)} km target</Text>
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
          <Text style={styles.resultTitle}>Workout complete!</Text>
          <Text style={styles.message}>
            {formatDuration(result.durationSeconds)} · {result.distanceKm.toFixed(2)} km
          </Text>
        </>
      ) : (
        <Text style={styles.message}>Saving your result…</Text>
      )}
      <TouchableOpacity style={styles.secondaryButton} onPress={() => router.back()}>
        <Text style={styles.secondaryButtonText}>Back to workout</Text>
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
  repLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accent,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
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
  resultTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.accent,
    marginBottom: 10,
    textAlign: 'center',
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
