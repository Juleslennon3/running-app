import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { colors } from '../lib/theme'
import { FollowButton } from './follow-button'

type UserRowProps = {
  username: string
  isFollowing: boolean
  onToggleFollow: () => void
  onPress: () => void
}

export function UserRow({ username, isFollowing, onToggleFollow, onPress }: UserRowProps) {
  return (
    <TouchableOpacity style={styles.rowCard} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rowIcon}>
        <Text style={styles.rowIconText}>{username?.[0]?.toUpperCase() ?? '?'}</Text>
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
