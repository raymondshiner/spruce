import { useRouter } from 'expo-router';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useSession } from '@/shared/state/session';

function maskKey(key: string | null): string {
  if (!key) return 'Not set';
  if (key.length < 12) return '••••';
  return `${key.slice(0, 5)}…${key.slice(-4)}`;
}

export default function Settings() {
  const router = useRouter();
  const session = useSession();

  const onChangeKey = () => router.push('/onboarding/key');
  const onChangeZone = () => router.push('/onboarding/zone');

  const onReset = () => {
    Alert.alert('Reset Spruce?', 'This clears your API key, zone, and device token. Projects are kept.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await session.reset();
          router.replace('/');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.safe} contentContainerStyle={styles.container}>
      <View style={styles.section}>
        <Text style={styles.label}>OpenAI API key</Text>
        <Text style={styles.value}>{maskKey(session.openaiApiKey)}</Text>
        <Pressable style={styles.row} onPress={onChangeKey}>
          <Text style={styles.rowText}>Update key</Text>
        </Pressable>
        <Pressable
          style={styles.row}
          onPress={() => Linking.openURL('https://platform.openai.com/usage')}
        >
          <Text style={styles.rowText}>Check usage on OpenAI →</Text>
        </Pressable>
        <Pressable
          style={styles.row}
          onPress={() => Linking.openURL('https://platform.openai.com/account/limits')}
        >
          <Text style={styles.rowText}>Set a spending limit →</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Zone</Text>
        <Text style={styles.value}>
          {session.zone ? `${session.zip} · USDA ${session.zone}` : 'Not set'}
        </Text>
        <Pressable style={styles.row} onPress={onChangeZone}>
          <Text style={styles.rowText}>Change zip</Text>
        </Pressable>
      </View>

      <View style={styles.section}>
        <Pressable style={[styles.row, styles.danger]} onPress={onReset}>
          <Text style={[styles.rowText, styles.dangerText]}>Reset Spruce</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f1a14' },
  container: { padding: 16, gap: 16 },
  section: { backgroundColor: '#152620', borderRadius: 14, padding: 16, gap: 8 },
  label: {
    color: '#7bbf9c',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  value: { color: '#f3f7f4', fontSize: 16, fontWeight: '500' },
  row: { paddingVertical: 10 },
  rowText: { color: '#7bbf9c', fontSize: 14 },
  danger: { alignItems: 'center' },
  dangerText: { color: '#ff8a8a' },
});
