import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native'

import { supabase } from '../lib/supabase'
import { cardShadow, colors } from '../lib/theme'

function extractTokens(url: string) {
  const fragment = url.split('#')[1] ?? url.split('?')[1] ?? ''
  const params = new URLSearchParams(fragment)
  return {
    accessToken: params.get('access_token'),
    refreshToken: params.get('refresh_token'),
  }
}

export default function ResetPasswordScreen() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    establishSession()

    const subscription = Linking.addEventListener('url', ({ url }) => {
      establishSessionFromUrl(url)
    })

    return () => subscription.remove()
  }, [])

  async function establishSession() {
    const url = await Linking.getInitialURL()
    const fallbackUrl = Platform.OS === 'web' ? window.location.href : null
    await establishSessionFromUrl(url ?? fallbackUrl ?? '')
  }

  async function establishSessionFromUrl(url: string) {
    const { accessToken, refreshToken } = extractTokens(url)

    if (!accessToken || !refreshToken) {
      setMessage('This reset link looks invalid or has expired. Request a new one from the sign-in screen.')
      return
    }

    const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })

    console.log("RESET PASSWORD SET SESSION ERROR:", error)

    if (error) {
      setMessage('This reset link looks invalid or has expired. Request a new one from the sign-in screen.')
    } else {
      setReady(true)
    }
  }

  async function updatePassword() {
    const { error } = await supabase.auth.updateUser({ password: password.trim() })

    console.log("UPDATE PASSWORD ERROR:", error)

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('')
      setDone(true)
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Reset your password</Text>

        {done ? (
          <>
            <Text style={styles.message}>Your password has been updated.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => router.replace('/')}>
              <Text style={styles.primaryButtonText}>Continue</Text>
            </TouchableOpacity>
          </>
        ) : ready ? (
          <>
            <TextInput
              placeholder="New password"
              placeholderTextColor={colors.textSecondary}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              style={styles.input}
            />
            <TouchableOpacity style={styles.primaryButton} onPress={updatePassword}>
              <Text style={styles.primaryButtonText}>Update password</Text>
            </TouchableOpacity>
          </>
        ) : (
          <Text style={styles.message}>Verifying reset link…</Text>
        )}

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 28,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 20,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 15,
    marginBottom: 12,
    color: colors.textPrimary,
    fontSize: 15,
    ...cardShadow,
  },
  primaryButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    ...cardShadow,
  },
  primaryButtonText: {
    color: colors.background,
    fontSize: 15,
    fontWeight: 'bold',
  },
  message: {
    marginTop: 18,
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
})
