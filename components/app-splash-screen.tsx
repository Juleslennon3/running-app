import { StyleSheet, Text, View } from 'react-native'

import { colors } from '../lib/theme'

export function AppSplashScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.logo}>RUN CLUB</Text>
      <Text style={styles.tagline}>Welcome back</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
})
