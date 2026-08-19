import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { LinearGradient } from 'expo-linear-gradient'
import { useRef, useState } from 'react'
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native'

import { useSession } from '../lib/auth-context'
import { cardShadow, colors, gradients } from '../lib/theme'

const SLIDES = [
  {
    icon: 'emoji-events' as const,
    gradient: gradients.hero,
    title: 'Every run has a rating',
    body: 'Race someone and your ELO moves — win and it climbs, lose and it drops, just like chess. Cover less than the full distance and it counts as a DNF: an automatic loss.',
  },
  {
    icon: 'bolt' as const,
    gradient: gradients.card,
    title: 'Race online, in real time',
    body: 'Queue up and get matched against another runner near your rating. You both run the same distance, live — whoever finishes faster (or covers more ground) wins.',
  },
  {
    icon: 'directions-run' as const,
    gradient: gradients.hero,
    title: 'Or climb the bot ladder',
    body: "No one else around? Race the offline ladder instead — a trail of pace targets that gets harder as you beat them. Good for solo training that still counts.",
  },
  {
    icon: 'groups' as const,
    gradient: gradients.card,
    title: 'Join a club',
    body: 'Follow a club feed, race clubmates on the leaderboard, and if a coach sets one up, get assigned structured interval workouts to train between races.',
  },
]

export default function OnboardingScreen() {
  const { completeOnboarding } = useSession()
  const { width } = useWindowDimensions()
  const scrollRef = useRef<ScrollView>(null)
  const [index, setIndex] = useState(0)

  function handleScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const newIndex = Math.round(event.nativeEvent.contentOffset.x / width)
    if (newIndex !== index) setIndex(newIndex)
  }

  function goToSlide(i: number) {
    scrollRef.current?.scrollTo({ x: i * width, animated: true })
    setIndex(i)
  }

  const isLast = index === SLIDES.length - 1

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.skipButton} onPress={completeOnboarding}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
      >
        {SLIDES.map((slide, i) => (
          <View key={slide.title} style={[styles.slide, { width }]}>
            <LinearGradient
              colors={slide.gradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.iconBadge}
            >
              <MaterialIcons name={slide.icon} size={48} color={colors.accent} />
            </LinearGradient>
            <Text style={styles.title}>{slide.title}</Text>
            <Text style={styles.body}>{slide.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((slide, i) => (
            <View key={slide.title} style={[styles.dot, i === index && styles.dotActive]} />
          ))}
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => (isLast ? completeOnboarding() : goToSlide(index + 1))}
        >
          <Text style={styles.primaryButtonText}>{isLast ? "Let's go" : 'Next'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 24,
    zIndex: 1,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  skipText: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  iconBadge: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
    ...cardShadow,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: 14,
  },
  body: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: 48,
    alignItems: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.card,
  },
  dotActive: {
    backgroundColor: colors.accent,
    width: 20,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
    ...cardShadow,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: 'bold',
  },
})
