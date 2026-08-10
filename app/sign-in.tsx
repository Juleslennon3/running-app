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
      style={{ flex: 1, backgroundColor: '#0a0b0d' }}
    >
      <ScrollView contentContainerStyle={styles.container}>

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
            placeholderTextColor="#6b6e73"
            value={username}
            onChangeText={setUsername}
            style={styles.input}
            autoCapitalize="none"
          />
        )}

        <TextInput
          placeholder="Email"
          placeholderTextColor="#6b6e73"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <TextInput
          placeholder="Password"
          placeholderTextColor="#6b6e73"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
        />

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={mode === 'login' ? logIn : signUp}
        >
          <Text style={styles.primaryButtonText}>
            {mode === 'login' ? 'Log in' : 'Create account'}
          </Text>
        </TouchableOpacity>

        {message ? <Text style={styles.message}>{message}</Text> : null}

      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const ACCENT = '#e8ff2e'
const BG = '#0a0b0d'
const CARD = '#111214'
const BORDER = '#1e2023'
const TEXT_PRIMARY = '#f5f5f2'
const TEXT_SECONDARY = '#6b6e73'

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 28,
    backgroundColor: BG,
  },
  logo: {
    fontSize: 32,
    fontWeight: 'bold',
    color: TEXT_PRIMARY,
    letterSpacing: 1,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 14,
    color: TEXT_SECONDARY,
    marginBottom: 32,
  },
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: BORDER,
    padding: 4,
    marginBottom: 24,
  },
  toggleTab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9,
    alignItems: 'center',
  },
  toggleTabActive: {
    backgroundColor: ACCENT,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: TEXT_SECONDARY,
  },
  toggleTextActive: {
    color: '#0a0b0d',
  },
  input: {
    backgroundColor: CARD,
    borderWidth: 0.5,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    color: TEXT_PRIMARY,
    fontSize: 15,
  },
  primaryButton: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    padding: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    color: '#0a0b0d',
    fontSize: 15,
    fontWeight: 'bold',
  },
  message: {
    marginTop: 18,
    color: TEXT_SECONDARY,
    fontSize: 13,
    textAlign: 'center',
  },
})
