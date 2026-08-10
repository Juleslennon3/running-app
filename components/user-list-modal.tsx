import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { colors } from '../lib/theme'
import { FollowButton } from './follow-button'

type UserListModalProps = {
  visible: boolean
  title: string
  users: any[]
  isFollowing: (userId: string) => boolean
  onToggleFollow: (userId: string) => void
  onClose: () => void
}

export function UserListModal({ visible, title, users, isFollowing, onToggleFollow, onClose }: UserListModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.listContent}>
            {users.length === 0 && (
              <Text style={styles.emptyText}>Nobody here yet.</Text>
            )}
            {users.map((user) => (
              <View key={user.id} style={styles.rowCard}>
                <View style={styles.rowIcon}>
                  <Text style={styles.rowIconText}>{user.username?.[0]?.toUpperCase() ?? '?'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowText}>{user.username}</Text>
                </View>
                <FollowButton
                  isFollowing={isFollowing(user.id)}
                  onPress={() => onToggleFollow(user.id)}
                />
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  content: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    maxHeight: '75%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 18,
  },
  title: { fontSize: 20, fontWeight: 'bold', color: colors.textPrimary },
  closeText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  listContent: { paddingBottom: 10 },
  emptyText: { color: colors.textSecondary, fontSize: 13 },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
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
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowIconText: { color: colors.accent, fontWeight: 'bold', fontSize: 13 },
  rowText: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
})
