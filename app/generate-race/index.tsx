import { useRouter } from 'expo-router'
import { useState } from 'react'
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

import { DISTANCE_CATEGORIES } from '../../lib/distance-categories'
import { ABILITY_TIERS, AbilityTier } from '../../lib/simulated-race'
import { cardShadow, colors } from '../../lib/theme'

const FIELD_SIZE_PRESETS = [10, 50, 100, 500]

export default function GenerateRaceScreen() {
  const router = useRouter()

  const [distanceSlug, setDistanceSlug] = useState(DISTANCE_CATEGORIES[1].slug)
  const [fieldSize, setFieldSize] = useState(50)
  const [customFieldSize, setCustomFieldSize] = useState('')
  const [tier, setTier] = useState<AbilityTier>('mixed')

  const category = DISTANCE_CATEGORIES.find((c) => c.slug === distanceSlug) ?? DISTANCE_CATEGORIES[1]

  function startRace() {
    const size = Math.max(1, Math.min(2000, Number(customFieldSize) || fieldSize))
    router.push({
      pathname: '/generate-race/track',
      params: { distanceKm: String(category.km), fieldSize: String(size), tier },
    })
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Generate a race</Text>
      <Text style={styles.subtitle}>
        Build a simulated field of any size and ability level, then race it live. Doesn&apos;t affect your ELO.
      </Text>

      <Text style={styles.sectionLabel}>Distance</Text>
      <View style={styles.chipRow}>
        {DISTANCE_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.slug}
            style={[styles.chip, distanceSlug === cat.slug && styles.chipActive]}
            onPress={() => setDistanceSlug(cat.slug)}
          >
            <Text style={[styles.chipText, distanceSlug === cat.slug && styles.chipTextActive]}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Field size</Text>
      <View style={styles.chipRow}>
        {FIELD_SIZE_PRESETS.map((size) => (
          <TouchableOpacity
            key={size}
            style={[styles.chip, fieldSize === size && !customFieldSize && styles.chipActive]}
            onPress={() => {
              setFieldSize(size)
              setCustomFieldSize('')
            }}
          >
            <Text style={[styles.chipText, fieldSize === size && !customFieldSize && styles.chipTextActive]}>
              {size}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <TextInput
        placeholder="Or enter a custom field size (max 2000)"
        placeholderTextColor={colors.textSecondary}
        value={customFieldSize}
        onChangeText={setCustomFieldSize}
        keyboardType="numeric"
        style={styles.input}
      />

      <Text style={styles.sectionLabel}>Ability</Text>
      {ABILITY_TIERS.map((option) => (
        <TouchableOpacity
          key={option.key}
          style={[styles.tierCard, tier === option.key && styles.tierCardActive]}
          onPress={() => setTier(option.key)}
        >
          <Text style={[styles.tierLabel, tier === option.key && styles.tierLabelActive]}>{option.label}</Text>
          <Text style={styles.tierDescription}>{option.description}</Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={styles.startButton} onPress={startRace}>
        <Text style={styles.startButtonText}>Generate & start</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20, paddingTop: 40 },
  title: { fontSize: 30, fontWeight: 'bold', color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 6, marginBottom: 24, lineHeight: 19 },
  sectionLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, marginTop: 8 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  chip: { backgroundColor: colors.card, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 18, ...cardShadow },
  chipActive: { backgroundColor: colors.accent },
  chipText: { color: colors.textPrimary, fontSize: 14, fontWeight: '700' },
  chipTextActive: { color: colors.background },
  input: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    color: colors.textPrimary,
    fontSize: 14,
    ...cardShadow,
  },
  tierCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    ...cardShadow,
  },
  tierCardActive: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  tierLabel: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
  tierLabelActive: { color: colors.accent },
  tierDescription: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
  startButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 16,
    ...cardShadow,
  },
  startButtonText: { color: colors.background, fontSize: 15, fontWeight: 'bold' },
})
