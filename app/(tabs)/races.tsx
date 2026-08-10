import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
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
import { colors } from '../../lib/theme'

const FILTER_OPTIONS: { key: 'all' | 'myClubs' | 'open'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'myClubs', label: 'My Clubs' },
  { key: 'open', label: 'Open' },
]

export default function RacesScreen() {

  const router = useRouter()
  const { session } = useSession()
  const [message, setMessage] = useState('')
  const [raceName, setRaceName] = useState('')
  const [races, setRaces] = useState<any[]>([])
  const [myClubs, setMyClubs] = useState<any[]>([])
  const [selectedClubId, setSelectedClubId] = useState<number | null>(null)
  const [modalVisible, setModalVisible] = useState(false)
  const [filter, setFilter] = useState<'all' | 'myClubs' | 'open'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [participantCounts, setParticipantCounts] = useState<{ [raceId: string]: number }>({})
  const [creatorNames, setCreatorNames] = useState<{ [userId: string]: string }>({})
  const [myFollowing, setMyFollowing] = useState<any[]>([])
  const [selectedInviteeIds, setSelectedInviteeIds] = useState<Set<string>>(new Set())
  const [pendingInviteCount, setPendingInviteCount] = useState(0)
  const [autoJoin, setAutoJoin] = useState(true)

  useEffect(() => {
    if (session) {
      fetchRaces()
      fetchMyClubs()
      fetchMyFollowing()
    }
  }, [session])

  useFocusEffect(
    useCallback(() => {
      if (session) {
        fetchPendingInviteCount()
      }
    }, [session])
  )

  async function fetchMyFollowing() {
    const { data, error } = await supabase
      .from('follows')
      .select('following_id, profiles!follows_following_id_fkey(username)')
      .eq('follower_id', session?.user.id)

    console.log("MY FOLLOWING (for invites):", data)
    console.log("MY FOLLOWING ERROR:", error)

    if (!error && data) {
      setMyFollowing(data.map((row: any) => ({ id: row.following_id, username: row.profiles?.username ?? 'Unknown' })))
    }
  }

  async function fetchPendingInviteCount() {
    const { count, error } = await supabase
      .from('race_invites')
      .select('*', { count: 'exact', head: true })
      .eq('invited_user_id', session?.user.id)
      .eq('status', 'pending')

    console.log("PENDING INVITE COUNT ERROR:", error)

    if (!error) {
      setPendingInviteCount(count ?? 0)
    }
  }

  function toggleInvitee(userId: string) {
    setSelectedInviteeIds((prev) => {
      const next = new Set(prev)
      next.has(userId) ? next.delete(userId) : next.add(userId)
      return next
    })
  }

  async function fetchRaces() {
    const { data, error } = await supabase
      .from('races')
      .select('*, clubs(name)')
      .order('start_date', { ascending: true })

    console.log("FETCH RACES DATA:", data)
    console.log("FETCH RACES ERROR:", error)

    if (!error) {
      setRaces(data)
      fetchParticipantCounts(data.map((r: any) => r.id))
      fetchCreatorNames(data.map((r: any) => r.created_by))
    }
  }

  async function fetchCreatorNames(userIds: any[]) {
    const uniqueIds = [...new Set(userIds)].filter(Boolean)

    if (uniqueIds.length === 0) {
      setCreatorNames({})
      return
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', uniqueIds)

    console.log("CREATOR NAMES DATA:", data)
    console.log("CREATOR NAMES ERROR:", error)

    if (!error && data) {
      const names: { [userId: string]: string } = {}
      data.forEach((row: any) => {
        names[row.id] = row.username
      })
      setCreatorNames(names)
    }
  }

  async function fetchParticipantCounts(raceIds: any[]) {
    if (raceIds.length === 0) {
      setParticipantCounts({})
      return
    }

    const { data, error } = await supabase
      .from('race_participants')
      .select('race_id')
      .in('race_id', raceIds)

    console.log("PARTICIPANT COUNTS DATA:", data)
    console.log("PARTICIPANT COUNTS ERROR:", error)

    if (!error && data) {
      const counts: { [raceId: string]: number } = {}
      data.forEach((row: any) => {
        counts[row.race_id] = (counts[row.race_id] ?? 0) + 1
      })
      setParticipantCounts(counts)
    }
  }

  async function fetchMyClubs() {
    const { data, error } = await supabase
      .from('club_members')
      .select('club_id, clubs(id, name)')
      .eq('user_id', session?.user.id)

    if (!error && data) {
      setMyClubs(data.map((row: any) => row.clubs))
    }
  }

  async function createRace() {
    console.log("CREATE RACE PRESSED")

    if (raceName.trim().length === 0) {
      setMessage('Please enter a race name')
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
        club_id: selectedClubId,
        is_private: selectedInviteeIds.size > 0,
      })
      .select()
      .single()

    console.log("RACE DATA:", data)
    console.log("RACE ERROR:", error)

    if (error) {
      setMessage(error.message)
      return
    }

    if (selectedInviteeIds.size > 0) {
      const inviteeIds = [...selectedInviteeIds]

      const { error: inviteError } = await supabase
        .from('race_invites')
        .insert(
          inviteeIds.map((userId) => ({
            race_id: data.id,
            invited_user_id: userId,
            invited_by: session?.user.id,
          }))
        )

      console.log("RACE INVITES ERROR:", inviteError)

      const { error: notificationError } = await supabase
        .from('notifications')
        .insert(
          inviteeIds.map((userId) => ({
            user_id: userId,
            actor_id: session?.user.id,
            type: 'race_invite',
            race_id: data.id,
          }))
        )

      console.log("RACE INVITE NOTIFICATIONS ERROR:", notificationError)
    }

    if (autoJoin) {
      const { error: joinError } = await supabase
        .from('race_participants')
        .insert({ race_id: data.id, user_id: session?.user.id })

      console.log("AUTO-JOIN ERROR:", joinError)
    }

    setMessage('Race created!')
    setRaceName('')
    setSelectedClubId(null)
    setSelectedInviteeIds(new Set())
    setAutoJoin(true)
    setModalVisible(false)
    fetchRaces()
  }

  function getRaceStatus(endDate: string) {
    const now = new Date()
    const end = new Date(endDate)
    return now < end ? 'Active' : 'Ended'
  }

  if (!session) return null

  const myClubIds = myClubs.map((c) => c.id)

  const searchedRaces = races.filter((r) =>
    r.name?.toLowerCase().includes(searchQuery.trim().toLowerCase())
  )

  const filteredRaces = searchedRaces.filter((r) => {
    if (filter === 'myClubs') return myClubIds.includes(r.club_id)
    if (filter === 'open') return r.club_id === null
    return true
  })

  const activeRaces = filteredRaces.filter((r) => getRaceStatus(r.end_date) === 'Active')
  const pastRaces = filteredRaces.filter((r) => getRaceStatus(r.end_date) === 'Ended')

  function renderRaceCard(race: any, muted: boolean) {
    return (
      <TouchableOpacity
        key={race.id}
        style={[styles.raceCard, muted && styles.raceCardMuted]}
        onPress={() => router.push({ pathname: '/race/[id]', params: { id: race.id } })}
      >
        <View style={styles.raceHeader}>
          <Text style={styles.raceName}>{race.name}</Text>
          <View style={muted ? styles.badgeEnded : styles.badgeActive}>
            <Text style={muted ? styles.badgeEndedText : styles.badgeActiveText}>
              {muted ? 'Ended' : 'Active'}
            </Text>
          </View>
        </View>

        <View style={styles.tagRow}>
          {race.club_id && (
            <Text style={styles.raceClub}>{race.clubs?.name ?? 'Club race'}</Text>
          )}
        </View>

        <Text style={styles.raceMeta}>
          Hosted by {creatorNames[race.created_by] ?? 'Unknown'} · {participantCounts[race.id] ?? 0} joined · {new Date(race.start_date).toLocaleDateString()} – {new Date(race.end_date).toLocaleDateString()}
        </Text>
      </TouchableOpacity>
    )
  }

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>Races</Text>
          <Text style={styles.subtitle}>{activeRaces.length} active</Text>
        </View>
        <TouchableOpacity style={styles.createButton} onPress={() => setModalVisible(true)}>
          <Text style={styles.createButtonText}>+ Create</Text>
        </TouchableOpacity>
      </View>

      {pendingInviteCount > 0 && (
        <TouchableOpacity style={styles.inviteBadge} onPress={() => router.push('/invites')}>
          <Text style={styles.inviteBadgeText}>
            {pendingInviteCount} race {pendingInviteCount === 1 ? 'invite' : 'invites'}
          </Text>
          <Text style={styles.inviteBadgeArrow}>›</Text>
        </TouchableOpacity>
      )}

      <View style={styles.filterRow}>
        {FILTER_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[styles.chip, filter === option.key && styles.chipActive]}
            onPress={() => setFilter(option.key)}
          >
            <Text style={[styles.chipText, filter === option.key && styles.chipTextActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        placeholder="Search races"
        placeholderTextColor={colors.textSecondary}
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchInput}
        autoCapitalize="none"
      />

      {message ? <Text style={styles.message}>{message}</Text> : null}

      {activeRaces.map((race) => renderRaceCard(race, false))}

      {pastRaces.length > 0 && (
        <>
          <Text style={styles.sectionLabel}>Past races</Text>
          {pastRaces.map((race) => renderRaceCard(race, true))}
        </>
      )}

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
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.modalTitle}>New race</Text>

            <TextInput
              placeholder="Race name"
              placeholderTextColor={colors.textSecondary}
              value={raceName}
              onChangeText={setRaceName}
              style={styles.input}
            />

            <Text style={styles.modalLabel}>Attach to a club (optional)</Text>
            <View style={styles.clubPickerRow}>
              <TouchableOpacity
                style={[styles.chip, selectedClubId === null && styles.chipActive]}
                onPress={() => setSelectedClubId(null)}
              >
                <Text style={[styles.chipText, selectedClubId === null && styles.chipTextActive]}>
                  Standalone
                </Text>
              </TouchableOpacity>
              {myClubs.map((club) => (
                <TouchableOpacity
                  key={club.id}
                  style={[styles.chip, selectedClubId === club.id && styles.chipActive]}
                  onPress={() => setSelectedClubId(club.id)}
                >
                  <Text style={[styles.chipText, selectedClubId === club.id && styles.chipTextActive]}>
                    {club.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.modalLabel}>Invite friends (optional)</Text>
            {myFollowing.length === 0 ? (
              <Text style={styles.emptyText}>Follow people to invite them to races.</Text>
            ) : (
              <View style={styles.clubPickerRow}>
                {myFollowing.map((friend) => (
                  <TouchableOpacity
                    key={friend.id}
                    style={[styles.chip, selectedInviteeIds.has(friend.id) && styles.chipActive]}
                    onPress={() => toggleInvitee(friend.id)}
                  >
                    <Text style={[styles.chipText, selectedInviteeIds.has(friend.id) && styles.chipTextActive]}>
                      {friend.username}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.joinToggleRow}>
              <Text style={styles.modalLabel}>Join this race</Text>
              <Switch
                value={autoJoin}
                onValueChange={setAutoJoin}
                trackColor={{ false: colors.border, true: colors.accent }}
                thumbColor={colors.textPrimary}
              />
            </View>

            <TouchableOpacity style={styles.primaryButton} onPress={createRace}>
              <Text style={styles.primaryButtonText}>Create race (3 day window)</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.cancelButton} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: colors.background },
  container: { padding: 28, paddingTop: 70, paddingBottom: 60 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { fontSize: 30, fontWeight: 'bold', color: colors.textPrimary },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  createButton: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 },
  createButtonText: { color: colors.background, fontWeight: 'bold', fontSize: 13 },
  message: { color: colors.textSecondary, fontSize: 13, marginBottom: 16 },
  inviteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  inviteBadgeText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
  inviteBadgeArrow: { fontSize: 18, color: colors.accent },
  emptyText: { color: colors.textSecondary, fontSize: 13, marginBottom: 10 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  searchInput: {
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
    color: colors.textPrimary,
    fontSize: 14,
  },
  sectionLabel: { color: colors.textSecondary, fontSize: 13, fontWeight: '600', marginTop: 10, marginBottom: 10 },
  raceCard: {
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  raceCardMuted: { opacity: 0.6 },
  raceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  raceName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  tagRow: { flexDirection: 'row', gap: 10, marginTop: 6 },
  raceClub: { fontSize: 12, color: colors.accent, fontWeight: '600' },
  raceMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 6 },
  badgeActive: { backgroundColor: '#1c2b12', borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10 },
  badgeActiveText: { color: colors.accent, fontSize: 11, fontWeight: '600' },
  badgeEnded: { backgroundColor: colors.background, borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10 },
  badgeEndedText: { color: colors.textSecondary, fontSize: 11, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40, maxHeight: '85%' },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 18 },
  modalLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 10 },
  joinToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  input: { backgroundColor: colors.background, borderWidth: 0.5, borderColor: colors.border, borderRadius: 12, padding: 14, marginBottom: 18, color: colors.textPrimary, fontSize: 15 },
  clubPickerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20 },
  chip: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.background },
  primaryButton: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  primaryButtonText: { color: colors.background, fontWeight: 'bold', fontSize: 14 },
  cancelButton: { alignItems: 'center', paddingVertical: 10 },
  cancelButtonText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
})