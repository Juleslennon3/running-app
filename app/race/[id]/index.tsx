import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native'

import { useSession } from '../../../lib/auth-context'
import { supabase } from '../../../lib/supabase'
import { colors } from '../../../lib/theme'

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function RaceDetailScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const { session } = useSession()
  const [race, setRace] = useState<any>(null)
  const [joined, setJoined] = useState(false)
  const [myDurationSeconds, setMyDurationSeconds] = useState<number | null>(null)
  const [myDistanceKm, setMyDistanceKm] = useState<number | null>(null)
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [message, setMessage] = useState('')
  const [hostUsername, setHostUsername] = useState('Unknown')

  useFocusEffect(
    useCallback(() => {
      if (id && session) {
        resolveExpiredThenFetch()
      }
    }, [id, session])
  )

  async function resolveExpiredThenFetch() {
    const { error } = await supabase.rpc('resolve_expired_race_participants', { p_race_id: id })
    console.log("RESOLVE EXPIRED PARTICIPANTS ERROR:", error)

    fetchRace()
    checkIfJoined()
    fetchLeaderboard()
  }

  async function fetchRace() {
    const { data, error } = await supabase
      .from('races')
      .select('*, clubs(name)')
      .eq('id', id)
      .single()

    console.log("RACE DETAIL:", data)
    console.log("RACE DETAIL ERROR:", error)

    if (!error) {
      setRace(data)
      fetchHostUsername(data.created_by)
    }
  }

  async function fetchHostUsername(userId: string) {
    if (!userId) return

    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single()

    console.log("HOST USERNAME:", data)
    console.log("HOST USERNAME ERROR:", error)

    if (!error && data) {
      setHostUsername(data.username)
    }
  }

  async function checkIfJoined() {
    const { data } = await supabase
      .from('race_participants')
      .select('duration_seconds, distance_km')
      .eq('race_id', id)
      .eq('user_id', session?.user.id)
      .maybeSingle()

    if (data) {
      setJoined(true)
      setMyDurationSeconds(data.duration_seconds)
      setMyDistanceKm(data.distance_km)
    }
  }

  async function joinRace() {
    const { error } = await supabase
      .from('race_participants')
      .insert({ race_id: id, user_id: session?.user.id })

    console.log("JOIN RACE ERROR:", error)

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Joined race!')
      setJoined(true)
      fetchLeaderboard()
    }
  }

  async function fetchLeaderboard() {
    const { data, error } = await supabase
      .from('race_participants')
      .select('duration_seconds, distance_km, user_id, profiles(username)')
      .eq('race_id', id)

    console.log("LEADERBOARD:", data)
    console.log("LEADERBOARD ERROR:", error)

    if (!error && data) {
      setLeaderboard(data)
    }
  }

  function getStatus() {
    if (!race) return 'Active'
    return new Date(race.end_date) > new Date() ? 'Active' : 'Ended'
  }

  if (!race) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.subtitle}>Loading…</Text>
      </View>
    )
  }

  const isActive = getStatus() === 'Active'

  function isDnf(entry: { duration_seconds: number | null; distance_km: number | null }) {
    const targetKm = race?.target_distance_km
    return entry.duration_seconds !== null && !!targetKm && (entry.distance_km ?? 0) < targetKm
  }

  const myDnf = myDurationSeconds !== null && isDnf({ duration_seconds: myDurationSeconds, distance_km: myDistanceKm })

  const sortedLeaderboard = [...leaderboard].sort((a, b) => {
    if (a.duration_seconds === null) return 1
    if (b.duration_seconds === null) return -1
    const aDnf = isDnf(a)
    const bDnf = isDnf(b)
    if (aDnf && !bDnf) return 1
    if (!aDnf && bDnf) return -1
    if (aDnf && bDnf) return (b.distance_km ?? 0) - (a.distance_km ?? 0)
    return a.duration_seconds - b.duration_seconds
  })

  function medalStyle(rank: number) {
    if (rank === 0) return styles.rankGold
    if (rank === 1) return styles.rankSilver
    if (rank === 2) return styles.rankBronze
    return null
  }

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{race.name}</Text>
        <View style={isActive ? styles.badgeActive : styles.badgeEnded}>
          <Text style={isActive ? styles.badgeActiveText : styles.badgeEndedText}>
            {isActive ? 'Active' : 'Ended'}
          </Text>
        </View>
      </View>

      {race.target_distance_km && (
        <Text style={styles.raceClub}>{race.target_distance_km} km</Text>
      )}
      {race.club_id && (
        <Text style={styles.raceClub}>{race.clubs?.name ?? 'Club race'}</Text>
      )}

      <Text style={styles.raceDates}>
        {new Date(race.start_date).toLocaleDateString()} — {new Date(race.end_date).toLocaleDateString()}
      </Text>

      <Text style={styles.raceHost}>Hosted by {hostUsername}</Text>
      <Text style={styles.participantCount}>{leaderboard.length} joined</Text>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      {!joined && isActive && (
        <TouchableOpacity style={styles.primaryButton} onPress={joinRace}>
          <Text style={styles.primaryButtonText}>Join race</Text>
        </TouchableOpacity>
      )}

      {joined && isActive && myDurationSeconds === null && (
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push(`/race/${id}/track`)}
        >
          <Text style={styles.primaryButtonText}>Start race</Text>
        </TouchableOpacity>
      )}

      {joined && myDurationSeconds !== null && (
        <View style={styles.submitCard}>
          <Text style={styles.submitLabel}>{myDnf ? 'Result' : 'Your time'}</Text>
          {myDnf ? (
            <Text style={styles.myDnfText}>DNF · {myDistanceKm} of {race.target_distance_km} km</Text>
          ) : (
            <Text style={styles.myTimeText}>{formatDuration(myDurationSeconds)}</Text>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>Leaderboard</Text>
      {sortedLeaderboard.length === 0 && (
        <Text style={styles.emptyText}>No results yet.</Text>
      )}
      {sortedLeaderboard.map((entry, index) => {
        const isYou = entry.user_id === session?.user.id
        const entryDnf = isDnf(entry)
        const medal = entryDnf ? null : medalStyle(index)

        return (
          <View key={index} style={[styles.leaderboardRow, isYou && styles.leaderboardRowYou]}>
            <View style={[styles.rankBadge, medal]}>
              <Text style={[styles.rankBadgeText, medal && styles.rankBadgeTextMedal]}>
                {entryDnf ? '—' : index + 1}
              </Text>
            </View>
            <Text style={[styles.leaderboardName, isYou && styles.leaderboardTextYou]}>
              {isYou ? 'You' : entry.profiles?.username ?? 'Unknown'}
            </Text>
            <Text style={[styles.leaderboardDistance, entryDnf ? styles.leaderboardDnf : isYou && styles.leaderboardTextYou]}>
              {entry.duration_seconds === null ? '—' : entryDnf ? 'DNF' : formatDuration(entry.duration_seconds)}
            </Text>
          </View>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: colors.background },
  container: { padding: 28, paddingTop: 20, paddingBottom: 80 },
  emptyContainer: { flex: 1, padding: 28, paddingTop: 70, backgroundColor: colors.background },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.textPrimary, flex: 1 },
  subtitle: { fontSize: 14, color: colors.textSecondary },
  raceClub: { fontSize: 13, color: colors.accent, fontWeight: '600', marginTop: 8 },
  raceDates: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  raceHost: { fontSize: 13, color: colors.textSecondary, marginTop: 8 },
  participantCount: { fontSize: 13, color: colors.textSecondary, marginTop: 2, marginBottom: 20 },
  message: { color: colors.textSecondary, fontSize: 13, marginBottom: 16 },
  badgeActive: { backgroundColor: '#1c2b12', borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10 },
  badgeActiveText: { color: colors.accent, fontSize: 11, fontWeight: '600' },
  badgeEnded: { backgroundColor: colors.card, borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10 },
  badgeEndedText: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  primaryButton: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 20 },
  primaryButtonText: { color: colors.background, fontWeight: 'bold', fontSize: 14 },
  submitCard: { backgroundColor: colors.card, borderWidth: 0.5, borderColor: colors.border, borderRadius: 14, padding: 16, marginBottom: 24 },
  submitLabel: { color: colors.textSecondary, fontSize: 13, marginBottom: 10 },
  myTimeText: { color: colors.textPrimary, fontSize: 28, fontWeight: 'bold' },
  myDnfText: { color: colors.danger, fontSize: 20, fontWeight: 'bold' },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 },
  emptyText: { color: colors.textSecondary, fontSize: 13 },
  leaderboardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, gap: 12, borderRadius: 8 },
  leaderboardRowYou: { backgroundColor: '#161a10' },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankGold: { backgroundColor: '#e8ff2e' },
  rankSilver: { backgroundColor: '#c7cbd1' },
  rankBronze: { backgroundColor: '#cd8a4f' },
  rankBadgeText: { fontWeight: '700', color: colors.textSecondary, fontSize: 12 },
  rankBadgeTextMedal: { color: colors.background },
  leaderboardName: { flex: 1, color: colors.textPrimary, fontSize: 14 },
  leaderboardDistance: { fontWeight: '600', color: colors.textPrimary, fontSize: 13 },
  leaderboardDnf: { color: colors.danger },
  leaderboardTextYou: { color: colors.accent },
})
