import { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'

import { supabase } from './supabase'

type AuthContextValue = {
  session: Session | null
  isLoading: boolean
  needsOnboarding: boolean
  signOut: () => Promise<void>
  completeOnboarding: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function useSession() {
  const value = useContext(AuthContext)
  if (!value) {
    throw new Error('useSession must be used within a SessionProvider')
  }
  return value
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      fetchOnboardingState(session)
      setIsLoading(false)
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      fetchOnboardingState(session)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])

  async function fetchOnboardingState(session: Session | null) {
    if (!session) {
      setNeedsOnboarding(false)
      return
    }

    const { data } = await supabase
      .from('profiles')
      .select('has_onboarded')
      .eq('id', session.user.id)
      .single()

    setNeedsOnboarding(data ? !data.has_onboarded : false)
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function completeOnboarding() {
    setNeedsOnboarding(false)
    if (session) {
      await supabase.from('profiles').update({ has_onboarded: true }).eq('id', session.user.id)
    }
  }

  return (
    <AuthContext.Provider value={{ session, isLoading, needsOnboarding, signOut, completeOnboarding }}>
      {children}
    </AuthContext.Provider>
  )
}
