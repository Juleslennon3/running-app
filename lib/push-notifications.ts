import Constants from 'expo-constants'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

import { supabase } from './supabase'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
})

export async function registerForPushNotificationsAsync(userId: string) {
  if (Platform.OS === 'web' || !Device.isDevice) return

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    })
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync()
  let finalStatus = existingStatus
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync()
    finalStatus = status
  }
  if (finalStatus !== 'granted') return

  const projectId = Constants.expoConfig?.extra?.eas?.projectId
  if (!projectId) return

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })

  await supabase.from('profiles').update({ push_token: token }).eq('id', userId)
}

export type PushNotificationData = {
  type: 'follow' | 'race_invite' | 'race_match' | 'workout_assigned'
  race_id?: number
  workout_id?: number
}

export function pathForNotificationData(data: PushNotificationData): { pathname: string; params?: Record<string, string> } | null {
  if (data.type === 'race_invite') {
    return { pathname: '/invites' }
  }
  if (data.type === 'race_match' && data.race_id) {
    return { pathname: '/race/[id]', params: { id: String(data.race_id) } }
  }
  if (data.type === 'workout_assigned' && data.workout_id) {
    return { pathname: '/workout/[id]', params: { id: String(data.workout_id) } }
  }
  return null
}
