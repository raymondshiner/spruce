import zonesJson from '@/shared/data/usda-zones.json';

const { _meta: _ignored, ...zoneEntries } = zonesJson as Record<string, unknown>;
const zones = zoneEntries as Record<string, string>;

export function zipToZone(zip: string): string | null {
  const normalized = zip.trim().slice(0, 5);
  if (!/^\d{5}$/.test(normalized)) return null;
  const zone = zones[normalized];
  return zone ?? null;
}

export function isValidUsZip(zip: string): boolean {
  return /^\d{5}$/.test(zip.trim());
}
