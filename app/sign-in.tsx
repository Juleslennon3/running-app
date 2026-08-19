import { LinearGradient } from 'expo-linear-gradient'
import { useState } from 'react'
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

import { supabase } from '../lib/supabase'
import { cardShadow, colors, gradients } from '../lib/theme'

export default function SignInScreen() {

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [message, setMessage] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  async function signUp() {
    console.log("SIGNUP BUTTON PRESSED")

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: password.trim(),
    })

    console.log("DATA:", data)
    console.log("ERROR:", error)

    if (error) {
      setMessage(error.message)
      return
    }

    if (data.user) {
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ username: username.trim() })
        .eq('id', data.user.id)

      console.log("PROFILE UPDATE ERROR:", profileError)
    }

    setMessage('Account created! Check your email.')
  }

  async function logIn() {
    console.log("LOGIN BUTTON PRESSED")

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password.trim(),
    })

    console.log("LOGIN DATA:", data)
    console.log("LOGIN ERROR:", error)

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Logged in!')
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <ScrollView contentContainerStyle={styles.container}>

        <LinearGradient colors={gradients.hero} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.logoMark}>
          <Text style={styles.logoMarkText}>R</Text>
        </LinearGradient>
        <Text style={styles.logo}>RUN CLUB</Text>
        <Text style={styles.tagline}>Race your friends. Track every mile.</Text>

        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleTab, mode === 'login' && styles.toggleTabActive]}
            onPress={() => setMode('login')}
          >
            <Text style={[styles.toggleText, mode === 'login' && styles.toggleTextActive]}>
              Log in
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleTab, mode === 'signup' && styles.toggleTabActive]}
            onPress={() => setMode('signup')}
          >
            <Text style={[styles.toggleText, mode === 'signup' && styles.toggleTextActive]}>
              Sign up
            </Text>
          </TouchableOpacity>
        </View>

        {mode === 'signup' && (
          <TextInput
            placeholder="Username"
            placeholderTextColor={colors.textSecondary}
            value={username}
            onChangeText={setUsername}
            style={styles.input}
            autoCapitalize="none"
          />
        )}

        <TextInput
          placeholder="Email"
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          placeholder="Password"
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
        />

        <TouchableOpacity onPress={mode === 'login' ? logIn : signUp}>
          <LinearGradient colors={gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>
              {mode === 'login' ? 'Log in' : 'Create account'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

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
  logoMark: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#1c2b12',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...cardShadow,
  },
  logoMarkText: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.accent,
  },
  logo: {
    fontSize: 34,
    fontWeight: 'bold',
    color: colors.textPrimary,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 32,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 4,
    marginBottom: 24,
    ...cardShadow,
  },
  toggleTab: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 11,
    alignItems: 'center',
  },
  toggleTabActive: {
    backgroundColor: colors.accent,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  toggleTextActive: {
    color: colors.background,
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
