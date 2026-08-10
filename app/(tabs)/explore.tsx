import { useEffect, useState } from 'react'
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'

import { useRouter } from 'expo-router'
import { useSession } from '../../lib/auth-context'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'
export default function ExploreScreen() {

  const { session } = useSession()
  const [message, setMessage] = useState('')
  const [clubName, setClubName] = useState('')
  const [clubs, setClubs] = useState<any[]>([])
  const [myClubIds, setMyClubIds] = useState<string[]>([])
  const router = useRouter()

  useEffect(() => {
    if (session) {
      fetchClubs()
      fetchMyMemberships()
    }
  }, [session])

  async function fetchClubs() {
    const { data, error } = await supabase
      .from('clubs')
      .select('*')
      .order('created_at', { ascending: false })

    console.log("FETCH CLUBS DATA:", data)
    console.log("FETCH CLUBS ERROR:", error)

    if (!error) {
      setClubs(data)
    }
  }

  async function createClub() {
    console.log("CREATE CLUB PRESSED")

    const { data, error } = await supabase
      .from('clubs')
      .insert({
        name: clubName.trim(),
        created_by: session?.user.id,
      })

    console.log("CLUB DATA:", data)
    console.log("CLUB ERROR:", error)

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Club created!')
      setClubName('')
      fetchClubs()
    }
  }

  async function joinClub(clubId: string) {
    console.log("JOIN CLUB PRESSED:", clubId)

    const { data, error } = await supabase
      .from('club_members')
      .insert({
        club_id: clubId,
        user_id: session?.user.id,
      })

    console.log("JOIN DATA:", data)
    console.log("JOIN ERROR:", error)

    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Joined club!')
      fetchMyMemberships()
    }
  }

  async function fetchMyMemberships() {
    const { data, error } = await supabase
      .from('club_members')
      .select('club_id')
      .eq('user_id', session?.user.id)

    console.log("MY MEMBERSHIPS:", data)

    if (!error && data) {
      setMyClubIds(data.map((row) => row.club_id))
    }
  }

  if (!session) return null

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <Text style={styles.title}>Clubs</Text>
      <Text style={styles.subtitle}>{clubs.length} clubs to join</Text>

      <View style={styles.createRow}>
        <TextInput
          placeholder="New club name"
          placeholderTextColor={colors.textSecondary}
          value={clubName}
          onChangeText={setClubName}
          style={styles.input}
        />
        <TouchableOpacity style={styles.createButton} onPress={createClub}>
          <Text style={styles.createButtonText}>Create</Text>
        </TouchableOpacity>
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}

      {clubs.map((club) => {
  const alreadyJoined = myClubIds.includes(club.id)

  return (
    <TouchableOpacity
      key={club.id}
      style={styles.clubCard}
      onPress={() => router.push(`/club/${club.id}`)}
    >
      <View style={styles.clubIcon}>
        <Text style={styles.clubIconText}>
          {club.name?.[0]?.toUpperCase() ?? '?'}
        </Text>
      </View>

      <View style={styles.clubInfo}>
        <Text style={styles.clubName}>{club.name}</Text>
      </View>

      {alreadyJoined ? (
        <Text style={styles.joinedLabel}>Joined</Text>
      ) : (
        <TouchableOpacity
          style={styles.joinButton}
          onPress={(e) => {
            e.stopPropagation()
            joinClub(club.id)
          }}
        >
          <Text style={styles.joinButtonText}>Join</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
})}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 28,
    paddingTop: 70,
    paddingBottom: 60,
  },
  title: {
    fontSize: 30,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  createRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    color: colors.textPrimary,
    fontSize: 14,
  },
  createButton: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  createButtonText: {
    color: colors.background,
    fontWeight: 'bold',
    fontSize: 14,
  },
  message: {
    color: colors.textSecondary,
    fontSize: 13,
    marginBottom: 16,
  },
  clubCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginTop: 12,
    gap: 12,
  },
  clubIcon: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clubIconText: {
    color: colors.accent,
    fontWeight: 'bold',
    fontSize: 16,
  },
  clubInfo: {
    flex: 1,
  },
  clubName: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  joinedLabel: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: '600',
  },
  joinButton: {
    borderWidth: 0.5,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 14,
  },
  joinButtonText: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
})