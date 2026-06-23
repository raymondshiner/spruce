import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSession } from '@/shared/state/session';

export default function OnboardingKey() {
  const router = useRouter();
  const setOpenAiKey = useSession((s) => s.setOpenAiKey);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);

  const onContinue = async () => {
    const trimmed = key.trim();
    if (!trimmed.startsWith('sk-')) {
      Alert.alert('That doesn’t look right', 'OpenAI API keys start with "sk-".');
      return;
    }
    setBusy(true);
    try {
      await setOpenAiKey(trimmed);
      router.replace('/onboarding/zone');
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
          <Text style={styles.title}>Connect your OpenAI account</Text>
          <Text style={styles.body}>
            Spruce uses your own OpenAI API key — you pay OpenAI directly, and your key never leaves
            your phone except to make requests on your behalf.
          </Text>
          <Text style={styles.body}>
            Set a hard monthly limit on your OpenAI account so a surprise can’t happen.
          </Text>

          <TextInput
            style={styles.input}
            placeholder="sk-..."
            placeholderTextColor="#999"
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            value={key}
            onChangeText={setKey}
          />

          <Pressable
            style={[styles.primary, !key && styles.primaryDisabled]}
            onPress={onContinue}
            disabled={!key || busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>Continue</Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => Linking.openURL('https://platform.openai.com/api-keys')}
            style={styles.linkRow}
          >
            <Text style={styles.linkText}>How do I get a key?</Text>
          </Pressable>
          <Pressable
            onPress={() => Linking.openURL('https://platform.openai.com/account/limits')}
            style={styles.linkRow}
          >
            <Text style={styles.linkText}>Set a spending limit on OpenAI →</Text>
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
    fontSize: 16,
    backgroundColor: '#152620',
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
  linkRow: { marginTop: 4 },
  linkText: { color: '#7bbf9c', fontSize: 14 },
});
