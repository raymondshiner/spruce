import { create } from 'zustand';

import { registerDevice } from '@/shared/api/client';
import * as SecureStore from '@/shared/lib/secure-store';

const KEYS = {
  openaiKey: 'spruce.openai_api_key',
  deviceId: 'spruce.device_id',
  deviceSecret: 'spruce.device_secret',
  zip: 'spruce.zip',
  zone: 'spruce.zone',
} as const;

type SessionState = {
  hydrated: boolean;
  openaiApiKey: string | null;
  deviceId: string | null;
  deviceSecret: string | null;
  zip: string | null;
  zone: string | null;
  hydrate: () => Promise<void>;
  setOpenAiKey: (key: string) => Promise<void>;
  clearOpenAiKey: () => Promise<void>;
  setZipAndZone: (zip: string, zone: string) => Promise<void>;
  ensureDeviceRegistered: () => Promise<{ deviceId: string; deviceSecret: string }>;
  reset: () => Promise<void>;
};

async function readSecure(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export const useSession = create<SessionState>((set, get) => ({
  hydrated: false,
  openaiApiKey: null,
  deviceId: null,
  deviceSecret: null,
  zip: null,
  zone: null,

  hydrate: async () => {
    const [openaiApiKey, deviceId, deviceSecret, zip, zone] = await Promise.all([
      readSecure(KEYS.openaiKey),
      readSecure(KEYS.deviceId),
      readSecure(KEYS.deviceSecret),
      readSecure(KEYS.zip),
      readSecure(KEYS.zone),
    ]);
    set({ hydrated: true, openaiApiKey, deviceId, deviceSecret, zip, zone });
  },

  setOpenAiKey: async (key) => {
    await SecureStore.setItemAsync(KEYS.openaiKey, key);
    set({ openaiApiKey: key });
  },

  clearOpenAiKey: async () => {
    await SecureStore.deleteItemAsync(KEYS.openaiKey);
    set({ openaiApiKey: null });
  },

  setZipAndZone: async (zip, zone) => {
    await Promise.all([
      SecureStore.setItemAsync(KEYS.zip, zip),
      SecureStore.setItemAsync(KEYS.zone, zone),
    ]);
    set({ zip, zone });
  },

  ensureDeviceRegistered: async () => {
    const { deviceId, deviceSecret } = get();
    if (deviceId && deviceSecret) return { deviceId, deviceSecret };
    const res = await registerDevice();
    await Promise.all([
      SecureStore.setItemAsync(KEYS.deviceId, res.deviceId),
      SecureStore.setItemAsync(KEYS.deviceSecret, res.deviceSecret),
    ]);
    set({ deviceId: res.deviceId, deviceSecret: res.deviceSecret });
    return res;
  },

  reset: async () => {
    await Promise.all(Object.values(KEYS).map((k) => SecureStore.deleteItemAsync(k)));
    set({
      openaiApiKey: null,
      deviceId: null,
      deviceSecret: null,
      zip: null,
      zone: null,
    });
  },
}));

export function isOnboarded(s: SessionState): boolean {
  return Boolean(s.openaiApiKey && s.zone);
}
