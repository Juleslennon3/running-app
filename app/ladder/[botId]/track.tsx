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

export default function LadderTrackScreen() {
  const { botId } = useLocalSearchParams()
  const router = useRouter()
  const { session } = useSession()

  const [bot, setBot] = useState<any>(null)
  const [result, setResult] = useState<{ durationSeconds: number; distanceKm: number; beatBot: boolean; dnf: boolean } | null>(null)

  const { phase, elapsedSeconds, distanceMeters, start, finish } = useGpsTracking({
    targetDistanceKm: bot?.distance_km ?? null,
    onFinish: handleFinish,
  })

  useEffect(() => {
    fetchBot()
  }, [])

  async function fetchBot() {
    const { data, error } = await supabase
      .from('bot_opponents')
      .select('*')
      .eq('id', botId)
      .single()

    console.log("BOT FETCH ERROR:", error)

    if (!error && data) {
      setBot(data)
    }
  }

  async function handleFinish({ durationSeconds, distanceKm }: { durationSeconds: number; distanceKm: number }) {
    const dnf = distanceKm < bot.distance_km
    const beatBot = !dnf && durationSeconds < bot.time_seconds

    const { error } = await supabase
      .from('bot_attempts')
      .insert({
        user_id: session?.user.id,
        bot_id: bot.id,
        duration_seconds: durationSeconds,
        distance_km: distanceKm,
        beat_bot: beatBot,
      })

    console.log("BOT ATTEMPT INSERT ERROR:", error)

    setResult({ durationSeconds, distanceKm, beatBot, dnf })
  }

  if (!bot) {
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
          Run Club needs location access to track your distance and pace during a challenge.
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
        <Text style={styles.title}>Beat {bot.name}?</Text>
        <Text style={styles.message}>
          Target: {formatDuration(bot.time_seconds)} over {bot.distance_km} km
        </Text>
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
        <Text style={styles.liveTarget}>of {bot.distance_km} km · beat {formatDuration(bot.time_seconds)}</Text>
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
          <Text style={[styles.resultRank, !result.beatBot && styles.resultRankLoss]}>
            {result.dnf ? 'DNF' : result.beatBot ? `You beat ${bot.name}!` : `${bot.name} won`}
          </Text>
          <Text style={styles.message}>
            {result.dnf
              ? `You covered ${result.distanceKm.toFixed(2)} of ${bot.distance_km} km — didn't finish the distance`
              : `You: ${formatDuration(result.durationSeconds)} · ${bot.name}: ${formatDuration(bot.time_seconds)}`}
          </Text>
        </>
      ) : (
        <Text style={styles.message}>Saving your result…</Text>
      )}
      <TouchableOpacity style={styles.secondaryButton} onPress={() => router.replace('/explore')}>
        <Text style={styles.secondaryButtonText}>Back to ladder</Text>
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
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.accent,
    marginBottom: 10,
    textAlign: 'center',
  },
  resultRankLoss: {
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
