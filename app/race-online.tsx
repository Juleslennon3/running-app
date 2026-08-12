import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

import { useSession } from '../lib/auth-context'
import { DISTANCE_CATEGORIES } from '../lib/distance-categories'
import { supabase } from '../lib/supabase'
import { cardShadow, colors } from '../lib/theme'

const POLL_MS = 2500

export default function RaceOnlineScreen() {
  const router = useRouter()
  const { session } = useSession()

  const [selectedKm, setSelectedKm] = useState<number | null>(DISTANCE_CATEGORIES[1].km)
  const [customInput, setCustomInput] = useState('')
  const [usingCustom, setUsingCustom] = useState(false)
  const [searching, setSearching] = useState(false)
  const [message, setMessage] = useState('')

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    return () => {
      stopSearching()
    }
  }, [])

  function stopSearching() {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }

  async function cancelSearch() {
    stopSearching()
    setSearching(false)

    await supabase.from('matchmaking_queue').delete().eq('user_id', session?.user.id)
  }

  function resolveDistanceKm() {
    if (usingCustom) {
      const km = parseFloat(customInput)
      return isNaN(km) || km <= 0 ? null : km
    }
    return selectedKm
  }

  async function attemptMatch(distanceKm: number) {
    const { data, error } = await supabase.rpc('find_or_create_match', { p_distance_km: distanceKm })

    console.log("FIND OR CREATE MATCH ERROR:", error)
    console.log("FIND OR CREATE MATCH RACE ID:", data)

    if (error) {
      doneRef.current = true
      setMessage(error.message)
      stopSearching()
      setSearching(false)
      return
    }

    if (data) {
      doneRef.current = true
      stopSearching()
      setSearching(false)
      router.replace({ pathname: '/race/[id]', params: { id: data } })
    }
  }

  async function startSearch() {
    const distanceKm = resolveDistanceKm()

    if (!distanceKm) {
      setMessage('Enter a valid distance')
      return
    }

    setMessage('')
    setSearching(true)
    doneRef.current = false
    await attemptMatch(distanceKm)

    if (!doneRef.current) {
      pollRef.current = setInterval(() => attemptMatch(distanceKm), POLL_MS)
    }
  }

  return (
    <View style={styles.container}>
      {!searching ? (
        <>
          <Text style={styles.title}>Race online</Text>
          <Text style={styles.subtitle}>Get matched with someone close to your ELO.</Text>

          <View style={styles.chipRow}>
            {DISTANCE_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.slug}
                style={[styles.chip, !usingCustom && selectedKm === cat.km && styles.chipActive]}
                onPress={() => {
                  setUsingCustom(false)
                  setSelectedKm(cat.km)
                }}
              >
                <Text style={[styles.chipText, !usingCustom && selectedKm === cat.km && styles.chipTextActive]}>
                  {cat.label}
                </Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.chip, usingCustom && styles.chipActive]}
              onPress={() => setUsingCustom(true)}
            >
              <Text style={[styles.chipText, usingCustom && styles.chipTextActive]}>Custom</Text>
            </TouchableOpacity>
          </View>

          {usingCustom && (
            <TextInput
              placeholder="Distance in km"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={customInput}
              onChangeText={setCustomInput}
              style={styles.input}
            />
          )}

          {message ? <Text style={styles.message}>{message}</Text> : null}

          <TouchableOpacity style={styles.primaryButton} onPress={startSearch}>
            <Text style={styles.primaryButtonText}>Find opponent</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.searchingContainer}>
          <View style={styles.searchingRing}>
            <ActivityIndicator size="large" color={colors.accent} />
          </View>
          <Text style={styles.searchingTitle}>Searching…</Text>
          <Text style={styles.subtitle}>Looking for someone near your ELO.</Text>

          <TouchableOpacity style={styles.cancelButton} onPress={cancelSearch}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20, paddingTop: 40 },
  title: { fontSize: 30, fontWeight: 'bold', color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 6, marginBottom: 24 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { backgroundColor: colors.card, borderRadius: 20, paddingVertical: 9, paddingHorizontal: 16, ...cardShadow },
  chipActive: { backgroundColor: colors.accent },
  chipText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.background },
  input: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    color: colors.textPrimary,
    fontSize: 15,
    ...cardShadow,
  },
  message: { color: colors.textSecondary, fontSize: 13, marginBottom: 16 },
  primaryButton: { backgroundColor: colors.accent, borderRadius: 14, paddingVertical: 16, alignItems: 'center', ...cardShadow },
  primaryButtonText: { color: colors.background, fontWeight: 'bold', fontSize: 15 },
  searchingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchingRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    ...cardShadow,
  },
  searchingTitle: { fontSize: 22, fontWeight: 'bold', color: colors.accent, marginBottom: 8 },
  cancelButton: {
    marginTop: 30,
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 30,
    ...cardShadow,
  },
  cancelButtonText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
})
