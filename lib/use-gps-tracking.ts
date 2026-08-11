import * as Location from 'expo-location'
import { useEffect, useRef, useState } from 'react'

export type GpsTrackingPhase = 'requesting' | 'denied' | 'ready' | 'tracking' | 'finished'

type UseGpsTrackingOptions = {
  targetDistanceKm: number | null
  onFinish: (result: { durationSeconds: number; distanceKm: number }) => void
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

export function useGpsTracking({ targetDistanceKm, onFinish }: UseGpsTrackingOptions) {
  const [phase, setPhase] = useState<GpsTrackingPhase>('requesting')
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [distanceMeters, setDistanceMeters] = useState(0)

  const startTimeRef = useRef(0)
  const distanceMetersRef = useRef(0)
  const lastPointRef = useRef<{ latitude: number; longitude: number } | null>(null)
  const watchSubscriptionRef = useRef<Location.LocationSubscription | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const finishedRef = useRef(false)
  const targetDistanceRef = useRef(targetDistanceKm)
  targetDistanceRef.current = targetDistanceKm

  useEffect(() => {
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

  async function requestPermission() {
    const { status } = await Location.requestForegroundPermissionsAsync()
    setPhase(status === 'granted' ? 'ready' : 'denied')
  }

  async function start() {
    startTimeRef.current = Date.now()
    distanceMetersRef.current = 0
    lastPointRef.current = null
    finishedRef.current = false
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

        if (targetDistanceRef.current && distanceMetersRef.current / 1000 >= targetDistanceRef.current) {
          finish()
        }
      }
    )
  }

  function finish() {
    if (finishedRef.current) return
    finishedRef.current = true

    stopWatching()
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    const finalDurationSeconds = Math.max(1, Math.floor((Date.now() - startTimeRef.current) / 1000))
    const finalDistanceKm = Number((distanceMetersRef.current / 1000).toFixed(2))

    setPhase('finished')
    onFinish({ durationSeconds: finalDurationSeconds, distanceKm: finalDistanceKm })
  }

  return { phase, elapsedSeconds, distanceMeters, start, finish }
}
