import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { AppSplashScreen } from '@/components/app-splash-screen';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SessionProvider, useSession } from '@/lib/auth-context';

export const unstable_settings = {
anchor: '(tabs)',
};

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
<Stack.Screen name="race/[id]" options={{ title: 'Race', headerShown: true }} />
<Stack.Screen name="find-friends" options={{ title: 'Find People', headerShown: true }} />
</Stack.Protected>
<Stack.Protected guard={!session}>
<Stack.Screen name="sign-in" options={{ headerShown: false }} />
</Stack.Protected>
</Stack>
<StatusBar style="auto" />
</ThemeProvider>
  );
}