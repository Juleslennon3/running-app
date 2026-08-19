import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useRouter } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
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

import { useSession } from '../lib/auth-context'
import { supabase } from '../lib/supabase'
import { avatarColors, cardShadow, colors, gradients, sectionLabel } from '../lib/theme'

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

function formatRelativeTime(dateString: string) {
  const diffMs = Date.now() - new Date(dateString).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  return `${weeks}w ago`
}

function isRaceActive(endDate: string) {
  return new Date(endDate) > new Date()
}

type FeedItem = {
  id: string
  text: string
  timestamp: string
  icon: keyof typeof MaterialIcons.glyphMap
}

export function ClubBody({
  clubId,
  myClubs,
  onSwitchClub,
}: {
  clubId: string | number
  myClubs: { id: any; name: string }[]
  onSwitchClub: (clubId: any) => void
}) {
  const router = useRouter()
  const { session } = useSession()

  const [clubName, setClubName] = useState('')
  const [clubCreatedAt, setClubCreatedAt] = useState<string | null>(null)
  const [clubCreatedBy, setClubCreatedBy] = useState<string | null>(null)
  const [members, setMembers] = useState<any[]>([])
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all')
  const [loading, setLoading] = useState(true)
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

  const [workouts, setWorkouts] = useState<any[]>([])
  const [workoutCounts, setWorkoutCounts] = useState<{ [workoutId: string]: { total: number; completed: number } }>({})
  const [coachModalVisible, setCoachModalVisible] = useState(false)
  const [workoutModalVisible, setWorkoutModalVisible] = useState(false)
  const [workoutName, setWorkoutName] = useState('')
  const [workoutReps, setWorkoutReps] = useState('4')
  const [workoutDistancePerRep, setWorkoutDistancePerRep] = useState('2')
  const [workoutRestSeconds, setWorkoutRestSeconds] = useState('90')
  const [workoutNotes, setWorkoutNotes] = useState('')
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<Set<string>>(new Set())
  const [workoutMessage, setWorkoutMessage] = useState('')

  useEffect(() => {
    if (clubId && session) {
      fetchClubAndMembers()
      fetchClubRaces()
      fetchWorkouts()
    }
  }, [clubId, session])

  async function fetchClubAndMembers() {
    setLoading(true)

    const { data: club, error: clubError } = await supabase
      .from('clubs')
      .select('name, created_at, created_by')
      .eq('id', clubId)
      .single()

    console.log("CLUB DETAIL:", club)
    console.log("CLUB DETAIL ERROR:", clubError)

    if (!clubError && club) {
      setClubName(club.name)
      setClubCreatedAt(club.created_at)
      setClubCreatedBy(club.created_by)
    }

    const { data: memberRows, error: memberError } = await supabase
      .from('club_members')
      .select('user_id, created_at, role')
      .eq('club_id', clubId)

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
        const withJoinDates = profileRows.map((p: any) => ({
          ...p,
          joinedAt: memberRows.find((r: any) => r.user_id === p.id)?.created_at,
          role: memberRows.find((r: any) => r.user_id === p.id)?.role ?? 'member',
        }))
        const ranked = withJoinDates.sort((a, b) => (b.elo_rating ?? 1200) - (a.elo_rating ?? 1200))
        setMembers(ranked)
      }
    } else {
      setMembers([])
    }

    setLoading(false)
  }

  async function fetchWorkouts() {
    const { data, error } = await supabase
      .from('workouts')
      .select('id, name, reps, distance_per_rep_km, rest_seconds, notes, created_by, created_at')
      .eq('club_id', clubId)
      .order('created_at', { ascending: false })

    console.log("CLUB WORKOUTS:", data)
    console.log("CLUB WORKOUTS ERROR:", error)

    if (error || !data) return

    setWorkouts(data)
    fetchWorkoutCounts(data.map((w: any) => w.id))
  }

  async function fetchWorkoutCounts(workoutIds: any[]) {
    if (workoutIds.length === 0) return

    const { data, error } = await supabase
      .from('workout_assignments')
      .select('workout_id, completed_at')
      .in('workout_id', workoutIds)

    console.log("WORKOUT ASSIGNMENT COUNTS ERROR:", error)

    if (error || !data) return

    const counts: { [workoutId: string]: { total: number; completed: number } } = {}
    data.forEach((row: any) => {
      if (!counts[row.workout_id]) counts[row.workout_id] = { total: 0, completed: 0 }
      counts[row.workout_id].total += 1
      if (row.completed_at) counts[row.workout_id].completed += 1
    })
    setWorkoutCounts(counts)
  }

  async function fetchClubRaces() {
    const { data, error } = await supabase
      .from('races')
      .select('id, name, start_date, end_date, target_distance_km, created_by, created_at')
      .eq('club_id', clubId)
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
      .insert({ club_id: clubId, user_id: session?.user.id })

    console.log("JOIN CLUB ERROR:", error)

    if (!error) {
      fetchClubAndMembers()
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
        club_id: clubId,
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

  function toggleAssignee(userId: string) {
    setSelectedAssigneeIds((prev) => {
      const next = new Set(prev)
      next.has(userId) ? next.delete(userId) : next.add(userId)
      return next
    })
  }

  async function assignWorkout() {
    if (workoutName.trim().length === 0) {
      setWorkoutMessage('Please enter a workout name')
      return
    }

    const reps = parseInt(workoutReps, 10)
    const distancePerRep = parseFloat(workoutDistancePerRep)

    if (isNaN(reps) || reps <= 0 || isNaN(distancePerRep) || distancePerRep <= 0) {
      setWorkoutMessage('Enter a valid rep count and distance')
      return
    }

    if (selectedAssigneeIds.size === 0) {
      setWorkoutMessage('Select at least one person to assign this to')
      return
    }

    const restSeconds = workoutRestSeconds.trim().length > 0 ? parseInt(workoutRestSeconds, 10) : null

    const { error } = await supabase.rpc('assign_workout', {
      p_club_id: clubId,
      p_name: workoutName.trim(),
      p_reps: reps,
      p_distance_per_rep_km: distancePerRep,
      p_rest_seconds: restSeconds,
      p_notes: workoutNotes.trim() || null,
      p_assignee_ids: [...selectedAssigneeIds],
    })

    console.log("ASSIGN WORKOUT ERROR:", error)

    if (error) {
      setWorkoutMessage(error.message)
      return
    }

    setWorkoutName('')
    setWorkoutReps('4')
    setWorkoutDistancePerRep('2')
    setWorkoutRestSeconds('90')
    setWorkoutNotes('')
    setSelectedAssigneeIds(new Set())
    setWorkoutMessage('')
    setWorkoutModalVisible(false)
    fetchWorkouts()
  }

  async function toggleCoach(userId: string, currentlyCoach: boolean) {
    const { error } = await supabase.rpc('set_club_member_role', {
      p_club_id: clubId,
      p_user_id: userId,
      p_role: currentlyCoach ? 'member' : 'coach',
    })

    console.log("SET CLUB MEMBER ROLE ERROR:", error)

    if (!error) {
      fetchClubAndMembers()
    }
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

  function buildFeed(): FeedItem[] {
    const items: FeedItem[] = []

    members.forEach((m) => {
      if (m.joinedAt) {
        items.push({
          id: `join-${m.id}`,
          text: `${m.username} joined the club`,
          timestamp: m.joinedAt,
          icon: 'person-add',
        })
      }
    })

    ;[...upcomingRaces, ...pastRaces].forEach((race) => {
      if (race.created_at) {
        items.push({
          id: `race-${race.id}`,
          text: `${usernameFor(race.created_by)} scheduled ${race.name}`,
          timestamp: race.created_at,
          icon: 'event',
        })
      }

      const result = raceResults[race.id]
      if (result) {
        items.push({
          id: `result-${race.id}`,
          text: `${usernameFor(result.winnerId)} won ${race.name} in ${formatDuration(result.winnerTime)}`,
          timestamp: race.end_date,
          icon: 'emoji-events',
        })
      }
    })

    return items
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 12)
  }

  const filteredMembers = members.filter((member) => {
    if (genderFilter === 'all') return true
    return member.gender === genderFilter
  })

  const isMember = members.some((member) => member.id === session?.user.id)
  const isCreator = !!clubCreatedBy && clubCreatedBy === session?.user.id
  const myRole = members.find((member) => member.id === session?.user.id)?.role
  const isCoach = isCreator || myRole === 'coach'
  const topElo = members[0]?.elo_rating ?? null
  const feed = isMember ? buildFeed() : []

  if (loading) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Loading club…</Text>
      </View>
    )
  }

  return (
    <>
      <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.clubAvatar}>
            <Text style={styles.clubAvatarText}>{clubName?.[0]?.toUpperCase() ?? '?'}</Text>
          </View>

          <View style={styles.heroTopRightRow}>
            {isCreator && (
              <TouchableOpacity style={styles.switcherButton} onPress={() => setCoachModalVisible(true)}>
                <MaterialIcons name="military-tech" size={16} color={colors.textPrimary} />
                <Text style={styles.switcherButtonText} numberOfLines={1}>Coaches</Text>
              </TouchableOpacity>
            )}
            {myClubs.length > 1 && (
              <TouchableOpacity style={styles.switcherButton} onPress={() => setSwitcherVisible(true)}>
                <Text style={styles.switcherButtonText} numberOfLines={1}>Switch club</Text>
                <MaterialIcons name="unfold-more" size={16} color={colors.textPrimary} />
              </TouchableOpacity>
            )}
          </View>
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
      </LinearGradient>

      {!isMember && (
        <>
          <TouchableOpacity onPress={joinClub}>
            <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.joinCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.joinCardTitle}>Join {clubName || 'this club'}</Text>
                <Text style={styles.joinCardSubtitle}>
                  See the full leaderboard, race results, and upcoming races.
                </Text>
              </View>
              <MaterialIcons name="arrow-forward" size={22} color={colors.background} />
            </LinearGradient>
          </TouchableOpacity>

          <Text style={[sectionLabel, styles.sectionSpaced]}>Leaderboard preview</Text>
        </>
      )}

      {isMember && (
        <>
          {feed.length > 0 && (
            <>
              <Text style={sectionLabel}>Club feed</Text>
              <View style={styles.feedCard}>
                {feed.map((item, index) => (
                  <View key={item.id} style={[styles.feedRow, index === feed.length - 1 && styles.feedRowLast]}>
                    <View style={styles.feedIconWrap}>
                      <MaterialIcons name={item.icon} size={16} color={colors.accent} />
                    </View>
                    <Text style={styles.feedText}>{item.text}</Text>
                    <Text style={styles.feedTime}>{formatRelativeTime(item.timestamp)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          <View style={styles.sectionHeaderRow}>
            <Text style={sectionLabel}>Upcoming races</Text>
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

          <Text style={[sectionLabel, styles.sectionSpaced]}>Recent results</Text>

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

          <View style={[styles.sectionHeaderRow, styles.sectionSpaced]}>
            <Text style={sectionLabel}>Training</Text>
            {isCoach && (
              <TouchableOpacity style={styles.hostPill} onPress={() => setWorkoutModalVisible(true)}>
                <MaterialIcons name="add" size={16} color={colors.background} />
                <Text style={styles.hostPillText}>Assign</Text>
              </TouchableOpacity>
            )}
          </View>

          {workouts.length === 0 && (
            <Text style={styles.emptyText}>
              {isCoach ? 'No workouts assigned yet.' : 'No training sessions yet — check back once a coach assigns one.'}
            </Text>
          )}
          {workouts.map((workout) => {
            const counts = workoutCounts[workout.id]

            return (
              <TouchableOpacity
                key={workout.id}
                style={styles.raceCard}
                onPress={() => router.push({ pathname: '/workout/[id]', params: { id: workout.id } })}
              >
                <View style={styles.raceDateChip}>
                  <MaterialIcons name="timer" size={16} color={colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.raceCardTitle}>{workout.name}</Text>
                  <Text style={styles.raceCardMeta}>
                    {workout.reps} x {workout.distance_per_rep_km} km
                    {workout.rest_seconds ? ` · ${workout.rest_seconds}s rest` : ''}
                    {counts ? ` · ${counts.completed}/${counts.total} completed` : ''}
                  </Text>
                </View>
                <MaterialIcons name="chevron-right" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            )
          })}

          <Text style={[sectionLabel, styles.sectionSpaced]}>Leaderboard</Text>
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

      {(isMember ? filteredMembers : filteredMembers.slice(0, 3)).map((member, index) => {
        const avatar = avatarColors(member.username)

        return (
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

            <View style={[styles.avatarCircle, { backgroundColor: avatar.bg }]}>
              <Text style={[styles.avatarLetter, { color: avatar.text }]}>
                {member.username?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.username}>{member.username}</Text>
              {member.role === 'coach' && <Text style={styles.coachBadge}>COACH</Text>}
            </View>
            <Text style={styles.elo}>{member.elo_rating}</Text>
          </TouchableOpacity>
        )
      })}

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
                style={styles.switcherRow}
                onPress={() => {
                  setSwitcherVisible(false)
                  if (String(club.id) !== String(clubId)) {
                    onSwitchClub(club.id)
                  }
                }}
              >
                <Text style={styles.switcherRowText}>{club.name || 'Untitled club'}</Text>
                {String(club.id) === String(clubId) && (
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

      <Modal
        visible={coachModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setCoachModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Manage coaches</Text>
            <Text style={styles.modalSubtitle}>Coaches can assign training sessions to club members.</Text>
            {members.map((member) => {
              const memberIsCoach = member.role === 'coach'

              return (
                <View key={member.id} style={styles.coachRow}>
                  <Text style={styles.switcherRowText}>{member.username}</Text>
                  <TouchableOpacity
                    style={[styles.coachToggle, memberIsCoach && styles.coachToggleActive]}
                    onPress={() => toggleCoach(member.id, memberIsCoach)}
                  >
                    <Text style={[styles.coachToggleText, memberIsCoach && styles.coachToggleTextActive]}>
                      {memberIsCoach ? 'Coach' : 'Make coach'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )
            })}
            <TouchableOpacity style={styles.cancelButton} onPress={() => setCoachModalVisible(false)}>
              <Text style={styles.cancelButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={workoutModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setWorkoutModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>Assign a workout</Text>

              <TextInput
                placeholder="Workout name, e.g. Tuesday intervals"
                placeholderTextColor={colors.textSecondary}
                value={workoutName}
                onChangeText={setWorkoutName}
                style={styles.input}
              />

              <View style={styles.workoutFieldRow}>
                <View style={styles.workoutField}>
                  <Text style={styles.modalLabel}>Reps</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={workoutReps}
                    onChangeText={setWorkoutReps}
                    style={styles.input}
                  />
                </View>
                <View style={styles.workoutField}>
                  <Text style={styles.modalLabel}>Km per rep</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={workoutDistancePerRep}
                    onChangeText={setWorkoutDistancePerRep}
                    style={styles.input}
                  />
                </View>
                <View style={styles.workoutField}>
                  <Text style={styles.modalLabel}>Rest (s)</Text>
                  <TextInput
                    keyboardType="numeric"
                    value={workoutRestSeconds}
                    onChangeText={setWorkoutRestSeconds}
                    style={styles.input}
                  />
                </View>
              </View>

              <TextInput
                placeholder="Notes (optional)"
                placeholderTextColor={colors.textSecondary}
                value={workoutNotes}
                onChangeText={setWorkoutNotes}
                style={styles.input}
                multiline
              />

              <Text style={styles.modalLabel}>Assign to</Text>
              <View style={styles.clubPickerRow}>
                {members.map((member) => (
                  <TouchableOpacity
                    key={member.id}
                    style={[styles.chip, selectedAssigneeIds.has(member.id) && styles.chipActive]}
                    onPress={() => toggleAssignee(member.id)}
                  >
                    <Text style={[styles.chipText, selectedAssigneeIds.has(member.id) && styles.chipTextActive]}>
                      {member.username}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {workoutMessage ? <Text style={styles.message}>{workoutMessage}</Text> : null}

              <TouchableOpacity style={styles.primaryButton} onPress={assignWorkout}>
                <Text style={styles.primaryButtonText}>Assign workout</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.cancelButton} onPress={() => setWorkoutModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  )
}

const styles = StyleSheet.create({
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
  heroTopRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  feedCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 14,
    marginBottom: 26,
    ...cardShadow,
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  feedRowLast: { borderBottomWidth: 0 },
  feedIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: '#1c2b12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedText: { flex: 1, color: colors.textPrimary, fontSize: 13, fontWeight: '500' },
  feedTime: { color: colors.textSecondary, fontSize: 11 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 15,
    fontWeight: 'bold',
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
  coachBadge: {
    color: colors.accent,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 2,
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
  modalSubtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 16 },
  modalLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 10 },
  coachRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  coachToggle: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 16,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  coachToggleActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  coachToggleText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
  },
  coachToggleTextActive: {
    color: colors.background,
  },
  workoutFieldRow: {
    flexDirection: 'row',
    gap: 10,
  },
  workoutField: {
    flex: 1,
  },
  clubPickerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  switcherRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
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
