import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput } from 'react-native'

import { UserRow } from '../components/user-row'
import { useSession } from '../lib/auth-context'
import { followUser, unfollowUser } from '../lib/follow'
import { supabase } from '../lib/supabase'
import { colors } from '../lib/theme'

export default function FindFriendsScreen() {

  const router = useRouter()
  const { session } = useSession()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [myFollowingIds, setMyFollowingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchMyFollowingIds()
  }, [session])

  useEffect(() => {
    const query = searchQuery.trim()

    if (query.length === 0) {
      setSearchResults([])
      return
    }

    const timeout = setTimeout(() => {
      searchProfiles(query)
    }, 300)

    return () => clearTimeout(timeout)
  }, [searchQuery, session])

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

    console.log("TOGGLE FOLLOW ERROR:", error)

    if (error) {
      setMyFollowingIds((prev) => {
        const next = new Set(prev)
        currentlyFollowing ? next.add(targetId) : next.delete(targetId)
        return next
      })
    }
  }

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <TextInput
        placeholder="Search by username"
        placeholderTextColor={colors.textSecondary}
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchInput}
        autoCapitalize="none"
        autoFocus
      />

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
  searchInput: {
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    color: colors.textPrimary,
    fontSize: 15,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
})
