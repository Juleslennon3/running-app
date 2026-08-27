import { useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useState } from 'react'
import { ScrollView, StyleSheet } from 'react-native'

import { ClubBody } from '../../components/club-body'
import { useSession } from '../../lib/auth-context'
import { supabase } from '../../lib/supabase'
import { colors } from '../../lib/theme'

export default function ClubDetailScreen() {
  const { id } = useLocalSearchParams()
  const router = useRouter()
  const { session } = useSession()
  const [myClubs, setMyClubs] = useState<{ id: any; name: string }[]>([])

  useEffect(() => {
    if (session) {
      fetchMyClubs()
    }
  }, [session])

  async function fetchMyClubs() {
    const { data: memberships, error } = await supabase
      .from('club_members')
      .select('club_id')
      .eq('user_id', session?.user.id)

    if (error || !memberships || memberships.length === 0) {
      setMyClubs([])
      return
    }

    const clubIds = memberships.map((row: any) => row.club_id)

    const { data: clubRows, error: clubsError } = await supabase
      .from('clubs')
      .select('id, name')
      .in('id', clubIds)
      .is('archived_at', null)

    console.log("MY CLUBS ERROR:", clubsError)

    if (!clubsError && clubRows) {
      setMyClubs(clubRows)
    }
  }

  return (
    <ScrollView style={styles.scrollView} contentContainerStyle={styles.container}>
      <ClubBody
        clubId={id as string}
        myClubs={myClubs}
        onSwitchClub={(newClubId) => router.replace(`/club/${newClubId}`)}
        onLeave={() => router.replace('/(tabs)/clubs')}
      />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 20,
    paddingTop: 20,
    paddingBottom: 60,
  },
})
