import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text } from 'react-native'

import { UserRow } from '../../../components/user-row'
import { useSession } from '../../../lib/auth-context'
import { followUser, unfollowUser } from '../../../lib/follow'
import { supabase } from '../../../lib/supabase'
import { colors } from '../../../lib/theme'

export default function FollowingScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const { session } = useSession()
  const [users, setUsers] = useState<any[]>([])
  const [myFollowingIds, setMyFollowingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (id) {
      fetchFollowing()
      fetchMyFollowingIds()
    }
  }, [id, session])

  async function fetchFollowing() {
    const { data, error } = await supabase
      .from('follows')
      .select('following_id, profiles!follows_following_id_fkey(username)')
      .eq('follower_id', id)

    console.log("FOLLOWING LIST:", data)
    console.log("FOLLOWING LIST ERROR:", error)

    if (!error && data) {
      setUsers(data.map((row: any) => ({ id: row.following_id, username: row.profiles?.username ?? 'Unknown' })))
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

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      {users.length === 0 && (
        <Text style={styles.emptyText}>Not following anyone yet.</Text>
      )}
      {users.map((user) => (
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
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
})
