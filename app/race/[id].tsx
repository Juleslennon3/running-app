import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native'

import { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'

export default function RaceDetailScreen() {
  const { id } = useLocalSearchParams()
  const [session, setSession] = useState<Session | null>(null)
  const [race, setRace] = useState<any>(null)
  const [joined, setJoined] = useState(false)
  const [distanceInput, setDistanceInput] = useState('')
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [message, setMessage] = useState('')
  const [hostUsername, setHostUsername] = useState('Unknown')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })
  }, [])

  useEffect(() => {
    if (id && session) {
      fetchRace()
      checkIfJoined()
      fetchLeaderboard()
    }
  }, [id, session])

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
      .select('distance_km')
      .eq('race_id', id)
      .eq('user_id', session?.user.id)
      .maybeSingle()

    if (data) {
      setJoined(true)
      if (data.distance_km !== null) {
        setDistanceInput(String(data.distance_km))
      }
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

  async function submitDistance() {
    const value = parseFloat(distanceInput)

    if (isNaN(value)) {
      setMessage('Enter a valid number')
      return
    }

    const { error } = await supabase
      .from('race_participants')
      .update({ distance_km: value })
      .eq('race_id', id)
      .eq('user_id', session?.user.id)

    console.log("SUBMIT DISTANCE ERROR:", error)

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Distance submitted!')
      fetchLeaderboard()
    }
  }

  async function fetchLeaderboard() {
    const { data, error } = await supabase
      .from('race_participants')
      .select('distance_km, user_id, profiles(username)')
      .eq('race_id', id)
      .order('distance_km', { ascending: false })

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

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.background }}
      keyboardVerticalOffset={90}
    >
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.title}>{race.name}</Text>
          <View style={isActive ? styles.badgeActive : styles.badgeEnded}>
            <Text style={isActive ? styles.badgeActiveText : styles.badgeEndedText}>
              {isActive ? 'Active' : 'Ended'}
            </Text>
          </View>
        </View>

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

        {joined && isActive && (
          <View style={styles.submitCard}>
            <Text style={styles.submitLabel}>Your distance (km)</Text>
            <View style={styles.submitRow}>
              <TextInput
                placeholder="e.g. 12.4"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={distanceInput}
                onChangeText={setDistanceInput}
                style={styles.input}
              />
              <TouchableOpacity style={styles.submitButton} onPress={submitDistance}>
                <Text style={styles.submitButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Leaderboard</Text>
        {leaderboard.length === 0 && (
          <Text style={styles.emptyText}>No results yet.</Text>
        )}
        {leaderboard.map((entry, index) => {
          const isYou = entry.user_id === session?.user.id
          return (
            <View key={index} style={[styles.leaderboardRow, isYou && styles.leaderboardRowYou]}>
              <Text style={[styles.leaderboardRank, isYou && styles.leaderboardTextYou]}>{index + 1}</Text>
              <Text style={[styles.leaderboardName, isYou && styles.leaderboardTextYou]}>
                {isYou ? 'You' : entry.profiles?.username ?? 'Unknown'}
              </Text>
              <Text style={[styles.leaderboardDistance, isYou && styles.leaderboardTextYou]}>
                {entry.distance_km !== null ? `${entry.distance_km} km` : '—'}
              </Text>
            </View>
          )
        })}
      </ScrollView>
    </KeyboardAvoidingView>
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
  submitRow: { flexDirection: 'row', gap: 10 },
  input: { flex: 1, backgroundColor: colors.background, borderWidth: 0.5, borderColor: colors.border, borderRadius: 10, padding: 12, color: colors.textPrimary, fontSize: 14 },
  submitButton: { backgroundColor: colors.accent, borderRadius: 10, justifyContent: 'center', paddingHorizontal: 18 },
  submitButtonText: { color: colors.background, fontWeight: 'bold', fontSize: 13 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, marginBottom: 12 },
  emptyText: { color: colors.textSecondary, fontSize: 13 },
  leaderboardRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 10, gap: 10, borderRadius: 8 },
  leaderboardRowYou: { backgroundColor: '#161a10' },
  leaderboardRank: { fontWeight: '600', width: 16, color: colors.textSecondary, fontSize: 13 },
  leaderboardName: { flex: 1, color: colors.textPrimary, fontSize: 14 },
  leaderboardDistance: { fontWeight: '600', color: colors.textPrimary, fontSize: 13 },
  leaderboardTextYou: { color: colors.accent },
})