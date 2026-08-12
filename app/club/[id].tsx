import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native'

import { useSession } from '../../lib/auth-context'
import { supabase } from '../../lib/supabase'
import { cardShadow, colors } from '../../lib/theme'

const GENDER_FILTERS: { key: 'all' | 'male' | 'female'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'male', label: 'Men' },
  { key: 'female', label: 'Women' },
]

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function formatShortDate(dateString: string) {
  return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function isRaceActive(endDate: string) {
  return new Date(endDate) > new Date()
}

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const { session } = useSession()

  const [clubName, setClubName] = useState('')
  const [clubCreatedAt, setClubCreatedAt] = useState<string | null>(null)
  const [members, setMembers] = useState<any[]>([])
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all')
  const [loading, setLoading] = useState(true)

  const [myClubs, setMyClubs] = useState<{ id: any; name: string }[]>([])
  const [switcherVisible, setSwitcherVisible] = useState(false)

  const [upcomingRaces, setUpcomingRaces] = useState<any[]>([])
  const [pastRaces, setPastRaces] = useState<any[]>([])
  const [participantCounts, setParticipantCounts] = useState<{ [raceId: string]: number }>({})
  const [raceResults, setRaceResults] = useState<{ [raceId: string]: { winnerId: string; winnerTime: number } | null }>({})

  const [modalVisible, setModalVisible] = useState(false)
  const [raceName, setRaceName] = useState('')
  const [targetDistanceInput, setTargetDistanceInput] = useState('5')
  const [autoJoin, setAutoJoin] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (id && session) {
      fetchClubAndMembers()
      fetchMyClubs()
      fetchClubRaces()
    }
  }, [id, session])

  async function fetchClubAndMembers() {
    setLoading(true)

    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .select('name, created_at')
      .eq('id', id)
      .single()

    console.log("CLUB DETAIL:", club)
    console.log("CLUB DETAIL ERROR:", clubError)

    if (!clubError && club) {
      setClubName(club.name)
      setClubCreatedAt(club.created_at)
    }

    const { data: memberRows, error: memberError } = await supabase
      .from('club_members')
      .select('user_id')
      .eq('club_id', id)

    console.log("CLUB MEMBERS:", memberRows)
    console.log("CLUB MEMBERS ERROR:", memberError)

    if (!memberError && memberRows && memberRows.length > 0) {
      const userIds = memberRows.map((row: any) => row.user_id)

      const { data: profileRows, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, elo_rating, gender')
        .in('id', userIds)

      console.log("CLUB MEMBER PROFILES:", profileRows)
      console.log("CLUB MEMBER PROFILES ERROR:", profileError)

      if (!profileError && profileRows) {
        const ranked = [...profileRows].sort((a, b) => (b.elo_rating ?? 1200) - (a.elo_rating ?? 1200))
        setMembers(ranked)
      }
    } else {
      setMembers([])
    }

    setLoading(false)
  }

  async function fetchMyClubs() {
    const { data: memberships, error } = await supabase
      .from('club_members')
      .select('club_id')
      .eq('user_id', session?.user.id)

    if (error || !memberships || memberships.length === 0) {
      setMyClubs([])
      return
    }

    const clubIds = memberships.map((row: any) => row.club_id)

    const { data: clubRows, error: clubsError } = await supabase
      .from('clubs')
      .select('id, name')
      .in('id', clubIds)

    console.log("MY CLUBS ERROR:", clubsError)

    if (!clubsError && clubRows) {
      setMyClubs(clubRows)
    }
  }

  async function fetchClubRaces() {
    const { data, error } = await supabase
      .from('races')
      .select('id, name, start_date, end_date, target_distance_km, created_by')
      .eq('club_id', id)
      .order('start_date', { ascending: true })

    console.log("CLUB RACES:", data)
    console.log("CLUB RACES ERROR:", error)

    if (error || !data) return

    const upcoming = data.filter((r: any) => isRaceActive(r.end_date))
    const past = data.filter((r: any) => !isRaceActive(r.end_date)).reverse()

    setUpcomingRaces(upcoming)
    setPastRaces(past)
    fetchParticipantCounts(data.map((r: any) => r.id))
    fetchRaceResults(past)
  }

  async function fetchParticipantCounts(raceIds: any[]) {
    if (raceIds.length === 0) return

    const { data, error } = await supabase
      .from('race_participants')
      .select('race_id')
      .in('race_id', raceIds)

    console.log("CLUB RACE PARTICIPANT COUNTS ERROR:", error)

    if (!error && data) {
      const counts: { [raceId: string]: number } = {}
      data.forEach((row: any) => {
        counts[row.race_id] = (counts[row.race_id] ?? 0) + 1
      })
      setParticipantCounts(counts)
    }
  }

  async function fetchRaceResults(races: any[]) {
    const results: { [raceId: string]: { winnerId: string; winnerTime: number } | null } = {}

    await Promise.all(
      races.map(async (race) => {
        const { data, error } = await supabase
          .from('race_participants')
          .select('user_id, duration_seconds, distance_km')
          .eq('race_id', race.id)
          .not('duration_seconds', 'is', null)
          .order('duration_seconds', { ascending: true })

        if (error || !data) {
          results[race.id] = null
          return
        }

        const finishers = data.filter(
          (p: any) => !race.target_distance_km || (p.distance_km ?? 0) >= race.target_distance_km
        )

        results[race.id] = finishers[0]
          ? { winnerId: finishers[0].user_id, winnerTime: finishers[0].duration_seconds }
          : null
      })
    )

    setRaceResults(results)
  }

  async function joinClub() {
    const { error } = await supabase
      .from('club_members')
      .insert({ club_id: id, user_id: session?.user.id })

    console.log("JOIN CLUB ERROR:", error)

    if (!error) {
      fetchClubAndMembers()
      fetchMyClubs()
    }
  }

  async function createClubRace() {
    if (raceName.trim().length === 0) {
      setMessage('Please enter a race name')
      return
    }

    const targetDistanceKm = parseFloat(targetDistanceInput)

    if (isNaN(targetDistanceKm) || targetDistanceKm <= 0) {
      setMessage('Enter a valid target distance')
      return
    }

    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(endDate.getDate() + 3)

    const { data, error } = await supabase
      .from('races')
      .insert({
        name: raceName.trim(),
        created_by: session?.user.id,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        club_id: id,
        is_private: false,
        race_type: 'live_race',
        target_distance_km: targetDistanceKm,
      })
      .select()
      .single()

    console.log("CLUB RACE ERROR:", error)

    if (error) {
      setMessage(error.message)
      return
    }

    if (autoJoin) {
      const { error: joinError } = await supabase
        .from('race_participants')
        .insert({ race_id: data.id, user_id: session?.user.id })

      console.log("CLUB RACE AUTO-JOIN ERROR:", joinError)
    }

    setRaceName('')
    setTargetDistanceInput('5')
    setAutoJoin(true)
    setMessage('')
    setModalVisible(false)
    router.push({ pathname: '/race/[id]', params: { id: data.id } })
  }

  function medalStyle(rank: number) {
    if (rank === 0) return styles.rankGold
    if (rank === 1) return styles.rankSilver
    if (rank === 2) return styles.rankBronze
    return null
  }

  function usernameFor(userId: string) {
    return members.find((m) => m.id === userId)?.username ?? 'Unknown'
  }

  const filteredMembers = members.filter((member) => {
    if (genderFilter === 'all') return true
    return member.gender === genderFilter
  })

  const isMember = members.some((member) => member.id === session?.user.id)
  const topElo = members[0]?.elo_rating ?? null

  if (loading) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Loading club…</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.clubAvatar}>
            <Text style={styles.clubAvatarText}>{clubName?.[0]?.toUpperCase() ?? '?'}</Text>
          </View>

          {myClubs.length > 1 && (
            <TouchableOpacity style={styles.switcherButton} onPress={() => setSwitcherVisible(true)}>
              <Text style={styles.switcherButtonText} numberOfLines={1}>Switch club</Text>
              <MaterialIcons name="unfold-more" size={16} color={colors.textPrimary} />
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.clubTitle}>{clubName || 'Club'}</Text>
        <Text style={styles.clubSubtitle}>
          {members.length} member{members.length === 1 ? '' : 's'}
          {clubCreatedAt ? ` · Est. ${new Date(clubCreatedAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}` : ''}
        </Text>

        {isMember && (
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{members.length}</Text>
              <Text style={styles.statLabel}>Members</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={styles.statNumber}>{upcomingRaces.length + pastRaces.length}</Text>
              <Text style={styles.statLabel}>Races hosted</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statNumber, styles.statNumberAccent]}>{topElo ?? '—'}</Text>
              <Text style={styles.statLabel}>Top ELO</Text>
            </View>
          </View>
        )}
      </View>

      {!isMember && (
        <>
          <TouchableOpacity style={styles.joinCard} onPress={joinClub}>
            <View style={{ flex: 1 }}>
              <Text style={styles.joinCardTitle}>Join {clubName || 'this club'}</Text>
              <Text style={styles.joinCardSubtitle}>
                See the full leaderboard, race results, and upcoming races.
              </Text>
            </View>
            <MaterialIcons name="arrow-forward" size={22} color={colors.background} />
          </TouchableOpacity>

          <Text style={[styles.sectionTitle, styles.sectionSpaced]}>Leaderboard preview</Text>
        </>
      )}

      {isMember && (
        <>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Upcoming races</Text>
            <TouchableOpacity style={styles.hostPill} onPress={() => setModalVisible(true)}>
              <MaterialIcons name="add" size={16} color={colors.background} />
              <Text style={styles.hostPillText}>Host</Text>
            </TouchableOpacity>
          </View>

          {upcomingRaces.length === 0 && (
            <Text style={styles.emptyText}>No upcoming races yet — host one to get things started.</Text>
          )}
          {upcomingRaces.map((race) => (
            <TouchableOpacity
              key={race.id}
              style={styles.raceCard}
              onPress={() => router.push({ pathname: '/race/[id]', params: { id: race.id } })}
            >
              <View style={styles.raceDateChip}>
                <Text style={styles.raceDateChipText}>{formatShortDate(race.start_date)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.raceCardTitle}>{race.name}</Text>
                <Text style={styles.raceCardMeta}>
                  {race.target_distance_km ? `${race.target_distance_km} km · ` : ''}
                  {participantCounts[race.id] ?? 0} joined
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}

          <Text style={[styles.sectionTitle, styles.sectionSpaced]}>Recent results</Text>

          {pastRaces.length === 0 && (
            <Text style={styles.emptyText}>No races run yet.</Text>
          )}
          {pastRaces.map((race) => {
            const result = raceResults[race.id]

            return (
              <TouchableOpacity
                key={race.id}
                style={styles.raceCard}
                onPress={() => router.push({ pathname: '/race/[id]', params: { id: race.id } })}
              >
                <View style={styles.raceDateChipMuted}>
                  <Text style={styles.raceDateChipMutedText}>{formatShortDate(race.end_date)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.raceCardTitle}>{race.name}</Text>
                  <Text style={styles.raceCardMeta}>
                    {result
                      ? `Won by ${usernameFor(result.winnerId)} · ${formatDuration(result.winnerTime)}`
                      : `${participantCounts[race.id] ?? 0} joined · no results yet`}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            )
          })}

          <Text style={[styles.sectionTitle, styles.sectionSpaced]}>Leaderboard</Text>
        </>
      )}

      <View style={styles.filterRow}>
        {GENDER_FILTERS.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[styles.chip, genderFilter === option.key && styles.chipActive]}
            onPress={() => setGenderFilter(option.key)}
          >
            <Text style={[styles.chipText, genderFilter === option.key && styles.chipTextActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filteredMembers.length === 0 && (
        <Text style={styles.emptyText}>No members in this view yet.</Text>
      )}

      {(isMember ? filteredMembers : filteredMembers.slice(0, 3)).map((member, index) => (
        <TouchableOpacity
          key={member.id}
          style={styles.standingRow}
          onPress={() => router.push(`/user/${member.id}`)}
        >
          <View style={[styles.rankBadge, medalStyle(index)]}>
            <Text style={[styles.rankBadgeText, medalStyle(index) && styles.rankBadgeTextMedal]}>
              {index + 1}
            </Text>
          </View>

          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLetter}>
              {member.username?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>

          <Text style={styles.username}>{member.username}</Text>
          <Text style={styles.elo}>{member.elo_rating}</Text>
        </TouchableOpacity>
      ))}

      {!isMember && filteredMembers.length > 3 && (
        <Text style={styles.moreMembersHint}>
          + {filteredMembers.length - 3} more · join to see the full board
        </Text>
      )}

      <Modal
        visible={switcherVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSwitcherVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Your clubs</Text>
            {myClubs.map((club) => (
              <TouchableOpacity
                key={club.id}
                style={[styles.switcherRow, String(club.id) === String(id) && styles.switcherRowActive]}
                onPress={() => {
                  setSwitcherVisible(false)
                  if (String(club.id) !== String(id)) {
                    router.replace(`/club/${club.id}`)
                  }
                }}
              >
                <Text style={styles.switcherRowText}>{club.name || 'Untitled club'}</Text>
                {String(club.id) === String(id) && (
                  <MaterialIcons name="check" size={18} color={colors.accent} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelButton} onPress={() => setSwitcherVisible(false)}>
              <Text style={styles.cancelButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Host a race</Text>

            <TextInput
              placeholder="Race name"
              placeholderTextColor={colors.textSecondary}
              value={raceName}
              onChangeText={setRaceName}
              style={styles.input}
            />

            <Text style={styles.modalLabel}>Target distance (km)</Text>
            <TextInput
              placeholder="e.g. 5"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={targetDistanceInput}
              onChangeText={setTargetDistanceInput}
              style={styles.input}
            />

            <View style={styles.joinToggleRow}>
              <Text style={styles.modalLabel}>Join this race</Text>
              <Switch
                value={autoJoin}
                onValueChange={setAutoJoin}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.textPrimary}
              />
            </View>

            {message ? <Text style={styles.message}>{message}</Text> : null}

            <TouchableOpacity style={styles.primaryButton} onPress={createClubRace}>
              <Text style={styles.primaryButtonText}>Create race (3 day window)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
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
    padding: 20,
    paddingTop: 20,
    paddingBottom: 60,
  },
  emptyContainer: { flex: 1, padding: 28, paddingTop: 70, backgroundColor: colors.background },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 22,
    marginBottom: 24,
    ...cardShadow,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  clubAvatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#1c2b12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubAvatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.accent,
  },
  switcherButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    maxWidth: 160,
  },
  switcherButtonText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  clubTitle: {
    fontSize: 30,
    fontWeight: 'bold',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  clubSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 20,
    paddingTop: 18,
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statDivider: { width: 0.5, backgroundColor: colors.border },
  statNumber: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary },
  statNumberAccent: { color: colors.accent },
  statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  joinCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 18,
    padding: 20,
    marginBottom: 8,
    ...cardShadow,
  },
  joinCardTitle: { fontSize: 17, fontWeight: 'bold', color: colors.background },
  joinCardSubtitle: { fontSize: 12, color: colors.background, opacity: 0.75, marginTop: 4 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  sectionSpaced: { marginTop: 26 },
  hostPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  hostPillText: { color: colors.background, fontSize: 12, fontWeight: 'bold' },
  raceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    ...cardShadow,
  },
  raceDateChip: {
    backgroundColor: '#1c2b12',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  raceDateChipText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  raceDateChipMuted: {
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  raceDateChipMutedText: { color: colors.textSecondary, fontSize: 11, fontWeight: '700' },
  raceCardTitle: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  raceCardMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 3 },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  chip: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.background },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 12,
  },
  standingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    gap: 12,
    ...cardShadow,
  },
  rankBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankGold: { backgroundColor: '#e8ff2e' },
  rankSilver: { backgroundColor: '#c7cbd1' },
  rankBronze: { backgroundColor: '#cd8a4f' },
  rankBadgeText: { fontWeight: '700', color: colors.textSecondary, fontSize: 12 },
  rankBadgeTextMedal: { color: colors.background },
  avatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.background,
    borderWidth: 0.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 15,
    fontWeight: 'bold',
    color: colors.accent,
  },
  username: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  elo: {
    color: colors.accent,
    fontWeight: 'bold',
    fontSize: 16,
  },
  moreMembersHint: {
    color: colors.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 18 },
  modalLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 10 },
  switcherRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  switcherRowActive: {},
  switcherRowText: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  joinToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  input: { backgroundColor: colors.background, borderWidth: 0.5, borderColor: colors.border, borderRadius: 12, padding: 14, marginBottom: 18, color: colors.textPrimary, fontSize: 15 },
  message: { color: colors.textSecondary, fontSize: 13, marginBottom: 16 },
  primaryButton: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  primaryButtonText: { color: colors.background, fontWeight: 'bold', fontSize: 14 },
  cancelButton: { alignItems: 'center', paddingVertical: 10 },
  cancelButtonText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
})
