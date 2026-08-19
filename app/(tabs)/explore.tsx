import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'

import { UserRow } from '../../components/user-row'
import { useSession } from '../../lib/auth-context'
import { followUser, unfollowUser } from '../../lib/follow'
import { supabase } from '../../lib/supabase'
import { cardShadow, colors } from '../../lib/theme'

const CATEGORIES: { key: 'races' | 'people'; label: string }[] = [
  { key: 'races', label: 'Races' },
  { key: 'people', label: 'People' },
]

export default function ExploreScreen() {

  const { session } = useSession()
  const router = useRouter()
  const [category, setCategory] = useState<'races' | 'people'>('races')
  const [searchQuery, setSearchQuery] = useState('')

  // Races
  const [openRaces, setOpenRaces] = useState<any[]>([])

  // People
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [myFollowingIds, setMyFollowingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (session) {
      fetchOpenRaces()
      fetchMyFollowingIds()
    }
  }, [session])

  useEffect(() => {
    if (category !== 'people') return

    const query = searchQuery.trim()

    if (query.length === 0) {
      setSearchResults([])
      return
    }

    const timeout = setTimeout(() => {
      searchProfiles(query)
    }, 300)

    return () => clearTimeout(timeout)
  }, [searchQuery, category, session])

  async function fetchOpenRaces() {
    const { data, error } = await supabase
      .from('races')
      .select('*, clubs(name)')
      .eq('is_private', false)
      .order('start_date', { ascending: true })

    console.log("FETCH OPEN RACES DATA:", data)
    console.log("FETCH OPEN RACES ERROR:", error)

    if (!error && data) {
      setOpenRaces(data)
    }
  }

  async function fetchMyFollowingIds() {
    const { data, error } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', session?.user.id)

    if (!error && data) {
      setMyFollowingIds(new Set(data.map((row: any) => row.following_id)))
    }
  }

  async function searchProfiles(query: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username')
      .ilike('username', `%${query}%`)
      .neq('id', session?.user.id)
      .limit(20)

    console.log("SEARCH PROFILES:", data)
    console.log("SEARCH PROFILES ERROR:", error)

    if (!error && data) {
      setSearchResults(data)
    }
  }

  async function toggleFollow(targetId: string) {
    const currentlyFollowing = myFollowingIds.has(targetId)

    setMyFollowingIds((prev) => {
      const next = new Set(prev)
      currentlyFollowing ? next.delete(targetId) : next.add(targetId)
      return next
    })

    const { error } = currentlyFollowing
      ? await unfollowUser(session!.user.id, targetId)
      : await followUser(session!.user.id, targetId)

    if (error) {
      setMyFollowingIds((prev) => {
        const next = new Set(prev)
        currentlyFollowing ? next.add(targetId) : next.delete(targetId)
        return next
      })
    }
  }

  function getRaceStatus(endDate: string) {
    const now = new Date()
    const end = new Date(endDate)
    return now < end ? 'Active' : 'Ended'
  }

  if (!session) return null

  const filteredRaces = openRaces
    .filter((r) => getRaceStatus(r.end_date) === 'Active')
    .filter((r) => r.name?.toLowerCase().includes(searchQuery.trim().toLowerCase()))

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Explore</Text>

      <View style={styles.categoryRow}>
        {CATEGORIES.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[styles.chip, category === option.key && styles.chipActive]}
            onPress={() => setCategory(option.key)}
          >
            <Text style={[styles.chipText, category === option.key && styles.chipTextActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        placeholder={`Search ${category}`}
        placeholderTextColor={colors.textSecondary}
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchInput}
        autoCapitalize="none"
      />

      {category === 'races' && (
        <>
          {filteredRaces.length === 0 && (
            <Text style={styles.emptyText}>No open races found.</Text>
          )}
          {filteredRaces.map((race) => (
            <TouchableOpacity
              key={race.id}
              style={styles.raceCard}
              onPress={() => router.push({ pathname: '/race/[id]', params: { id: race.id } })}
            >
              <View style={styles.raceHeader}>
                <Text style={styles.raceName}>{race.name}</Text>
                <View style={styles.badgeActive}>
                  <Text style={styles.badgeActiveText}>Active</Text>
                </View>
              </View>
              <Text style={styles.raceMeta}>
                {race.target_distance_km ? `${race.target_distance_km} km · ` : ''}
                {race.clubs?.name ? `${race.clubs.name} · ` : ''}{new Date(race.start_date).toLocaleDateString()} – {new Date(race.end_date).toLocaleDateString()}
              </Text>
            </TouchableOpacity>
          ))}
        </>
      )}

      {category === 'people' && (
        <>
          {searchQuery.trim().length === 0 && (
            <Text style={styles.emptyText}>Search for a username to find people.</Text>
          )}
          {searchQuery.trim().length > 0 && searchResults.length === 0 && (
            <Text style={styles.emptyText}>No runners found.</Text>
          )}
          {searchResults.map((user) => (
            <UserRow
              key={user.id}
              username={user.username}
              isFollowing={myFollowingIds.has(user.id)}
              onToggleFollow={() => toggleFollow(user.id)}
              onPress={() => router.push(`/user/${user.id}`)}
            />
          ))}
        </>
      )}
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
  title: {
    fontSize: 34,
    fontWeight: 'bold',
    color: colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  chip: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.background },
  searchInput: {
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    color: colors.textPrimary,
    fontSize: 14,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  raceCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    ...cardShadow,
  },
  raceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  raceName: { fontSize: 16, fontWeight: '600', color: colors.textPrimary, flex: 1 },
  raceMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 6 },
  badgeActive: { backgroundColor: '#1c2b12', borderRadius: 20, paddingVertical: 4, paddingHorizontal: 10 },
  badgeActiveText: { color: colors.accent, fontSize: 11, fontWeight: '600' },
})
