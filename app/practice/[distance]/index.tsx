import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { useSession } from '../../../lib/auth-context'
import { DISTANCE_CATEGORIES } from '../../../lib/distance-categories'
import { supabase } from '../../../lib/supabase'
import { cardShadow, colors } from '../../../lib/theme'

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function PracticeTrailScreen() {
  const { distance } = useLocalSearchParams()
  const router = useRouter()
  const { session } = useSession()

  const category = DISTANCE_CATEGORIES.find((c) => c.slug === distance)

  const [bots, setBots] = useState<any[]>([])
  const [beatenBotIds, setBeatenBotIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    if (session && category) {
      fetchBots()
      fetchBeatenBotIds()
    }
  }, [session, distance])

  async function fetchBots() {
    const { data, error } = await supabase
      .from('bot_opponents')
      .select('*')
      .eq('distance_km', category?.km)
      .order('tier', { ascending: true })

    console.log("FETCH PRACTICE BOTS ERROR:", error)

    if (!error && data) {
      setBots(data)
    }
  }

  async function fetchBeatenBotIds() {
    const { data, error } = await supabase
      .from('bot_attempts')
      .select('bot_id')
      .eq('user_id', session?.user.id)
      .eq('beat_bot', true)

    if (!error && data) {
      setBeatenBotIds(new Set(data.map((row: any) => row.bot_id)))
    }
  }

  if (!category) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Unknown distance.</Text>
      </View>
    )
  }

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{category.label} Ladder</Text>
      <Text style={styles.subtitle}>Beat each bot to unlock the next. Practice only — no ELO change.</Text>

      <View style={styles.trail}>
        <View style={styles.trailLine} />

        {bots.map((bot, index) => {
          const beaten = beatenBotIds.has(bot.id)
          const locked = index > 0 && !beatenBotIds.has(bots[index - 1].id)
          const alignRight = index % 2 === 1

          return (
            <TouchableOpacity
              key={bot.id}
              disabled={locked}
              style={[styles.trailRow, alignRight ? styles.trailRowRight : styles.trailRowLeft]}
              onPress={() => router.push(`/ladder/${bot.id}/track`)}
            >
              <View
                style={[
                  styles.node,
                  beaten && styles.nodeBeaten,
                  locked && styles.nodeLocked,
                ]}
              >
                <Text style={[styles.nodeInitial, beaten && styles.nodeInitialBeaten, locked && styles.nodeInitialLocked]}>
                  {locked ? '🔒' : bot.name?.[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>

              <View style={styles.nodeInfo}>
                <Text style={[styles.nodeName, locked && styles.nodeTextLocked]}>{bot.name}</Text>
                <Text style={[styles.nodeMeta, locked && styles.nodeTextLocked]}>
                  {category.km} km in {formatDuration(bot.time_seconds)}
                </Text>
                {beaten && <Text style={styles.nodeBeatenLabel}>Beaten</Text>}
              </View>
            </TouchableOpacity>
          )
        })}
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: colors.background },
  container: { padding: 28, paddingBottom: 80 },
  emptyContainer: { flex: 1, padding: 28, paddingTop: 70, backgroundColor: colors.background },
  emptyText: { color: colors.textSecondary, fontSize: 14 },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 6, marginBottom: 28 },
  trail: { position: 'relative' },
  trailLine: {
    position: 'absolute',
    left: '50%',
    marginLeft: -1,
    top: 30,
    bottom: 30,
    width: 2,
    backgroundColor: colors.border,
  },
  trailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    width: '100%',
  },
  trailRowLeft: { justifyContent: 'flex-start' },
  trailRowRight: { justifyContent: 'flex-end' },
  node: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    ...cardShadow,
  },
  nodeBeaten: {
    backgroundColor: colors.accent,
  },
  nodeLocked: {
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  nodeInitial: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.accent,
  },
  nodeInitialLocked: {
    fontSize: 16,
  },
  nodeInitialBeaten: {
    color: colors.background,
  },
  nodeInfo: {
    maxWidth: 140,
    marginHorizontal: 12,
  },
  nodeName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  nodeMeta: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  nodeBeatenLabel: {
    fontSize: 11,
    color: colors.accent,
    fontWeight: '700',
    marginTop: 2,
  },
  nodeTextLocked: {
    color: colors.textSecondary,
    opacity: 0.6,
  },
})
