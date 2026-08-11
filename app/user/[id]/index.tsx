import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { FollowButton } from '../../../components/follow-button'
import { useSession } from '../../../lib/auth-context'
import { followUser, unfollowUser } from '../../../lib/follow'
import { getLevelLabel } from '../../../lib/level'
import { supabase } from '../../../lib/supabase'
import { colors } from '../../../lib/theme'

export default function UserProfileScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const navigation = useNavigation()
  const { session } = useSession()

  const [username, setUsername] = useState('')
  const [eloRating, setEloRating] = useState(1200)
  const [clubs, setClubs] = useState<any[]>([])
  const [races, setRaces] = useState<any[]>([])
  const [totalDistance, setTotalDistance] = useState(0)
  const [racesWon, setRacesWon] = useState(0)
  const [formResults, setFormResults] = useState<{ raceId: any; won: boolean }[]>([])
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [isFollowing, setIsFollowing] = useState(false)

  const isOwnProfile = id === session?.user.id

  useEffect(() => {
    if (id) {
      fetchProfile()
      fetchClubs()
      fetchRacesAndStats()
      fetchFollowCounts()
      fetchIsFollowing()
    }
  }, [id, session])

  useEffect(() => {
    if (username) {
      navigation.setOptions({ title: username })
    }
  }, [username])

  async function fetchProfile() {
    const { data, error } = await supabase
      .from('profiles')
      .select('username, elo_rating')
      .eq('id', id)
      .single()

    console.log("USER PROFILE:", data)
    console.log("USER PROFILE ERROR:", error)

    if (!error && data) {
      setUsername(data.username)
      setEloRating(data.elo_rating)
    }
  }

  async function fetchClubs() {
    const { data, error } = await supabase
      .from('club_members')
      .select('club_id, clubs(id, name)')
      .eq('user_id', id)

    console.log("USER CLUBS:", data)
    console.log("USER CLUBS ERROR:", error)

    if (!error && data) {
      setClubs(data.map((row: any) => row.clubs))
    }
  }

  async function fetchRacesAndStats() {
    const { data: participations, error } = await supabase
      .from('race_participants')
      .select('distance_km, race_id, races(id, name, end_date, target_distance_km)')
      .eq('user_id', id)

    console.log("USER RACE PARTICIPATIONS:", participations)
    console.log("USER RACE PARTICIPATIONS ERROR:", error)

    if (error || !participations) return

    setRaces(participations)

    const total = participations.reduce((sum, row: any) => sum + (row.distance_km ?? 0), 0)
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
      const won = !!(topFinisher && topFinisher.user_id === id)

      if (won) wins++
      results.push({ raceId: race.id, won })
    }

    setRacesWon(wins)
    setFormResults(results.slice(-5))
  }

  async function fetchFollowCounts() {
    const [{ count: followers }, { count: following }] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id),
    ])

    setFollowerCount(followers ?? 0)
    setFollowingCount(following ?? 0)
  }

  async function fetchIsFollowing() {
    if (isOwnProfile) return

    const { data } = await supabase
      .from('follows')
      .select('follower_id')
      .eq('follower_id', session?.user.id)
      .eq('following_id', id)
      .maybeSingle()

    setIsFollowing(!!data)
  }

  async function toggleFollow() {
    const currentlyFollowing = isFollowing

    setIsFollowing(!currentlyFollowing)
    setFollowerCount((prev) => prev + (currentlyFollowing ? -1 : 1))

    const targetId = Array.isArray(id) ? id[0] : id
    const { error } = currentlyFollowing
      ? await unfollowUser(session!.user.id, targetId)
      : await followUser(session!.user.id, targetId)

    if (error) {
      setIsFollowing(currentlyFollowing)
      setFollowerCount((prev) => prev + (currentlyFollowing ? 1 : -1))
    }
  }

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
          <View style={styles.badgeRow}>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>{getLevelLabel(totalDistance)}</Text>
            </View>
            <View style={styles.eloBadge}>
              <Text style={styles.eloBadgeText}>{eloRating} ELO</Text>
            </View>
          </View>
          <View style={styles.followRow}>
            <TouchableOpacity onPress={() => router.push(`/user/${id}/followers`)}>
              <Text style={styles.followStat}>
                <Text style={styles.followNumber}>{followerCount}</Text> followers
              </Text>
            </TouchableOpacity>
            <Text style={styles.followSep}>·</Text>
            <TouchableOpacity onPress={() => router.push(`/user/${id}/following`)}>
              <Text style={styles.followStat}>
                <Text style={styles.followNumber}>{followingCount}</Text> following
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        {!isOwnProfile && (
          <FollowButton isFollowing={isFollowing} onPress={toggleFollow} />
        )}
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
          <Text style={styles.statNumber}>{races.length}</Text>
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

      <Text style={styles.sectionTitle}>Clubs</Text>
      {clubs.length === 0 && (
        <Text style={styles.emptyText}>Not in any clubs yet.</Text>
      )}
      {clubs.map((club) => (
        <View key={club.id} style={styles.rowCard}>
          <View style={styles.rowIcon}>
            <Text style={styles.rowIconText}>{club.name?.[0]?.toUpperCase() ?? '?'}</Text>
          </View>
          <Text style={styles.rowText}>{club.name}</Text>
        </View>
      ))}

      <Text style={styles.sectionTitle}>Races</Text>
      {races.length === 0 && (
        <Text style={styles.emptyText}>No races yet.</Text>
      )}
      {races.map((row: any, index) => (
        <View key={index} style={styles.rowCard}>
          <View style={styles.rowIcon}>
            <Text style={styles.rowIconText}>{row.races?.name?.[0]?.toUpperCase() ?? '?'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowText}>{row.races?.name || 'Untitled race'}</Text>
            <Text style={styles.rowSubtext}>
              {row.distance_km !== null ? `${row.distance_km} km` : 'No result logged'}
            </Text>
          </View>
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
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    gap: 14,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.accent,
  },
  profileInfo: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textPrimary,
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
  statsCard: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 22,
    paddingHorizontal: 12,
    marginBottom: 16,
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
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
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
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 8,
    marginBottom: 10,
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
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: colors.background,
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
