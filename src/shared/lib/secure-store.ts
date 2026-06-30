import { getDB } from '@/shared/db/db';

// At-rest encryption for the OpenAI key + device HMAC secret.
// A non-extractable AES-GCM CryptoKey is generated once and stored directly in
// IndexedDB (structured clone preserves non-extractability — the raw bytes never
// surface to JS). Values are encrypted under it with a per-write random IV.
// Weaker than Android Keystore, acceptable at single-household scale.

const MASTER_KEY = 'master';

let masterPromise: Promise<CryptoKey> | null = null;

async function getMasterKey(): Promise<CryptoKey> {
  if (!masterPromise) {
    masterPromise = (async () => {
      const db = await getDB();
      const existing = await db.get('crypto', MASTER_KEY);
      if (existing) return existing;
      const key = await crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        false, // non-extractable
        ['encrypt', 'decrypt'],
      );
      await db.put('crypto', key, MASTER_KEY);
      return key;
    })();
  }
  return masterPromise;
}

export async function setItem(name: string, value: string): Promise<void> {
  const key = await getMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder().encode(value);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc);
  const db = await getDB();
  await db.put(
    'secure',
    { iv: Array.from(iv), data: Array.from(new Uint8Array(cipher)) },
    name,
  );
}

export async function getItem(name: string): Promise<string | null> {
  try {
    const db = await getDB();
    const rec = await db.get('secure', name);
    if (!rec) return null;
    const key = await getMasterKey();
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(rec.iv) },
      key,
      new Uint8Array(rec.data),
    );
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

export async function deleteItem(name: string): Promise<void> {
  const db = await getDB();
  await db.delete('secure', name);
}

// Drop-in aliases matching the expo-secure-store API the session store was built against.
export const getItemAsync = getItem;
export const setItemAsync = setItem;
export const deleteItemAsync = deleteItem;
