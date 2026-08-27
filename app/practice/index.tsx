import { useRouter } from 'expo-router'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

import { DISTANCE_CATEGORIES } from '../../lib/distance-categories'
import { cardShadow, colors } from '../../lib/theme'

export default function PracticePickerScreen() {
  const router = useRouter()

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Race offline</Text>
      <Text style={styles.subtitle}>Pick a distance to challenge the bot ladder. Doesn&apos;t affect your ELO.</Text>

      <View style={styles.chipRow}>
        {DISTANCE_CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.slug}
            style={styles.chip}
            onPress={() => router.push(`/practice/${cat.slug}`)}
          >
            <Text style={styles.chipText}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.generateCard} onPress={() => router.push('/generate-race')}>
        <Text style={styles.generateCardTitle}>Generate a race</Text>
        <Text style={styles.generateCardSubtitle}>
          Build a simulated field of any size and ability level — race hundreds of people at once.
        </Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 20, paddingTop: 40 },
  title: { fontSize: 30, fontWeight: 'bold', color: colors.textPrimary, letterSpacing: -0.5 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 6, marginBottom: 24 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { backgroundColor: colors.card, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 22, ...cardShadow },
  chipText: { color: colors.textPrimary, fontSize: 15, fontWeight: '700' },
  generateCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 18,
    marginTop: 28,
    borderWidth: 2,
    borderColor: colors.accent,
    ...cardShadow,
  },
  generateCardTitle: { color: colors.accent, fontSize: 17, fontWeight: '700' },
  generateCardSubtitle: { color: colors.textSecondary, fontSize: 13, marginTop: 6, lineHeight: 19 },
})
