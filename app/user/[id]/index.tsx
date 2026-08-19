import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native'

import { FollowButton } from '../../../components/follow-button'
import { useSession } from '../../../lib/auth-context'
import { DISTANCE_CATEGORIES } from '../../../lib/distance-categories'
import { followUser, unfollowUser } from '../../../lib/follow'
import { getLevelLabel } from '../../../lib/level'
import { supabase } from '../../../lib/supabase'
import { avatarColors, cardShadow, colors, sectionLabel } from '../../../lib/theme'

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
  const [challengeModalVisible, setChallengeModalVisible] = useState(false)
  const [challengeKm, setChallengeKm] = useState(DISTANCE_CATEGORIES[1].km)
  const [challengeUsingCustom, setChallengeUsingCustom] = useState(false)
  const [challengeCustomInput, setChallengeCustomInput] = useState('')
  const [challengeMessage, setChallengeMessage] = useState('')

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

  async function sendChallenge() {
    const distanceKm = challengeUsingCustom ? parseFloat(challengeCustomInput) : challengeKm

    if (!distanceKm || isNaN(distanceKm) || distanceKm <= 0) {
      setChallengeMessage('Enter a valid distance')
      return
    }

    const targetId = Array.isArray(id) ? id[0] : id
    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + 3)

    const { data, error } = await supabase
      .from('races')
      .insert({
        name: `Challenge: ${username}`,
        created_by: session?.user.id,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        club_id: null,
        is_private: true,
        race_type: 'live_race',
        target_distance_km: distanceKm,
      })
      .select()
      .single()

    console.log("CHALLENGE RACE ERROR:", error)

    if (error || !data) {
      setChallengeMessage(error?.message ?? 'Something went wrong')
      return
    }

    const { error: joinError } = await supabase
      .from('race_participants')
      .insert({ race_id: data.id, user_id: session?.user.id })

    console.log("CHALLENGE AUTO-JOIN ERROR:", joinError)

    const { error: inviteError } = await supabase
      .from('race_invites')
      .insert({ race_id: data.id, invited_user_id: targetId, invited_by: session?.user.id })

    console.log("CHALLENGE INVITE ERROR:", inviteError)

    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({ user_id: targetId, actor_id: session?.user.id, type: 'race_invite', race_id: data.id })

    console.log("CHALLENGE NOTIFICATION ERROR:", notificationError)

    setChallengeModalVisible(false)
    setChallengeMessage('')
    router.push({ pathname: '/race/[id]', params: { id: data.id } })
  }

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>

      <View style={styles.profileHeader}>
        <View style={[styles.avatarCircle, { backgroundColor: avatarColors(username).bg }]}>
          <Text style={[styles.avatarLetter, { color: avatarColors(username).text }]}>
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
          <View style={styles.actionColumn}>
            <FollowButton isFollowing={isFollowing} onPress={toggleFollow} />
            <TouchableOpacity style={styles.challengeButton} onPress={() => setChallengeModalVisible(true)}>
              <Text style={styles.challengeButtonText}>Challenge</Text>
            </TouchableOpacity>
          </View>
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

      <Text style={[sectionLabel, styles.sectionTitle]}>Clubs</Text>
      {clubs.length === 0 && (
        <Text style={styles.emptyText}>Not in any clubs yet.</Text>
      )}
      {clubs.map((club) => (
        <TouchableOpacity key={club.id} style={styles.rowCard} onPress={() => router.push(`/club/${club.id}`)}>
          <View style={styles.rowIcon}>
            <Text style={styles.rowIconText}>{club.name?.[0]?.toUpperCase() ?? '?'}</Text>
          </View>
          <Text style={styles.rowText}>{club.name}</Text>
        </TouchableOpacity>
      ))}

      <Text style={[sectionLabel, styles.sectionTitle]}>Races</Text>
      {races.length === 0 && (
        <Text style={styles.emptyText}>No races yet.</Text>
      )}
      {races.map((row: any, index) => (
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

      <Modal
        visible={challengeModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setChallengeModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Challenge {username}</Text>

            <View style={styles.chipRow}>
              {DISTANCE_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat.slug}
                  style={[styles.chip, !challengeUsingCustom && challengeKm === cat.km && styles.chipActive]}
                  onPress={() => {
                    setChallengeUsingCustom(false)
                    setChallengeKm(cat.km)
                  }}
                >
                  <Text style={[styles.chipText, !challengeUsingCustom && challengeKm === cat.km && styles.chipTextActive]}>
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.chip, challengeUsingCustom && styles.chipActive]}
                onPress={() => setChallengeUsingCustom(true)}
              >
                <Text style={[styles.chipText, challengeUsingCustom && styles.chipTextActive]}>Custom</Text>
              </TouchableOpacity>
            </View>

            {challengeUsingCustom && (
              <TextInput
                placeholder="Distance in km"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={challengeCustomInput}
                onChangeText={setChallengeCustomInput}
                style={styles.input}
              />
            )}

            {challengeMessage ? <Text style={styles.message}>{challengeMessage}</Text> : null}

            <TouchableOpacity style={styles.primaryButton} onPress={sendChallenge}>
              <Text style={styles.primaryButtonText}>Send challenge</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={() => setChallengeModalVisible(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    letterSpacing: -0.3,
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
  actionColumn: {
    gap: 8,
    alignItems: 'stretch',
  },
  challengeButton: {
    backgroundColor: colors.accent,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  challengeButtonText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 18 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.background },
  input: { backgroundColor: colors.background, borderWidth: 0.5, borderColor: colors.border, borderRadius: 12, padding: 14, marginBottom: 18, color: colors.textPrimary, fontSize: 15 },
  message: { color: colors.textSecondary, fontSize: 13, marginBottom: 16 },
  primaryButton: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  primaryButtonText: { color: colors.background, fontWeight: 'bold', fontSize: 14 },
  cancelButton: { alignItems: 'center', paddingVertical: 10 },
  cancelButtonText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
})
