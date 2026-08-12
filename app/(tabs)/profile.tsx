import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native'

import { useSession } from '../../lib/auth-context'
import { getLevelLabel } from '../../lib/level'
import { supabase } from '../../lib/supabase'
import { cardShadow, colors, sectionLabel } from '../../lib/theme'

export default function ProfileScreen() {

  const router = useRouter()
  const { session, signOut } = useSession()
  const [username, setUsername] = useState('')
  const [eloRating, setEloRating] = useState(1200)
  const [gender, setGender] = useState<'male' | 'female' | 'unspecified'>('unspecified')
  const [myClubs, setMyClubs] = useState<any[]>([])
  const [myRaces, setMyRaces] = useState<any[]>([])
  const [totalDistance, setTotalDistance] = useState(0)
  const [racesWon, setRacesWon] = useState(0)
  const [formResults, setFormResults] = useState<{ raceId: any; won: boolean }[]>([])

  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)

  useEffect(() => {
    if (session) {
      fetchProfile()
      fetchMyClubs()
      fetchMyRacesAndStats()
    }
  }, [session])

  useFocusEffect(
    useCallback(() => {
      if (session) {
        fetchFollowCounts()
        fetchProfile()
      }
    }, [session])
  )

  async function fetchFollowCounts() {
    const [{ count: followers }, { count: following }] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', session?.user.id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', session?.user.id),
    ])

    setFollowerCount(followers ?? 0)
    setFollowingCount(following ?? 0)
  }

  async function fetchProfile() {
    const { data, error } = await supabase
      .from('profiles')
      .select('username, elo_rating, gender')
      .eq('id', session?.user.id)
      .single()

    console.log("PROFILE DATA:", data)
    console.log("PROFILE ERROR:", error)

    if (!error && data) {
      setUsername(data.username)
      setEloRating(data.elo_rating)
      setGender(data.gender ?? 'unspecified')
    }
  }

  async function updateGender(newGender: 'male' | 'female' | 'unspecified') {
    setGender(newGender)

    const { error } = await supabase
      .from('profiles')
      .update({ gender: newGender })
      .eq('id', session?.user.id)

    console.log("UPDATE GENDER ERROR:", error)
  }

  async function fetchMyClubs() {
    const { data, error } = await supabase
      .from('club_members')
      .select('club_id, clubs(id, name)')
      .eq('user_id', session?.user.id)

    console.log("PROFILE MY CLUBS:", data)

    if (!error && data) {
      setMyClubs(data.map((row: any) => row.clubs))
    }
  }

  async function fetchMyRacesAndStats() {
    const { data: participations, error } = await supabase
      .from('race_participants')
      .select('distance_km, race_id, races(id, name, end_date, target_distance_km)')
      .eq('user_id', session?.user.id)

    console.log("MY RACE PARTICIPATIONS:", participations)
    console.log("MY RACE PARTICIPATIONS ERROR:", error)

    if (error || !participations) return

    setMyRaces(participations)

    const total = participations.reduce((sum, row: any) => {
      return sum + (row.distance_km ?? 0)
    }, 0)
    setTotalDistance(total)

    const completedRaces = (participations as any[])
      .filter((row) => row.races && new Date(row.races.end_date) < new Date())
      .sort((a, b) => new Date(a.races.end_date).getTime() - new Date(b.races.end_date).getTime())

    let wins = 0
    const results: { raceId: any; won: boolean }[] = []

    for (const row of completedRaces) {
      const race = row.races

      const { data: allParticipants } = await supabase
        .from('race_participants')
        .select('user_id, duration_seconds, distance_km')
        .eq('race_id', race.id)
        .not('duration_seconds', 'is', null)
        .order('duration_seconds', { ascending: true })

      const finishers = (allParticipants ?? []).filter(
        (p: any) => !race.target_distance_km || (p.distance_km ?? 0) >= race.target_distance_km
      )

      const topFinisher = finishers[0]
      const won = !!(topFinisher && topFinisher.user_id === session?.user.id)

      if (won) wins++
      results.push({ raceId: race.id, won })
    }

    setRacesWon(wins)
    setFormResults(results.slice(-5))
  }

  if (!session) return null

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>

      <View style={styles.profileHeader}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarLetter}>
            {username?.[0]?.toUpperCase() ?? '?'}
          </Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.title}>{username || 'Runner'}</Text>
          <Text style={styles.email}>{session.user.email}</Text>
          <View style={styles.badgeRow}>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>{getLevelLabel(totalDistance)}</Text>
            </View>
            <View style={styles.eloBadge}>
              <Text style={styles.eloBadgeText}>{eloRating} ELO</Text>
            </View>
          </View>
          <View style={styles.followRow}>
            <TouchableOpacity onPress={() => router.push(`/user/${session.user.id}/followers`)}>
              <Text style={styles.followStat}>
                <Text style={styles.followNumber}>{followerCount}</Text> followers
              </Text>
            </TouchableOpacity>
            <Text style={styles.followSep}>·</Text>
            <TouchableOpacity onPress={() => router.push(`/user/${session.user.id}/following`)}>
              <Text style={styles.followStat}>
                <Text style={styles.followNumber}>{followingCount}</Text> following
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={signOut}>
          <Text style={styles.logoutButtonText}>Log out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.genderRow}>
        {(['male', 'female', 'unspecified'] as const).map((option) => (
          <TouchableOpacity
            key={option}
            style={[styles.genderChip, gender === option && styles.genderChipActive]}
            onPress={() => updateGender(option)}
          >
            <Text style={[styles.genderChipText, gender === option && styles.genderChipTextActive]}>
              {option === 'unspecified' ? 'Prefer not to say' : option === 'male' ? 'Male' : 'Female'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.statsCard}>
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{totalDistance.toFixed(1)}</Text>
          <Text style={styles.statLabel}>km total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statNumber, styles.statNumberAccent]}>{racesWon}</Text>
          <Text style={styles.statLabel}>races won</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={styles.statNumber}>{myRaces.length}</Text>
          <Text style={styles.statLabel}>races run</Text>
        </View>
      </View>

      {formResults.length > 0 && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Recent form</Text>
          <View style={styles.formStrip}>
            {formResults.map((result) => (
              <View
                key={result.raceId}
                style={[styles.formBox, result.won ? styles.formBoxWin : styles.formBoxLoss]}
              >
                <Text style={[styles.formBoxText, result.won ? styles.formBoxTextWin : styles.formBoxTextLoss]}>
                  {result.won ? 'W' : 'L'}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <Text style={[sectionLabel, styles.sectionTitle]}>Your clubs</Text>
      {myClubs.length === 0 && (
        <Text style={styles.emptyText}>You haven&apos;t joined any clubs yet.</Text>
      )}
      {myClubs.map((club) => (
        <TouchableOpacity key={club.id} style={styles.rowCard} onPress={() => router.push(`/club/${club.id}`)}>
          <View style={styles.rowIcon}>
            <Text style={styles.rowIconText}>{club.name?.[0]?.toUpperCase() ?? '?'}</Text>
          </View>
          <Text style={styles.rowText}>{club.name}</Text>
        </TouchableOpacity>
      ))}

      <Text style={[sectionLabel, styles.sectionTitle]}>Your races</Text>
      {myRaces.length === 0 && (
        <Text style={styles.emptyText}>You haven&apos;t joined any races yet.</Text>
      )}
      {myRaces.map((row: any, index) => (
        <TouchableOpacity
          key={index}
          style={styles.rowCard}
          onPress={() => router.push({ pathname: '/race/[id]', params: { id: row.race_id } })}
        >
          <View style={styles.rowIcon}>
            <Text style={styles.rowIconText}>{row.races?.name?.[0]?.toUpperCase() ?? '?'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowText}>{row.races?.name || 'Untitled race'}</Text>
            <Text style={styles.rowSubtext}>
              {row.distance_km !== null ? `${row.distance_km} km` : 'No result logged'}
            </Text>
          </View>
        </TouchableOpacity>
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
    paddingTop: 70,
    paddingBottom: 60,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 14,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: '#1c2b12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.accent,
  },
  profileInfo: {
    flex: 1,
  },
  logoutButton: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  logoutButtonText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    letterSpacing: -0.3,
  },
  email: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  levelBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#1c2b12',
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  levelBadgeText: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '600',
  },
  eloBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
  },
  eloBadgeText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '600',
  },
  followRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  followStat: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  followNumber: {
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  followSep: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  genderChip: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  genderChipActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  genderChipText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  genderChipTextActive: {
    color: colors.background,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 12,
    marginBottom: 16,
    ...cardShadow,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 0.5,
    backgroundColor: colors.border,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  statNumberAccent: {
    color: colors.accent,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 5,
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 24,
    ...cardShadow,
  },
  formTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  formStrip: {
    flexDirection: 'row',
    gap: 8,
  },
  formBox: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formBoxWin: {
    backgroundColor: '#1c2b12',
  },
  formBoxLoss: {
    backgroundColor: '#2b1414',
  },
  formBoxText: {
    fontSize: 13,
    fontWeight: 'bold',
  },
  formBoxTextWin: {
    color: colors.accent,
  },
  formBoxTextLoss: {
    color: colors.danger,
  },
  sectionTitle: {
    marginTop: 8,
    marginBottom: 12,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 15,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    gap: 12,
    ...cardShadow,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#1c2b12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconText: {
    color: colors.accent,
    fontWeight: 'bold',
    fontSize: 13,
  },
  rowText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  rowSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
})
