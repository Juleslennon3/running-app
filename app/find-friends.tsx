import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

import { FollowButton } from '../components/follow-button'
import { useSession } from '../lib/auth-context'
import { supabase } from '../lib/supabase'
import { colors } from '../lib/theme'

export default function FindFriendsScreen() {

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

    if (currentlyFollowing) {
      const { error } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', session?.user.id)
        .eq('following_id', targetId)

      console.log("UNFOLLOW ERROR:", error)

      if (error) {
        setMyFollowingIds((prev) => new Set(prev).add(targetId))
      }
    } else {
      const { error } = await supabase
        .from('follows')
        .insert({ follower_id: session?.user.id, following_id: targetId })

      console.log("FOLLOW ERROR:", error)

      if (error) {
        setMyFollowingIds((prev) => {
          const next = new Set(prev)
          next.delete(targetId)
          return next
        })
      }
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
        <View key={user.id} style={styles.rowCard}>
          <View style={styles.rowIcon}>
            <Text style={styles.rowIconText}>{user.username?.[0]?.toUpperCase() ?? '?'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowText}>{user.username}</Text>
          </View>
          <FollowButton
            isFollowing={myFollowingIds.has(user.id)}
            onPress={() => toggleFollow(user.id)}
          />
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
})
