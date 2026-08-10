import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://fhtwhdzdripvxvttnsxa.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZodHdoZHpkcmlwdnh2dHRuc3hhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4MzIyODAsImV4cCI6MjEwMDQwODI4MH0.WXj9L8yjofYQxvsxLDjluEx5gMuSkIvkXvx-sYz5x5s'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})