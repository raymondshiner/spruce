import { Image } from 'expo-image';
import { Link, useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { selectProjectList, useProjects } from '@/shared/state/projects';

export default function ProjectList() {
  const router = useRouter();
  const projects = useProjects(selectProjectList);

  return (
    <View style={styles.container}>
      {projects.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No projects yet</Text>
          <Text style={styles.emptyBody}>
            Tap the + to take a photo of your yard and get a plan.
          </Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.list}
          data={projects}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push({ pathname: '/(main)/project/[id]', params: { id: item.id } })}
            >
              <Image source={{ uri: item.thumbnailUri }} style={styles.thumb} contentFit="cover" />
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {item.goal || 'Untitled plan'}
                </Text>
                <Text style={styles.cardMeta}>
                  {new Date(item.updatedAt).toLocaleDateString()} · {item.plan.items.length} items
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}

      <Link href="/(main)/capture" asChild>
        <Pressable style={styles.fab}>
          <Text style={styles.fabPlus}>＋</Text>
        </Pressable>
      </Link>

      <Link href="/(main)/settings" asChild>
        <Pressable style={styles.settings}>
          <Text style={styles.settingsText}>Settings</Text>
        </Pressable>
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1a14' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontSize: 22, fontWeight: '700', color: '#f3f7f4' },
  emptyBody: { fontSize: 15, color: '#a7b1ab', textAlign: 'center', lineHeight: 22 },
  list: { padding: 16, gap: 12 },
  card: {
    flexDirection: 'row',
    backgroundColor: '#152620',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 12,
  },
  thumb: { width: 96, height: 96 },
  cardBody: { flex: 1, padding: 12, gap: 6, justifyContent: 'center' },
  cardTitle: { color: '#f3f7f4', fontSize: 16, fontWeight: '600' },
  cardMeta: { color: '#7d8c85', fontSize: 13 },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 36,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#3b8b6a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  fabPlus: { color: '#fff', fontSize: 32, fontWeight: '300', lineHeight: 36 },
  settings: { position: 'absolute', left: 16, bottom: 36, padding: 12 },
  settingsText: { color: '#7d8c85', fontSize: 13 },
});
