import * as Location from 'expo-location'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { useSession } from '../../../lib/auth-context'
import { supabase } from '../../../lib/supabase'
import { colors } from '../../../lib/theme'

type Phase = 'requesting' | 'denied' | 'ready' | 'tracking' | 'finished'

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

function haversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export default function TrackRaceScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const { session } = useSession()

  const [phase, setPhase] = useState<Phase>('requesting')
  const [targetDistanceKm, setTargetDistanceKm] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [distanceMeters, setDistanceMeters] = useState(0)
  const [result, setResult] = useState<{ durationSeconds: number; distanceKm: number; rank: number; totalFinished: number } | null>(null)

  const startTimeRef = useRef(0)
  const distanceMetersRef = useRef(0)
  const lastPointRef = useRef<{ latitude: number; longitude: number } | null>(null)
  const watchSubscriptionRef = useRef<Location.LocationSubscription | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    fetchTargetDistance()
    requestPermission()

    return () => {
      stopWatching()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function stopWatching() {
    // expo-location's web implementation's .remove() throws internally
    // (calls into a LocationEventEmitter method that isn't implemented on
    // web), so this has to be a try/catch, not just a typeof check.
    try {
      watchSubscriptionRef.current?.remove()
    } catch (err) {
      console.log('LOCATION SUBSCRIPTION REMOVE ERROR:', err)
    }
    watchSubscriptionRef.current = null
  }

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

  async function requestPermission() {
    const { status } = await Location.requestForegroundPermissionsAsync()

    if (status === 'granted') {
      setPhase('ready')
    } else {
      setPhase('denied')
    }
  }

  async function handleStart() {
    startTimeRef.current = Date.now()
    distanceMetersRef.current = 0
    lastPointRef.current = null
    setDistanceMeters(0)
    setElapsedSeconds(0)
    setPhase('tracking')

    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)

    watchSubscriptionRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 5,
      },
      (location) => {
        const { latitude, longitude, accuracy } = location.coords

        if (lastPointRef.current && (accuracy == null || accuracy < 30)) {
          const delta = haversineDistanceMeters(
            lastPointRef.current.latitude,
            lastPointRef.current.longitude,
            latitude,
            longitude
          )

          if (delta > 1) {
            distanceMetersRef.current += delta
            setDistanceMeters(distanceMetersRef.current)
          }
        }

        lastPointRef.current = { latitude, longitude }

        if (targetDistanceKm && distanceMetersRef.current / 1000 >= targetDistanceKm) {
          handleFinish()
        }
      }
    )
  }

  async function handleFinish() {
    stopWatching()
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    const finalDurationSeconds = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000))
    const finalDistanceKm = Number((distanceMetersRef.current / 1000).toFixed(2))

    setPhase('finished')

    const { error } = await supabase
      .from('race_participants')
      .update({ distance_km: finalDistanceKm, duration_seconds: finalDurationSeconds })
      .eq('race_id', id)
      .eq('user_id', session?.user.id)

    console.log("FINISH RACE UPDATE ERROR:", error)

    const { data: others, error: othersError } = await supabase
      .from('race_participants')
      .select('duration_seconds')
      .eq('race_id', id)
      .not('duration_seconds', 'is', null)

    console.log("OTHERS FOR RANK ERROR:", othersError)

    const finishedTimes = others ?? []
    const faster = finishedTimes.filter((r: any) => r.duration_seconds < finalDurationSeconds).length

    setResult({
      durationSeconds: finalDurationSeconds,
      distanceKm: finalDistanceKm,
      rank: faster + 1,
      totalFinished: finishedTimes.length,
    })
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
        <TouchableOpacity style={styles.startButton} onPress={handleStart}>
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

        <TouchableOpacity style={styles.finishButton} onPress={handleFinish}>
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
          <Text style={styles.resultRank}>{rankLabel(result.rank)} place</Text>
          <Text style={styles.message}>
            {formatDuration(result.durationSeconds)} · {result.distanceKm.toFixed(2)} km
          </Text>
        </>
      ) : (
        <Text style={styles.message}>Saving your result…</Text>
      )}
      <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace(`/race/${id}`)}>
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
  secondaryButton: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 28,
    marginTop: 10,
  },
  secondaryButtonText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
})
