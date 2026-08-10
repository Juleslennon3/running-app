import { supabase } from './supabase'

export async function followUser(followerId: string, targetId: string) {
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, following_id: targetId })

  if (error) return { error }

  const { error: notificationError } = await supabase
    .from('notifications')
    .insert({ user_id: targetId, actor_id: followerId, type: 'follow' })

  console.log("FOLLOW NOTIFICATION ERROR:", notificationError)

  return { error: null }
}

export async function unfollowUser(followerId: string, targetId: string) {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', targetId)

  return { error }
}
