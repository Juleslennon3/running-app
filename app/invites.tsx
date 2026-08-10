import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { useSession } from '../lib/auth-context'
import { supabase } from '../lib/supabase'
import { colors } from '../lib/theme'

export default function InvitesScreen() {
  const router = useRouter()
  const { session } = useSession()
  const [invites, setInvites] = useState<any[]>([])

  useEffect(() => {
    if (session) {
      fetchInvites()
    }
  }, [session])

  async function fetchInvites() {
    const { data, error } = await supabase
      .from('race_invites')
      .select('id, race_id, races(id, name), profiles!race_invites_invited_by_fkey(username)')
      .eq('invited_user_id', session?.user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    console.log("INVITES DATA:", data)
    console.log("INVITES ERROR:", error)

    if (!error && data) {
      setInvites(data)
    }
  }

  async function respondToInvite(invite: any, accept: boolean) {
    const { error } = await supabase
      .from('race_invites')
      .update({ status: accept ? 'accepted' : 'declined' })
      .eq('id', invite.id)

    console.log("RESPOND TO INVITE ERROR:", error)

    if (error) return

    if (accept) {
      const { data: existingParticipant } = await supabase
        .from('race_participants')
        .select('race_id')
        .eq('race_id', invite.race_id)
        .eq('user_id', session?.user.id)
        .maybeSingle()

      if (!existingParticipant) {
        const { error: joinError } = await supabase
          .from('race_participants')
          .insert({ race_id: invite.race_id, user_id: session?.user.id })

        console.log("JOIN FROM INVITE ERROR:", joinError)
      }
    }

    setInvites((prev) => prev.filter((i) => i.id !== invite.id))

    if (accept) {
      router.push({ pathname: '/race/[id]', params: { id: invite.race_id } })
    }
  }

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      {invites.length === 0 && (
        <Text style={styles.emptyText}>No pending invites.</Text>
      )}
      {invites.map((invite) => (
        <View key={invite.id} style={styles.inviteCard}>
          <Text style={styles.raceName}>{invite.races?.name || 'Untitled race'}</Text>
          <Text style={styles.inviteMeta}>
            Invited by {invite.profiles?.username ?? 'Unknown'}
          </Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.declineButton}
              onPress={() => respondToInvite(invite, false)}
            >
              <Text style={styles.declineButtonText}>Decline</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => respondToInvite(invite, true)}
            >
              <Text style={styles.acceptButtonText}>Accept</Text>
            </TouchableOpacity>
          </View>
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
  emptyText: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  inviteCard: {
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  raceName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  inviteMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
    marginBottom: 14,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  declineButton: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  declineButtonText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  acceptButton: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: colors.background,
    fontSize: 13,
    fontWeight: 'bold',
  },
})
