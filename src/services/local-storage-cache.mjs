// Optional caches share SQLite with login and profile data. Reserve space for
// those critical writes. Never evict credentials, root vaults or revision pins.
export const PUBLIC_CACHE_BUDGET = 2 * 1024 * 1024;
export const PERIOD_CACHE_BUDGET = 12 * 1024 * 1024;
export const isStorageFull = error => /SQLITE_FULL|database or disk is full|code\s*13\b|quota.?exceeded/i.test(String(error?.message ?? error));
const publicKey = key => /^stromblik\.public-(history|prices)\.(v1|energinet-v1)\./.test(key);
const periodKey = key => /^stromblik\.vault\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.period\.(?:(?:hour|day|month|year)\/\d{4}(?:-\d{2}){0,2}|state\/import)$/.test(key);
const size = (key, value) => (key.length + value.length) * 2 + 256;
const policies = new WeakMap();
export function localStoragePolicy(storage, { publicBudget = PUBLIC_CACHE_BUDGET, periodBudget = PERIOD_CACHE_BUDGET } = {}) {
  let queue = Promise.resolve();
  const indexes = { public: null, period: null };
  const serial = work => { const next = queue.catch(() => {}).then(work); queue = next; return next; };
  async function index(group) {
    if (indexes[group]) return indexes[group];
    const entries = new Map();
    const keys = (await storage.getAllKeys()).filter(group === 'public' ? publicKey : periodKey);
    for (let offset = 0; offset < keys.length; offset += 20) {
      const batch = keys.slice(offset, offset + 20);
      const values = storage.multiGet ? await storage.multiGet(batch) : await Promise.all(batch.map(async key => [key, await storage.getItem(key)]));
      for (const [key, value] of values) if (value !== null) {
        let touched = 0;
        if (group === 'public') { try { touched = JSON.parse(value).fetchedAt ?? 0; } catch {} }
        entries.set(key, { size: size(key, value), touched });
      }
    }
    indexes[group] = entries; return entries;
  }
  async function clearPublic() {
    const keys = (await storage.getAllKeys()).filter(publicKey);
    // Exact allowlisted public cache keys only. Never AsyncStorage.clear().
    for (const key of keys) await storage.removeItem(key);
    indexes.public = new Map();
  }
  async function optional(key, value) {
    const group = publicKey(key) ? 'public' : periodKey(key) ? 'period' : null;
    if (!group) throw new Error('This key is not an optional cache.');
    return serial(async () => {
      try {
        const entries = await index(group), budget = group === 'public' ? publicBudget : periodBudget;
        const bytes = size(key, value);
        if (bytes > budget) return false;
        let total = [...entries.values()].reduce((sum, entry) => sum + entry.size, 0) - (entries.get(key)?.size ?? 0);
        if (group === 'public') for (const [oldKey, entry] of [...entries].sort((a, b) => a[1].touched - b[1].touched)) {
          if (total + bytes <= budget) break;
          if (oldKey === key) continue;
          await storage.removeItem(oldKey); entries.delete(oldKey); total -= entry.size;
        }
        // Keep existing encrypted cache/revision pins. At the budget, new
        // records remain in memory/cloud rather than displacing older pins.
        if (total + bytes > budget) return false;
        await storage.setItem(key, value);
        entries.set(key, { size: bytes, touched: Date.now() });
        return true;
      } catch { indexes[group] = null; return false; }
    });
  }
  const critical = {
    getItem: key => storage.getItem(key),
    removeItem: async key => { await storage.removeItem(key); },
    setItem: (key, value) => serial(async () => {
      try { await storage.setItem(key, value); }
      catch (error) {
        if (!isStorageFull(error)) throw error;
        try { await clearPublic(); } catch { /* A full physical disk may also prevent cleanup. Retry and report clearly. */ }
        try { await storage.setItem(key, value); }
        catch (retryError) {
          if (isStorageFull(retryError)) throw new Error('Telefonens lokale lager er fyldt. Frigør lidt plads på telefonen, og prøv igen. Dine gemte forbindelser er ikke nulstillet.');
          throw retryError;
        }
      }
    }),
  };
  return { optional, critical };
}
function policy(storage) { if (!policies.has(storage)) policies.set(storage, localStoragePolicy(storage)); return policies.get(storage); }
export const writeOptionalCache = (storage, key, value) => policy(storage).optional(key, value);
export const resilientStorage = storage => policy(storage).critical;
