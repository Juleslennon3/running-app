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
import { colors } from '../../lib/theme'

const GENDER_FILTERS: { key: 'all' | 'male' | 'female'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'male', label: 'Men' },
  { key: 'female', label: 'Women' },
]

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const { session } = useSession()
  const [clubName, setClubName] = useState('')
  const [members, setMembers] = useState<any[]>([])
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all')
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [raceName, setRaceName] = useState('')
  const [targetDistanceInput, setTargetDistanceInput] = useState('5')
  const [autoJoin, setAutoJoin] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (id) {
      fetchClubAndMembers()
    }
  }, [id])

  async function fetchClubAndMembers() {
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

  const filteredMembers = members.filter((member) => {
    if (genderFilter === 'all') return true
    return member.gender === genderFilter
  })

  const isMember = members.some((member) => member.id === session?.user.id)

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{clubName || 'Club'}</Text>
          <Text style={styles.subtitle}>{members.length} members · ranked by ELO</Text>
        </View>
        {isMember && (
          <TouchableOpacity style={styles.hostButton} onPress={() => setModalVisible(true)}>
            <Text style={styles.hostButtonText}>Host a race</Text>
          </TouchableOpacity>
        )}
      </View>

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

      {loading && <Text style={styles.emptyText}>Loading standings…</Text>}

      {!loading && filteredMembers.length === 0 && (
        <Text style={styles.emptyText}>No members in this view yet.</Text>
      )}

      {filteredMembers.map((member, index) => (
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
    padding: 28,
    paddingTop: 20,
    paddingBottom: 60,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
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
    marginBottom: 18,
  },
  hostButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  hostButtonText: {
    color: colors.background,
    fontWeight: 'bold',
    fontSize: 13,
  },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 18 },
  modalLabel: { fontSize: 13, color: colors.textSecondary, marginBottom: 10 },
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
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  chip: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.background },
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
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    gap: 12,
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
})
