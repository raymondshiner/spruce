import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { isOnboarded, useSession } from '@/shared/state/session';

export default function Entry() {
  const session = useSession();

  if (!session.hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!session.openaiApiKey) return <Redirect href="/onboarding/key" />;
  if (!session.zone) return <Redirect href="/onboarding/zone" />;
  if (isOnboarded(session)) return <Redirect href="/(main)" />;
  return <Redirect href="/onboarding/key" />;
}
