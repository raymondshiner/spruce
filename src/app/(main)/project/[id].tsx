import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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

import { useChat } from '@/shared/state/chat';
import { selectProjectList, useProjects } from '@/shared/state/projects';
import { canAskFollowup, MAX_FOLLOWUP_TURNS, userTurnsUsed } from '@/shared/types/project';

export default function ProjectDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const project = useProjects((s) => (id ? s.byId[id] : undefined));
  const status = useChat((s) => (id ? s.statusByProject[id] : undefined));
  const send = useChat((s) => s.send);
  const [question, setQuestion] = useState('');

  useEffect(() => {
    if (!project && useProjects.getState().hydrated) {
      router.back();
    }
  }, [project, router]);

  if (!project || !id) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const turnsLeft = MAX_FOLLOWUP_TURNS - userTurnsUsed(project);
  const canSend = canAskFollowup(project) && question.trim().length > 0 && status?.kind !== 'sending';

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <Image source={{ uri: project.thumbnailUri }} style={styles.hero} contentFit="cover" />
          <Text style={styles.goal}>{project.goal}</Text>

          <Text style={styles.sectionLabel}>The vibe</Text>
          <Text style={styles.body}>{project.plan.vibe}</Text>

          <Text style={styles.sectionLabel}>Key changes</Text>
          {project.plan.keyChanges.map((c, i) => (
            <View key={i} style={styles.bulletRow}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.body}>{c}</Text>
            </View>
          ))}

          <Text style={styles.sectionLabel}>Items ({project.plan.items.length})</Text>
          {project.plan.items.map((item, i) => (
            <View key={`${item.name}-${i}`} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemCategory}>{item.category}</Text>
              </View>
              {item.estimatedPriceRange && (
                <Text style={styles.itemPrice}>{item.estimatedPriceRange}</Text>
              )}
              {item.notes && <Text style={styles.itemNotes}>{item.notes}</Text>}
            </View>
          ))}

          {project.turns.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>Conversation</Text>
              {project.turns.map((t, i) => (
                <View
                  key={i}
                  style={[styles.turn, t.role === 'user' ? styles.userTurn : styles.assistantTurn]}
                >
                  <Text style={styles.turnRole}>{t.role === 'user' ? 'You' : 'Spruce'}</Text>
                  <Text style={styles.turnContent}>{t.content}</Text>
                </View>
              ))}
            </>
          )}

          {status?.kind === 'error' && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{status.message ?? status.error}</Text>
            </View>
          )}
        </ScrollView>

        <View style={styles.composer}>
          {canAskFollowup(project) ? (
            <>
              <TextInput
                style={styles.input}
                placeholder={`Ask a follow-up (${turnsLeft} left)`}
                placeholderTextColor="#666"
                value={question}
                onChangeText={setQuestion}
                editable={status?.kind !== 'sending'}
                multiline
              />
              <Pressable
                style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
                disabled={!canSend}
                onPress={async () => {
                  const q = question.trim();
                  if (!q) return;
                  setQuestion('');
                  await send(id, q);
                }}
              >
                {status?.kind === 'sending' ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.sendButtonText}>Send</Text>
                )}
              </Pressable>
            </>
          ) : (
            <View style={styles.capContainer}>
              <Text style={styles.capText}>
                Conversation cap reached. Start a new project from this plan to keep iterating.
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f1a14' },
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, paddingBottom: 32, gap: 8 },
  hero: { width: '100%', aspectRatio: 4 / 3, borderRadius: 14, backgroundColor: '#152620' },
  goal: { color: '#f3f7f4', fontSize: 18, fontWeight: '600', marginTop: 8 },
  sectionLabel: {
    color: '#7bbf9c',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 12,
  },
  body: { color: '#c7d1cb', fontSize: 15, lineHeight: 22 },
  bulletRow: { flexDirection: 'row', gap: 8 },
  bullet: { color: '#7bbf9c', fontSize: 15 },
  itemCard: { backgroundColor: '#152620', borderRadius: 12, padding: 12, gap: 4, marginTop: 4 },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { color: '#f3f7f4', fontSize: 15, fontWeight: '600' },
  itemCategory: {
    color: '#7bbf9c',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  itemPrice: { color: '#a7b1ab', fontSize: 13 },
  itemNotes: { color: '#7d8c85', fontSize: 13, lineHeight: 18, marginTop: 4 },
  turn: { borderRadius: 12, padding: 12, marginTop: 8 },
  userTurn: { backgroundColor: '#1e3328' },
  assistantTurn: { backgroundColor: '#152620' },
  turnRole: { color: '#7bbf9c', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  turnContent: { color: '#f3f7f4', fontSize: 14, lineHeight: 20 },
  errorBanner: {
    marginTop: 12,
    backgroundColor: '#3a1f1f',
    borderRadius: 10,
    padding: 12,
  },
  errorText: { color: '#ffb8b8', fontSize: 13 },
  composer: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#1a2a22',
    backgroundColor: '#0f1a14',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    backgroundColor: '#152620',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#f3f7f4',
    fontSize: 15,
    maxHeight: 120,
  },
  sendButton: {
    backgroundColor: '#3b8b6a',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#28443a' },
  sendButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  capContainer: { flex: 1, paddingVertical: 12 },
  capText: { color: '#7d8c85', fontSize: 13, lineHeight: 18, textAlign: 'center' },
});
