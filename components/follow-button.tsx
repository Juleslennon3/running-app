import { useState } from 'react'
import { StyleSheet, Text, TouchableOpacity } from 'react-native'

import { colors } from '../lib/theme'

type FollowButtonProps = {
  isFollowing: boolean
  onPress: () => Promise<void> | void
}

export function FollowButton({ isFollowing, onPress }: FollowButtonProps) {
  const [pending, setPending] = useState(false)

  async function handlePress() {
    if (pending) return
    setPending(true)
    await onPress()
    setPending(false)
  }

  return (
    <TouchableOpacity
      style={[styles.button, isFollowing && styles.buttonFollowing]}
      onPress={handlePress}
      disabled={pending}
    >
      <Text style={[styles.buttonText, isFollowing && styles.buttonTextFollowing]}>
        {isFollowing ? 'Following' : 'Follow'}
      </Text>
    </TouchableOpacity>
  )
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  buttonFollowing: {
    backgroundColor: 'transparent',
    borderWidth: 0.5,
    borderColor: colors.border,
  },
  buttonText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: '600',
  },
  buttonTextFollowing: {
    color: colors.textPrimary,
  },
})
