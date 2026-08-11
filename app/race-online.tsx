import { useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

import { useSession } from '../lib/auth-context'
import { DISTANCE_CATEGORIES } from '../lib/distance-categories'
import { supabase } from '../lib/supabase'
import { colors } from '../lib/theme'

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
  container: { flex: 1, backgroundColor: colors.background, padding: 28, paddingTop: 40 },
  title: { fontSize: 24, fontWeight: 'bold', color: colors.textPrimary },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 6, marginBottom: 24 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { borderWidth: 0.5, borderColor: colors.border, borderRadius: 20, paddingVertical: 8, paddingHorizontal: 14 },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { color: colors.textPrimary, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.background },
  input: {
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    color: colors.textPrimary,
    fontSize: 15,
  },
  message: { color: colors.textSecondary, fontSize: 13, marginBottom: 16 },
  primaryButton: { backgroundColor: colors.accent, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  primaryButtonText: { color: colors.background, fontWeight: 'bold', fontSize: 14 },
  searchingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  searchingTitle: { fontSize: 22, fontWeight: 'bold', color: colors.accent, marginBottom: 8 },
  cancelButton: {
    marginTop: 30,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },
  cancelButtonText: { color: colors.textPrimary, fontSize: 14, fontWeight: '600' },
})
