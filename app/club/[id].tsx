import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native'

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
  const [clubName, setClubName] = useState('')
  const [members, setMembers] = useState<any[]>([])
  const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all')
  const [loading, setLoading] = useState(true)

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

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{clubName || 'Club'}</Text>
      <Text style={styles.subtitle}>{members.length} members · ranked by ELO</Text>

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
    marginBottom: 18,
  },
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
