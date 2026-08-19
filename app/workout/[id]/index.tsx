import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { useSession } from '../../../lib/auth-context'
import { supabase } from '../../../lib/supabase'
import { avatarColors, cardShadow, colors, sectionLabel } from '../../../lib/theme'

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const { session } = useSession()

  const [workout, setWorkout] = useState<any>(null)
  const [hostUsername, setHostUsername] = useState('Unknown')
  const [assignments, setAssignments] = useState<any[]>([])

  useEffect(() => {
    if (id && session) {
      fetchWorkout()
      fetchAssignments()
    }
  }, [id, session])

  async function fetchWorkout() {
    const { data, error } = await supabase
      .from('workouts')
      .select('*')
      .eq('id', id)
      .single()

    console.log("WORKOUT DETAIL:", data)
    console.log("WORKOUT DETAIL ERROR:", error)

    if (!error && data) {
      setWorkout(data)
      fetchHostUsername(data.created_by)
    }
  }

  async function fetchHostUsername(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', userId)
      .single()

    console.log("WORKOUT HOST ERROR:", error)

    if (!error && data) {
      setHostUsername(data.username)
    }
  }

  async function fetchAssignments() {
    const { data, error } = await supabase
      .from('workout_assignments')
      .select('user_id, distance_km, duration_seconds, completed_at')
      .eq('workout_id', id)

    console.log("WORKOUT ASSIGNMENTS:", data)
    console.log("WORKOUT ASSIGNMENTS ERROR:", error)

    if (error || !data) return

    const userIds = data.map((row: any) => row.user_id)

    const { data: profileRows, error: profileError } = await supabase
      .from('profiles')
      .select('id, username')
      .in('id', userIds)

    console.log("WORKOUT ASSIGNEE PROFILES ERROR:", profileError)

    const merged = data.map((row: any) => ({
      ...row,
      profiles: { username: profileRows?.find((p: any) => p.id === row.user_id)?.username },
    }))

    const sorted = merged.sort((a: any, b: any) => {
      if (!!a.completed_at === !!b.completed_at) return 0
      return a.completed_at ? -1 : 1
    })
    setAssignments(sorted)
  }

  if (!workout) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Loading…</Text>
      </View>
    )
  }

  const myAssignment = assignments.find((a) => a.user_id === session?.user.id)
  const totalDistance = (workout.reps * workout.distance_per_rep_km).toFixed(1)

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <Text style={styles.title}>{workout.name}</Text>
      <Text style={styles.meta}>
        {workout.reps} x {workout.distance_per_rep_km} km
        {workout.rest_seconds ? ` · ${workout.rest_seconds}s rest` : ''} · {totalDistance} km total
      </Text>
      <Text style={styles.host}>Assigned by {hostUsername}</Text>

      {workout.notes ? <Text style={styles.notes}>{workout.notes}</Text> : null}

      {myAssignment && !myAssignment.completed_at && (
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push({ pathname: '/workout/[id]/track', params: { id: id as string } })}
        >
          <Text style={styles.primaryButtonText}>Start workout</Text>
        </TouchableOpacity>
      )}

      {myAssignment && myAssignment.completed_at && (
        <View style={styles.submitCard}>
          <Text style={styles.submitLabel}>Your result</Text>
          <Text style={styles.myTimeText}>{formatDuration(myAssignment.duration_seconds)}</Text>
          <Text style={styles.submitSub}>{myAssignment.distance_km} km covered</Text>
        </View>
      )}

      <Text style={[sectionLabel, styles.sectionTitle]}>Assigned to</Text>
      {assignments.map((a) => {
        const isYou = a.user_id === session?.user.id
        const avatar = avatarColors(a.profiles?.username)

        return (
          <View key={a.user_id} style={styles.row}>
            <View style={[styles.avatarCircle, { backgroundColor: avatar.bg }]}>
              <Text style={[styles.avatarLetter, { color: avatar.text }]}>
                {a.profiles?.username?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
            <Text style={[styles.rowName, isYou && styles.rowNameYou]}>
              {isYou ? 'You' : a.profiles?.username ?? 'Unknown'}
            </Text>
            {a.completed_at ? (
              <View style={styles.doneChip}>
                <MaterialIcons name="check" size={14} color={colors.background} />
                <Text style={styles.doneChipText}>{formatDuration(a.duration_seconds)}</Text>
              </View>
            ) : (
              <Text style={styles.pendingText}>Pending</Text>
            )}
          </View>
        )
      })}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, paddingTop: 20, paddingBottom: 80 },
  emptyContainer: { flex: 1, padding: 28, paddingTop: 70, backgroundColor: colors.background },
  emptyText: { color: colors.textSecondary, fontSize: 14 },
  title: { fontSize: 28, fontWeight: 'bold', color: colors.textPrimary, letterSpacing: -0.5 },
  meta: { fontSize: 13, color: colors.accent, fontWeight: '600', marginTop: 8 },
  host: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  notes: { fontSize: 14, color: colors.textPrimary, marginTop: 16, lineHeight: 20 },
  primaryButton: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 20, ...cardShadow },
  primaryButtonText: { color: colors.background, fontWeight: 'bold', fontSize: 15 },
  submitCard: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginTop: 20, ...cardShadow },
  submitLabel: { color: colors.textSecondary, fontSize: 13, marginBottom: 8 },
  myTimeText: { color: colors.textPrimary, fontSize: 28, fontWeight: 'bold' },
  submitSub: { color: colors.textSecondary, fontSize: 13, marginTop: 4 },
  sectionTitle: { marginTop: 28, marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    gap: 12,
    ...cardShadow,
  },
  avatarCircle: { width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontSize: 14, fontWeight: 'bold' },
  rowName: { flex: 1, color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
  rowNameYou: { color: colors.accent },
  pendingText: { color: colors.textSecondary, fontSize: 12, fontWeight: '600' },
  doneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  doneChipText: { color: colors.background, fontSize: 12, fontWeight: '700' },
})
