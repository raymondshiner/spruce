// Client-side photo prep: downscale a phone photo to a sane size before it ever
// hits the network, and derive the base64 payload + a content hash.

export type PreparedPhoto = {
  dataUrl: string; // JPEG data URL — stored as the project thumbnail/hero
  base64: string; // raw base64 (no data: prefix) — sent to the Worker
  sha256: string;
};

function bytesToHex(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 1) s += bytes[i].toString(16).padStart(2, '0');
  return s;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return bytesToHex(new Uint8Array(digest));
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image'));
    };
    img.src = url;
  });
}

function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = url;
  });
}

// A small inline JPEG data URL for fast list/detail rendering, derived from any data URL.
export async function makeThumbnail(dataUrl: string, maxDim = 320, quality = 0.7): Promise<string> {
  const img = await loadImageFromUrl(dataUrl);
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const meta = dataUrl.slice(0, comma);
  const mime = meta.slice(meta.indexOf(':') + 1, meta.indexOf(';'));
  return base64ToBlob(dataUrl.slice(comma + 1), mime || 'image/jpeg');
}

export function base64ToBlob(base64: string, mime: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function preparePhoto(
  file: File,
  maxDim = 1280,
  quality = 0.82,
): Promise<PreparedPhoto> {
  const img = await loadImage(file);
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  ctx.drawImage(img, 0, 0, w, h);

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const sha256 = await sha256Hex(base64);
  return { dataUrl, base64, sha256 };
}
