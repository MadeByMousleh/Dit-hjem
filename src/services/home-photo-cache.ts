import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

export type HomePhoto = { direction: string; capturedAt: string; marker?: { x: number; y: number; approximate: boolean } };
export type PhotoManifest = { photos: HomePhoto[]; fetchedAt: number; renderVersion: 2 };
const directory = Platform.OS !== 'web' && FileSystem.cacheDirectory ? `${FileSystem.cacheDirectory}home-photos-v2/` : null;
const memory = new Map<string, PhotoManifest>();
const pending = new Map<string, Promise<string>>();
let queue = Promise.resolve();
const serial = <T,>(work: () => Promise<T>): Promise<T> => { const next = queue.then(work, work); queue = next.then(() => {}, () => {}); return next; };
const validKey = (key: string) => /^[a-zA-Z0-9_.-]{1,180}$/.test(key);
export function photoCacheKey(endpoint: string, x: number, y: number) {
  let hash = 0; for (const char of endpoint) hash = (Math.imul(31, hash)+char.charCodeAt(0))|0;
  return `latest-${(hash>>>0).toString(16)}-${x.toFixed(6)}-${y.toFixed(6)}`;
}
async function ensureDirectory() { if (directory) await FileSystem.makeDirectoryAsync(directory, { intermediates: true }); }
// Only this feature's own exact cache files may be evicted. Never SQLite,
// credentials, user documents, vaults, or the app's entire cache directory.
async function prune(keep: string[] = []) {
  if (!directory) return;
  const files = (await FileSystem.readDirectoryAsync(directory)).filter(name => /^[a-zA-Z0-9_.-]+\.(jpg|json)$/.test(name));
  const entries = await Promise.all(files.map(async name => { const info = await FileSystem.getInfoAsync(directory+name); return { name, size: info.exists ? info.size : 0, at: info.exists ? info.modificationTime : 0 }; }));
  let total = entries.reduce((sum, e) => sum+e.size, 0), count = entries.length;
  for (const entry of entries.sort((a,b) => a.at-b.at)) {
    if (total <= 20*1024*1024 && count <= 80) break;
    if (keep.includes(entry.name)) continue;
    await FileSystem.deleteAsync(directory+entry.name, { idempotent: true }); total -= entry.size; count--;
  }
}
export async function readPhotoManifest(key: string): Promise<PhotoManifest | null> {
  if (!validKey(key)) return null;
  const cached = memory.get(key); if (cached) return cached;
  if (!directory) return null;
  try {
    const data = JSON.parse(await FileSystem.readAsStringAsync(`${directory}${key}.json`));
    if (data.renderVersion !== 2 || !Array.isArray(data.photos) || data.photos.length > 5 || !Number.isFinite(data.fetchedAt)) return null;
    memory.set(key,data); return data;
  } catch { return null; }
}
export async function savePhotoManifest(key: string, data: PhotoManifest) {
  if (!validKey(key)) return;
  if (memory.size >= 8) memory.delete(memory.keys().next().value!);
  memory.set(key, data);
  if (!directory) return;
  await serial(async () => { try { await ensureDirectory(); await FileSystem.writeAsStringAsync(`${directory}${key}.json`,JSON.stringify(data)); await prune([`${key}.json`]); } catch { /* Optional cache must not block the gallery. */ } });
}
export function getCachedPhoto(key: string, photo: HomePhoto, remote: string): Promise<string> {
  if (!directory || !validKey(key) || !/^(south|east|north|west|nadir)$/.test(photo.direction)) return Promise.resolve(remote);
  const name = `${key}-${photo.direction}-${photo.capturedAt.replace(/[^0-9]/g,'')}.jpg`;
  const existing = pending.get(name); if (existing) return existing;
  const promise = serial(async () => {
    const uri = directory+name;
    try {
      await ensureDirectory();
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists && info.size > 0 && info.size <= 3000000) return uri;
      const task = FileSystem.createDownloadResumable(remote, uri, { headers: { Accept: 'image/jpeg' } });
      const timer = setTimeout(() => { void task.pauseAsync().catch(() => {}); }, 20000);
      let result;
      try { result = await task.downloadAsync(); } finally { clearTimeout(timer); }
      if (!result) { await FileSystem.deleteAsync(uri, { idempotent: true }); return remote; }
      const downloaded = await FileSystem.getInfoAsync(uri);
      const type = Object.entries(result.headers).find(([header]) => header.toLowerCase() === 'content-type')?.[1];
      if (result.status !== 200 || !type?.startsWith('image/jpeg') || !downloaded.exists || downloaded.size <= 0 || downloaded.size > 3000000) { await FileSystem.deleteAsync(uri, { idempotent: true }); return remote; }
      await prune([name]); return uri;
    } catch { return remote; }
  });
  pending.set(name, promise); void promise.finally(() => pending.delete(name)); return promise;
}
