import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { useSession } from '../../lib/auth-context'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'

export default function NotificationsScreen() {
  const router = useRouter()
  const { session } = useSession()
  const [notifications, setNotifications] = useState<any[]>([])

  useEffect(() => {
    if (session) {
      fetchNotifications()
    }
  }, [session])

  async function fetchNotifications() {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, type, is_read, created_at, race_id, profiles!notifications_actor_id_fkey(username), races(name)')
      .eq('user_id', session?.user.id)
      .order('created_at', { ascending: false })

    console.log("NOTIFICATIONS DATA:", data)
    console.log("NOTIFICATIONS ERROR:", error)

    if (!error && data) {
      setNotifications(data)
      markAllRead()
    }
  }

  async function markAllRead() {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', session?.user.id)
      .eq('is_read', false)

    console.log("MARK NOTIFICATIONS READ ERROR:", error)
  }

  function renderNotificationText(notification: any) {
    const actorName = notification.profiles?.username ?? 'Someone'

    if (notification.type === 'follow') {
      return `${actorName} followed you`
    }

    return `${actorName} invited you to ${notification.races?.name || 'a race'}`
  }

  function handlePress(notification: any) {
    if (notification.type === 'race_invite') {
      router.push('/invites')
    }
  }

  if (!session) return null

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Notifications</Text>

      {notifications.length === 0 && (
        <Text style={styles.emptyText}>No notifications yet.</Text>
      )}
      {notifications.map((notification) => (
        <TouchableOpacity
          key={notification.id}
          style={[styles.notificationCard, !notification.is_read && styles.notificationCardUnread]}
          onPress={() => handlePress(notification)}
          activeOpacity={notification.type === 'race_invite' ? 0.7 : 1}
        >
          <View style={styles.notificationIcon}>
            <Text style={styles.notificationIconText}>
              {notification.profiles?.username?.[0]?.toUpperCase() ?? '?'}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.notificationText}>{renderNotificationText(notification)}</Text>
            <Text style={styles.notificationTime}>
              {new Date(notification.created_at).toLocaleDateString()}
            </Text>
          </View>
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
    paddingTop: 70,
    paddingBottom: 60,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 20,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  notificationCard: {
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
  notificationCardUnread: {
    borderColor: colors.accent,
  },
  notificationIcon: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationIconText: {
    color: colors.accent,
    fontWeight: 'bold',
    fontSize: 13,
  },
  notificationText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  notificationTime: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
})
