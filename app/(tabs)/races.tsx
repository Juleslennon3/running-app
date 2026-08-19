import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { LinearGradient } from 'expo-linear-gradient'
import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { useSession } from '../../lib/auth-context'
import { supabase } from '../../lib/supabase'
import { cardShadow, colors, gradients } from '../../lib/theme'

export default function RaceScreen() {
  const router = useRouter()
  const { session } = useSession()
  const [pendingCount, setPendingCount] = useState(0)

  useFocusEffect(
    useCallback(() => {
      if (session) {
        fetchPendingCount()
      }
    }, [session])
  )

  async function fetchPendingCount() {
    const { count: inviteCount } = await supabase
      .from('race_invites')
      .select('*', { count: 'exact', head: true })
      .eq('invited_user_id', session?.user.id)
      .eq('status', 'pending')

    const { data: joined } = await supabase
      .from('race_participants')
      .select('race_id, duration_seconds, races(end_date)')
      .eq('user_id', session?.user.id)
      .is('duration_seconds', null)

    const now = new Date()
    const waitingToRun = (joined ?? []).filter((row: any) => new Date(row.races?.end_date) > now).length

    setPendingCount((inviteCount ?? 0) + waitingToRun)
  }

  if (!session) return null

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Race</Text>

      {pendingCount > 0 && (
        <TouchableOpacity style={styles.pendingBadge} onPress={() => router.push('/invites')}>
          <MaterialIcons name="schedule" size={18} color={colors.accent} />
          <Text style={styles.pendingBadgeText}>
            {pendingCount} race {pendingCount === 1 ? 'is' : 's are'} waiting for your run
          </Text>
          <MaterialIcons name="chevron-right" size={20} color={colors.accent} />
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.cardShadowWrap} onPress={() => router.push('/race-online')}>
        <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.onlineCard}>
          <View style={styles.onlineIconWrap}>
            <MaterialIcons name="bolt" size={26} color={colors.background} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.onlineTitle}>Race online</Text>
            <Text style={styles.onlineSubtitle}>Get matched with someone near your ELO</Text>
          </View>
          <MaterialIcons name="arrow-forward" size={22} color={colors.background} />
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity style={[styles.cardShadowWrap, styles.offlineShadowWrap]} onPress={() => router.push('/practice')}>
        <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.offlineCard}>
          <View style={styles.offlineIconWrap}>
            <MaterialIcons name="terrain" size={26} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.offlineTitle}>Race offline</Text>
            <Text style={styles.offlineSubtitle}>Beat the bot ladder. Doesn&apos;t affect your ELO</Text>
          </View>
          <MaterialIcons name="arrow-forward" size={22} color={colors.textSecondary} />
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity style={styles.pendingLink} onPress={() => router.push('/invites')}>
        <Text style={styles.pendingLinkText}>View pending races</Text>
        <MaterialIcons name="chevron-right" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, paddingTop: 70, paddingBottom: 60 },
  title: { fontSize: 34, fontWeight: 'bold', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 24 },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.accent,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
    ...cardShadow,
  },
  pendingBadgeText: { color: colors.accent, fontSize: 14, fontWeight: '600', flex: 1 },
  cardShadowWrap: {
    borderRadius: 18,
    marginBottom: 16,
    ...cardShadow,
  },
  offlineShadowWrap: { marginBottom: 24 },
  onlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    padding: 20,
  },
  onlineIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(10,11,13,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  onlineTitle: { fontSize: 18, fontWeight: 'bold', color: colors.background },
  onlineSubtitle: { fontSize: 13, color: colors.background, marginTop: 4, opacity: 0.8 },
  offlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderRadius: 18,
    padding: 20,
  },
  offlineIconWrap: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: 'rgba(232,255,46,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  offlineSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  pendingLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    ...cardShadow,
  },
  pendingLinkText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
})
