import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { AppSplashScreen } from '@/components/app-splash-screen';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SessionProvider, useSession } from '@/lib/auth-context';

const MIN_SPLASH_MS = 1200;

export default function RootLayout() {
return (
<SessionProvider>
<RootNavigator />
</SessionProvider>
  );
}

function RootNavigator() {
const colorScheme = useColorScheme();
const { session, isLoading } = useSession();
const [minTimeElapsed, setMinTimeElapsed] = useState(false);

useEffect(() => {
const timeout = setTimeout(() => setMinTimeElapsed(true), MIN_SPLASH_MS);
return () => clearTimeout(timeout);
}, []);

if (isLoading || !minTimeElapsed) {
return <AppSplashScreen />;
}

return (
<ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
<Stack>
<Stack.Protected guard={!!session}>
<Stack.Screen name="(tabs)" options={{ headerShown: false }} />
<Stack.Screen name="club/[id]" options={{ title: 'Club', headerShown: true }} />
<Stack.Screen name="race/[id]/index" options={{ title: 'Race', headerShown: true }} />
<Stack.Screen name="race/[id]/track" options={{ headerShown: false }} />
<Stack.Screen name="race-online" options={{ title: 'Race Online', headerShown: true }} />
<Stack.Screen name="invites" options={{ title: 'Pending', headerShown: true }} />
<Stack.Screen name="practice/index" options={{ title: 'Race Offline', headerShown: true }} />
<Stack.Screen name="practice/[distance]/index" options={{ title: 'Practice', headerShown: true }} />
<Stack.Screen name="ladder/[botId]/track" options={{ headerShown: false }} />
<Stack.Screen name="workout/[id]/index" options={{ title: 'Workout', headerShown: true }} />
<Stack.Screen name="workout/[id]/track" options={{ headerShown: false }} />
<Stack.Screen name="user/[id]/index" options={{ title: 'Profile', headerShown: true }} />
<Stack.Screen name="user/[id]/followers" options={{ title: 'Followers', headerShown: true }} />
<Stack.Screen name="user/[id]/following" options={{ title: 'Following', headerShown: true }} />
</Stack.Protected>
<Stack.Protected guard={!session}>
<Stack.Screen name="sign-in" options={{ headerShown: false }} />
</Stack.Protected>
</Stack>
<StatusBar style="auto" />
</ThemeProvider>
  );
}