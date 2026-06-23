import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { isValidUsZip, zipToZone } from '@/shared/data/zip-to-zone';
import { useSession } from '@/shared/state/session';

export default function OnboardingZone() {
  const router = useRouter();
  const setZipAndZone = useSession((s) => s.setZipAndZone);
  const [zip, setZip] = useState('');
  const [busy, setBusy] = useState(false);

  const onContinue = async () => {
    if (!isValidUsZip(zip)) {
      Alert.alert('Need a 5-digit US zip', 'Outside the US? Indoor mode (coming soon) works anywhere.');
      return;
    }
    const zone = zipToZone(zip);
    if (!zone) {
      Alert.alert(
        'Zone unknown',
        'We don’t have that zip yet. You can still continue and we’ll skip zone-specific suggestions.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue anyway',
            onPress: async () => {
              setBusy(true);
              await setZipAndZone(zip, 'unknown');
              setBusy(false);
              router.replace('/(main)');
            },
          },
        ],
      );
      return;
    }
    setBusy(true);
    try {
      await setZipAndZone(zip, zone);
      router.replace('/(main)');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Where are you?</Text>
          <Text style={styles.body}>
            Spruce uses your USDA plant hardiness zone to recommend plants that survive your winters.
            We only need your zip — no other location data.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="ZIP code"
            placeholderTextColor="#999"
            keyboardType="number-pad"
            maxLength={5}
            value={zip}
            onChangeText={setZip}
          />

          <Pressable
            style={[styles.primary, zip.length < 5 && styles.primaryDisabled]}
            onPress={onContinue}
            disabled={zip.length < 5 || busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>Continue</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f1a14' },
  flex: { flex: 1 },
  container: { flex: 1, padding: 24, gap: 16 },
  title: { fontSize: 28, fontWeight: '700', color: '#f3f7f4' },
  body: { fontSize: 15, color: '#c7d1cb', lineHeight: 22 },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#2a3d33',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#f3f7f4',
    fontSize: 18,
    backgroundColor: '#152620',
    letterSpacing: 2,
  },
  primary: {
    marginTop: 8,
    backgroundColor: '#3b8b6a',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  primaryDisabled: { backgroundColor: '#28443a' },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
