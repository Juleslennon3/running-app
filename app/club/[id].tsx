import { useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import {
    ScrollView,
    StyleSheet,
    Text,
    View
} from 'react-native'

import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'

const POINTS_BY_POSITION = [10, 7, 5]
const PARTICIPATION_POINTS = 2

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams()
  const [clubName, setClubName] = useState('')
  const [standings, setStandings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (id) {
      fetchClubAndStandings()
    }
  }, [id])

  async function fetchClubAndStandings() {
    setLoading(true)

    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .select('name')
      .eq('id', id)
      .single()

    console.log("CLUB DETAIL:", club)
    console.log("CLUB DETAIL ERROR:", clubError)

    if (!clubError && club) {
      setClubName(club.name)
    }

    const { data: races, error: racesError } = await supabase
      .from('races')
      .select('id, race_type')
      .eq('club_id', id)

    console.log("CLUB RACES:", races)
    console.log("CLUB RACES ERROR:", racesError)

    if (racesError || !races || races.length === 0) {
      setStandings([])
      setLoading(false)
      return
    }

    const pointsByUser: { [userId: string]: { points: number; username: string } } = {}

    for (const race of races) {
      const isLiveRace = race.race_type === 'live_race'

      const { data: participants } = await supabase
        .from('race_participants')
        .select('user_id, distance_km, duration_seconds, profiles(username)')
        .eq('race_id', race.id)
        .not(isLiveRace ? 'duration_seconds' : 'distance_km', 'is', null)
        .order(isLiveRace ? 'duration_seconds' : 'distance_km', { ascending: isLiveRace })

      if (!participants) continue

      participants.forEach((p: any, index: number) => {
        const points = POINTS_BY_POSITION[index] ?? PARTICIPATION_POINTS

        if (!pointsByUser[p.user_id]) {
          pointsByUser[p.user_id] = {
            points: 0,
            username: p.profiles?.username ?? 'Unknown',
          }
        }
        pointsByUser[p.user_id].points += points
      })
    }

    const standingsArray = Object.values(pointsByUser).sort((a, b) => b.points - a.points)

    console.log("STANDINGS:", standingsArray)

    setStandings(standingsArray)
    setLoading(false)
  }

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{clubName || 'Club'}</Text>
      <Text style={styles.subtitle}>Standings across all races</Text>

      {loading && <Text style={styles.emptyText}>Loading standings…</Text>}

      {!loading && standings.length === 0 && (
        <Text style={styles.emptyText}>
          No results yet. Standings appear once members submit race results.
        </Text>
      )}

      {standings.map((entry, index) => (
        <View key={index} style={styles.standingRow}>
          <Text style={styles.rank}>{index + 1}</Text>
          <Text style={styles.username}>{entry.username}</Text>
          <Text style={styles.points}>{entry.points} pts</Text>
        </View>
      ))}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 28,
    paddingTop: 20,
    paddingBottom: 60,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 24,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  standingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  rank: {
    color: colors.accent,
    fontWeight: 'bold',
    fontSize: 15,
    width: 20,
  },
  username: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  points: {
    color: colors.textPrimary,
    fontWeight: 'bold',
    fontSize: 14,
  },
})