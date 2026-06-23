import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ulid } from 'ulid';

import { generatePlan, SpruceApiError } from '@/shared/api/client';
import { PlanSchema } from '@/shared/schema/plan';
import { useProjects } from '@/shared/state/projects';
import { useSession } from '@/shared/state/session';
import type { Project } from '@/shared/types/project';

async function pickImage(): Promise<ImagePicker.ImagePickerAsset | null> {
  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    base64: true,
  });
  if (res.canceled || !res.assets[0]) return null;
  return res.assets[0];
}

async function captureImage(): Promise<ImagePicker.ImagePickerAsset | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Camera permission needed', 'Enable camera access in Settings to take photos.');
    return null;
  }
  const res = await ImagePicker.launchCameraAsync({ quality: 0.8, base64: true });
  if (res.canceled || !res.assets[0]) return null;
  return res.assets[0];
}

export default function Capture() {
  const router = useRouter();
  const session = useSession();
  const saveProject = useProjects((s) => s.save);
  const [asset, setAsset] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);

  const onGenerate = async () => {
    if (!asset?.base64) {
      Alert.alert('Add a photo first');
      return;
    }
    if (!goal.trim()) {
      Alert.alert('What are you hoping to change?', 'Even one sentence helps a lot.');
      return;
    }
    if (!session.openaiApiKey) {
      Alert.alert('No API key', 'Set your OpenAI key in Settings.');
      return;
    }
    if (!session.zone) {
      Alert.alert('Set your zone first');
      return;
    }

    setBusy(true);
    try {
      const device = await session.ensureDeviceRegistered();
      const plan = await generatePlan(device, {
        mode: 'yard',
        zone: session.zone,
        goal: goal.trim(),
        photoBase64: asset.base64,
        openaiApiKey: session.openaiApiKey,
      });
      const parsed = PlanSchema.safeParse(plan);
      if (!parsed.success) {
        throw new SpruceApiError({ error: 'schema_parse_fail', message: parsed.error.message });
      }

      const id = ulid();
      const photoSha256 = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        asset.base64,
      );
      const projectDir = new Directory(Paths.document, 'projects', id);
      if (!projectDir.exists) projectDir.create({ intermediates: true });
      const photoFile = new File(projectDir, 'original.jpg');
      if (photoFile.exists) photoFile.delete();
      photoFile.create();
      photoFile.write(asset.base64, { encoding: 'base64' });
      const photoUri = photoFile.uri;

      const now = Date.now();
      const project: Project = {
        id,
        createdAt: now,
        updatedAt: now,
        mode: 'yard',
        thumbnailUri: photoUri,
        photoSha256,
        zone: session.zone,
        goal: goal.trim(),
        visionSummary: parsed.data.visionSummary,
        plan: parsed.data,
        turns: [],
      };
      await saveProject(project);
      router.replace({ pathname: '/(main)/project/[id]', params: { id } });
    } catch (e) {
      const err = e instanceof SpruceApiError ? e : null;
      Alert.alert('Couldn’t generate plan', err?.message ?? 'Unknown error. Try again?');
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
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          {asset?.uri ? (
            <Image source={{ uri: asset.uri }} style={styles.preview} />
          ) : (
            <View style={styles.previewPlaceholder}>
              <Text style={styles.placeholderText}>Add a photo of the space</Text>
            </View>
          )}

          <View style={styles.row}>
            <Pressable style={styles.secondary} onPress={async () => setAsset(await captureImage())}>
              <Text style={styles.secondaryText}>Camera</Text>
            </Pressable>
            <Pressable style={styles.secondary} onPress={async () => setAsset(await pickImage())}>
              <Text style={styles.secondaryText}>Photo library</Text>
            </Pressable>
          </View>

          <Text style={styles.label}>What do you want to change?</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. a low-maintenance native garden bed where the patchy lawn is"
            placeholderTextColor="#666"
            multiline
            value={goal}
            onChangeText={setGoal}
          />

          <Pressable
            style={[styles.primary, (!asset || !goal.trim()) && styles.primaryDisabled]}
            onPress={onGenerate}
            disabled={!asset || !goal.trim() || busy}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>Generate plan</Text>
            )}
          </Pressable>
          <Text style={styles.note}>
            This sends the photo and goal to OpenAI on your account — usually under $0.05.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f1a14' },
  flex: { flex: 1 },
  container: { padding: 20, gap: 16 },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: 14, backgroundColor: '#152620' },
  previewPlaceholder: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: 14,
    backgroundColor: '#152620',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#2a3d33',
  },
  placeholderText: { color: '#7d8c85' },
  row: { flexDirection: 'row', gap: 12 },
  secondary: {
    flex: 1,
    backgroundColor: '#152620',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a3d33',
  },
  secondaryText: { color: '#f3f7f4', fontSize: 15, fontWeight: '500' },
  label: { color: '#f3f7f4', fontSize: 16, fontWeight: '600', marginTop: 4 },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: '#2a3d33',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: '#f3f7f4',
    fontSize: 15,
    backgroundColor: '#152620',
    textAlignVertical: 'top',
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
  note: { color: '#7d8c85', fontSize: 12, textAlign: 'center', marginTop: 4 },
});
