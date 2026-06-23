import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useProjects } from '@/shared/state/projects';
import { useSession } from '@/shared/state/session';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const hydrateSession = useSession((s) => s.hydrate);
  const hydrateProjects = useProjects((s) => s.hydrate);

  useEffect(() => {
    hydrateSession();
    hydrateProjects();
  }, [hydrateSession, hydrateProjects]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding/key" options={{ title: 'Add API key' }} />
            <Stack.Screen name="onboarding/zone" options={{ title: 'Your area' }} />
            <Stack.Screen name="(main)" />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
