import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

import { ClubBody } from '../../components/club-body'
import { useSession } from '../../lib/auth-context'
import { supabase } from '../../lib/supabase'
import { cardShadow, colors, sectionLabel } from '../../lib/theme'

export default function ClubsScreen() {
  const router = useRouter()
  const { session } = useSession()

  const [myClubs, setMyClubs] = useState<{ id: any; name: string }[]>([])
  const [selectedClubId, setSelectedClubId] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  const [searchQuery, setSearchQuery] = useState('')
  const [clubName, setClubName] = useState('')
  const [allClubs, setAllClubs] = useState<any[]>([])
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (session) {
      fetchMyClubs()
    }
  }, [session])

  async function fetchMyClubs() {
    setLoading(true)

    const { data: memberships, error } = await supabase
      .from('club_members')
      .select('club_id')
      .eq('user_id', session?.user.id)

    console.log("CLUBS TAB MEMBERSHIPS ERROR:", error)

    if (error || !memberships || memberships.length === 0) {
      setMyClubs([])
      setSelectedClubId(null)
      fetchAllClubs()
      setLoading(false)
      return
    }

    const clubIds = memberships.map((row: any) => row.club_id)

    const { data: clubRows, error: clubsError } = await supabase
      .from('clubs')
      .select('id, name')
      .in('id', clubIds)

    console.log("CLUBS TAB CLUBS ERROR:", clubsError)

    if (!clubsError && clubRows) {
      setMyClubs(clubRows)
      setSelectedClubId((current: any) => current ?? clubRows[0]?.id ?? null)
    }

    setLoading(false)
  }

  async function fetchAllClubs() {
    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .order('created_at', { ascending: false })

    console.log("CLUBS TAB ALL CLUBS ERROR:", error)

    if (!error && data) {
      setAllClubs(data)
    }
  }

  async function createClub() {
    const { error } = await supabase
      .from('clubs')
      .insert({ name: clubName.trim(), created_by: session?.user.id })

    console.log("CLUBS TAB CREATE CLUB ERROR:", error)

    if (error) {
      setMessage(error.message)
    } else {
      setClubName('')
      setMessage('')
      fetchAllClubs()
    }
  }

  async function joinClub(clubId: string) {
    const { error } = await supabase
      .from('club_members')
      .insert({ club_id: clubId, user_id: session?.user.id })

    console.log("CLUBS TAB JOIN ERROR:", error)

    if (!error) {
      fetchMyClubs()
    }
  }

  if (!session || loading) return null

  if (myClubs.length === 0) {
    const filteredClubs = allClubs.filter((c) =>
      c.name?.toLowerCase().includes(searchQuery.trim().toLowerCase())
    )

    return (
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
        <Text style={styles.title}>Clubs</Text>
        <Text style={styles.subtitle}>You&apos;re not in any clubs yet — join one to see its leaderboard, races, and feed.</Text>

        <TextInput
          placeholder="Search clubs"
          placeholderTextColor={colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
          autoCapitalize="none"
        />

        <View style={styles.createRow}>
          <TextInput
            placeholder="New club name"
            placeholderTextColor={colors.textSecondary}
            value={clubName}
            onChangeText={setClubName}
            style={styles.createInput}
          />
          <TouchableOpacity style={styles.createButton} onPress={createClub}>
            <Text style={styles.createButtonText}>Create</Text>
          </TouchableOpacity>
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        {filteredClubs.map((club) => (
          <TouchableOpacity key={club.id} style={styles.clubCard} onPress={() => router.push(`/club/${club.id}`)}>
            <View style={styles.clubIcon}>
              <Text style={styles.clubIconText}>{club.name?.[0]?.toUpperCase() ?? '?'}</Text>
            </View>
            <Text style={styles.clubName}>{club.name}</Text>
            <TouchableOpacity
              style={styles.joinButton}
              onPress={(e) => {
                e.stopPropagation()
                joinClub(club.id)
              }}
            >
              <Text style={styles.joinButtonText}>Join</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}
      </ScrollView>
    )
  }

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <Text style={[sectionLabel, styles.tabLabel]}>Clubs</Text>
      {selectedClubId && (
        <ClubBody
          clubId={selectedClubId}
          myClubs={myClubs}
          onSwitchClub={setSelectedClubId}
        />
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, paddingTop: 70, paddingBottom: 60 },
  tabLabel: { marginBottom: 4 },
  title: { fontSize: 34, fontWeight: 'bold', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 20, lineHeight: 19 },
  searchInput: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    color: colors.textPrimary,
    fontSize: 14,
    ...cardShadow,
  },
  createRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  createInput: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 12,
    color: colors.textPrimary,
    fontSize: 14,
    ...cardShadow,
  },
  createButton: {
    backgroundColor: colors.accent,
    borderRadius: 14,
    paddingHorizontal: 18,
    justifyContent: 'center',
    ...cardShadow,
  },
  createButtonText: { color: colors.background, fontWeight: 'bold', fontSize: 14 },
  message: { color: colors.textSecondary, fontSize: 13, marginBottom: 16 },
  clubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    gap: 12,
    ...cardShadow,
  },
  clubIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#1c2b12',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubIconText: { color: colors.accent, fontWeight: 'bold', fontSize: 16 },
  clubName: { flex: 1, color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  joinButton: { backgroundColor: colors.accent, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 16 },
  joinButtonText: { color: colors.background, fontSize: 13, fontWeight: 'bold' },
})
