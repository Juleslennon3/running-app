import { useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'

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
  const [clubLocation, setClubLocation] = useState('')
  const [clubDescription, setClubDescription] = useState('')
  const [allClubs, setAllClubs] = useState<any[]>([])
  const [message, setMessage] = useState('')
  const [discoverVisible, setDiscoverVisible] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    if (session) {
      fetchMyClubs()
      fetchAllClubs()
    }
  }, [session])

  async function fetchMyClubs() {
    setLoading(true)
    setLoadError('')

    const { data: memberships, error } = await supabase
      .from('club_members')
      .select('club_id')
      .eq('user_id', session?.user.id)

    console.log("CLUBS TAB MEMBERSHIPS ERROR:", error)

    if (error) {
      setLoadError("Couldn't load your clubs. Pull to refresh or try again shortly.")
      setLoading(false)
      return
    }

    if (!memberships || memberships.length === 0) {
      setMyClubs([])
      setSelectedClubId(null)
      setLoading(false)
      return
    }

    const clubIds = memberships.map((row: any) => row.club_id)

    const { data: clubRows, error: clubsError } = await supabase
      .from('clubs')
      .select('id, name')
      .in('id', clubIds)
      .is('archived_at', null)

    console.log("CLUBS TAB CLUBS ERROR:", clubsError)

    if (clubsError) {
      setLoadError("Couldn't load your clubs. Pull to refresh or try again shortly.")
    } else if (clubRows) {
      setMyClubs(clubRows)
      setSelectedClubId((current: any) => current ?? clubRows[0]?.id ?? null)
    }

    setLoading(false)
  }

  async function fetchAllClubs() {
    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .is('archived_at', null)
      .order('created_at', { ascending: false })

    console.log("CLUBS TAB ALL CLUBS ERROR:", error)

    if (!error && data) {
      setAllClubs(data)
    }
  }

  async function handleLeave() {
    setSelectedClubId(null)
    fetchMyClubs()
    fetchAllClubs()
  }

  async function createClub() {
    const { error } = await supabase
      .from('clubs')
      .insert({
        name: clubName.trim(),
        location: clubLocation.trim() || null,
        description: clubDescription.trim() || null,
        created_by: session?.user.id,
      })

    console.log("CLUBS TAB CREATE CLUB ERROR:", error)

    if (error) {
      setMessage(error.message)
    } else {
      setClubName('')
      setClubLocation('')
      setClubDescription('')
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
      setDiscoverVisible(false)
      fetchMyClubs()
    }
  }

  if (!session) return null

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.accent} />
      </View>
    )
  }

  const myClubIds = new Set(myClubs.map((c) => c.id))
  const query = searchQuery.trim().toLowerCase()
  const filteredClubs = allClubs
    .filter((c) => !myClubIds.has(c.id))
    .filter((c) =>
      query.length === 0 ||
      c.name?.toLowerCase().includes(query) ||
      c.location?.toLowerCase().includes(query)
    )

  const discoverContent = (
    <>
      <TextInput
        placeholder="Search by name or location"
        placeholderTextColor={colors.textSecondary}
        value={searchQuery}
        onChangeText={setSearchQuery}
        style={styles.searchInput}
        autoCapitalize="none"
      />

      <View style={styles.createBlock}>
        <TextInput
          placeholder="New club name"
          placeholderTextColor={colors.textSecondary}
          value={clubName}
          onChangeText={setClubName}
          style={styles.createInput}
        />
        <TextInput
          placeholder="Location (e.g. Dublin, Ireland)"
          placeholderTextColor={colors.textSecondary}
          value={clubLocation}
          onChangeText={setClubLocation}
          style={styles.createInput}
        />
        <TextInput
          placeholder="Description (skill level, vibe, who it's for)"
          placeholderTextColor={colors.textSecondary}
          value={clubDescription}
          onChangeText={setClubDescription}
          style={styles.createInput}
          multiline
        />
        <TouchableOpacity style={styles.createButton} onPress={createClub}>
          <Text style={styles.createButtonText}>Create club</Text>
        </TouchableOpacity>
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      {filteredClubs.length === 0 && (
        <Text style={styles.emptyText}>No clubs found.</Text>
      )}
      {filteredClubs.map((club) => (
        <TouchableOpacity key={club.id} style={styles.clubCard} onPress={() => router.push(`/club/${club.id}`)}>
          <View style={styles.clubIcon}>
            <Text style={styles.clubIconText}>{club.name?.[0]?.toUpperCase() ?? '?'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.clubName}>{club.name}</Text>
            {club.location ? <Text style={styles.clubMeta}>{club.location}</Text> : null}
            {club.description ? <Text style={styles.clubMeta} numberOfLines={2}>{club.description}</Text> : null}
          </View>
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
    </>
  )

  if (myClubs.length === 0) {
    return (
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
        <Text style={styles.title}>Clubs</Text>
        <Text style={styles.subtitle}>You&apos;re not in any clubs yet — join one to see its leaderboard, races, and feed.</Text>
        {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}
        {discoverContent}
      </ScrollView>
    )
  }

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <View style={styles.tabHeaderRow}>
        <Text style={[sectionLabel, styles.tabLabel]}>Clubs</Text>
        <TouchableOpacity style={styles.discoverButton} onPress={() => setDiscoverVisible(true)}>
          <Text style={styles.discoverButtonText}>Discover clubs</Text>
        </TouchableOpacity>
      </View>
      {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}
      {selectedClubId && (
        <ClubBody
          clubId={selectedClubId}
          myClubs={myClubs}
          onSwitchClub={setSelectedClubId}
          onLeave={handleLeave}
        />
      )}

      <Modal visible={discoverVisible} animationType="slide" onRequestClose={() => setDiscoverVisible(false)}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
          <View style={styles.tabHeaderRow}>
            <Text style={styles.title}>Discover clubs</Text>
            <TouchableOpacity onPress={() => setDiscoverVisible(false)}>
              <Text style={styles.closeText}>Close</Text>
            </TouchableOpacity>
          </View>
          {discoverContent}
        </ScrollView>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: colors.background },
  container: { padding: 20, paddingTop: 70, paddingBottom: 60 },
  loadingContainer: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.danger, fontSize: 13, marginBottom: 16 },
  tabHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  tabLabel: { marginBottom: 4 },
  title: { fontSize: 34, fontWeight: 'bold', color: colors.textPrimary, letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginBottom: 20, lineHeight: 19 },
  discoverButton: {
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    ...cardShadow,
  },
  discoverButtonText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  closeText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  searchInput: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    color: colors.textPrimary,
    fontSize: 14,
    ...cardShadow,
  },
  createBlock: { gap: 10, marginBottom: 16 },
  createInput: {
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
    paddingVertical: 12,
    alignItems: 'center',
    ...cardShadow,
  },
  createButtonText: { color: colors.background, fontWeight: 'bold', fontSize: 14 },
  message: { color: colors.textSecondary, fontSize: 13, marginBottom: 16 },
  emptyText: { color: colors.textSecondary, fontSize: 13 },
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
  clubName: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  clubMeta: { color: colors.textSecondary, fontSize: 12, marginTop: 2 },
  joinButton: { backgroundColor: colors.accent, borderRadius: 20, paddingVertical: 7, paddingHorizontal: 16 },
  joinButtonText: { color: colors.background, fontSize: 13, fontWeight: 'bold' },
})
