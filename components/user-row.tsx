import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { avatarColors, cardShadow, colors } from '../lib/theme'
import { FollowButton } from './follow-button'

type UserRowProps = {
  username: string
  isFollowing: boolean
  onToggleFollow: () => void
  onPress: () => void
}

export function UserRow({ username, isFollowing, onToggleFollow, onPress }: UserRowProps) {
  const avatar = avatarColors(username)

  return (
    <TouchableOpacity style={styles.rowCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.rowIcon, { backgroundColor: avatar.bg }]}>
        <Text style={[styles.rowIconText, { color: avatar.text }]}>{username?.[0]?.toUpperCase() ?? '?'}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowText}>{username}</Text>
      </View>
      <FollowButton isFollowing={isFollowing} onPress={onToggleFollow} />
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    gap: 12,
    ...cardShadow,
  },
  rowIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  rowText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
})
