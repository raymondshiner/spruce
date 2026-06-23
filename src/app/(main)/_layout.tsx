import { Stack } from 'expo-router';

export default function MainLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: '#0f1a14' },
        headerTintColor: '#f3f7f4',
        headerTitleStyle: { fontWeight: '700' },
        contentStyle: { backgroundColor: '#0f1a14' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Spruce' }} />
      <Stack.Screen name="capture" options={{ title: 'New project', presentation: 'modal' }} />
      <Stack.Screen name="project/[id]" options={{ title: 'Project' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}
