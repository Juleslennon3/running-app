import { useFocusEffect, useRouter } from 'expo-router'
import { useCallback, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { useSession } from '../../lib/auth-context'
import { DISTANCE_CATEGORIES } from '../../lib/distance-categories'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'

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
          <Text style={styles.pendingBadgeText}>
            {pendingCount} race {pendingCount === 1 ? 'is' : 's are'} waiting for your run
          </Text>
          <Text style={styles.pendingBadgeArrow}>›</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.onlineCard} onPress={() => router.push('/race-online')}>
        <View style={{ flex: 1 }}>
          <Text style={styles.onlineTitle}>Race online</Text>
          <Text style={styles.onlineSubtitle}>Get matched with someone near your ELO</Text>
        </View>
        <Text style={styles.onlineArrow}>›</Text>
      </TouchableOpacity>

      <Text style={styles.sectionTitle}>Practice</Text>
      <Text style={styles.sectionSubtitle}>Race bots offline. Doesn&apos;t affect your ELO.</Text>

      <View style={styles.practiceGrid}>
        {DISTANCE_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.slug}
            style={styles.practiceCard}
            onPress={() => router.push(`/practice/${cat.slug}`)}
          >
            <Text style={styles.practiceLabel}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.pendingLink} onPress={() => router.push('/invites')}>
        <Text style={styles.pendingLinkText}>View pending races</Text>
        <Text style={styles.onlineArrow}>›</Text>
      </TouchableOpacity>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: colors.background },
  container: { padding: 28, paddingTop: 70, paddingBottom: 60 },
  title: { fontSize: 30, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 20 },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  pendingBadgeText: { color: colors.accent, fontSize: 14, fontWeight: '600', flex: 1 },
  pendingBadgeArrow: { fontSize: 18, color: colors.accent },
  onlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  onlineTitle: { fontSize: 18, fontWeight: 'bold', color: colors.background },
  onlineSubtitle: { fontSize: 13, color: colors.background, marginTop: 4, opacity: 0.8 },
  onlineArrow: { fontSize: 22, color: colors.background, fontWeight: 'bold' },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textPrimary },
  sectionSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 4, marginBottom: 16 },
  practiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  practiceCard: {
    width: '47%',
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 24,
    alignItems: 'center',
  },
  practiceLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  pendingLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 16,
  },
  pendingLinkText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
})
