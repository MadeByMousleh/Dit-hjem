// Session storage is separate from the energy vault and never changes its keys.
const prefix = 'huslyg-auth-session-v1:';

export function protectedSessionStorage({storage, secrets, keyId, randomBytes, seal, open}) {
  let tail = Promise.resolve();
  const serial = task => {
    const result = tail.then(task);
    tail = result.catch(() => undefined);
    return result;
  };
  const readSecret = async key => {
    const value = await secrets.getItem(keyId(key));
    if (value !== null && !/^[a-f0-9]{64}$/.test(value)) throw Error('Login-nøglen kunne ikke læses sikkert.');
    return value;
  };
  const encrypt = async (key, value) => {
    let secret = await readSecret(key);
    if (secret === null) {
      secret = randomBytes(32);
      await secrets.setItem(keyId(key), secret);
    }
    return prefix + seal(secret, randomBytes(24), value, key);
  };
  return {
    getItem: key => serial(async () => {
      const raw = await storage.getItem(key);
      if (raw === null) return null;
      if (raw.startsWith(prefix)) {
        const secret = await readSecret(key);
        if (secret === null) throw Error('Login-nøglen mangler på denne enhed. Log ind igen.');
        return open(secret, raw.slice(prefix.length), key);
      }
      // Atomic replacement: preserve legacy plaintext if secure storage or the
      // encrypted write fails. Never return the legacy value before migrating.
      const encrypted = await encrypt(key, raw);
      await storage.setItem(key, encrypted);
      return raw;
    }),
    setItem: (key, value) => serial(async () => {
      // A missing key for an existing protected value is not permission to
      // replace it. Explicit logout/removal is required before a fresh login.
      const existing = await storage.getItem(key);
      if (existing?.startsWith(prefix) && await readSecret(key) === null) {
        throw Error('Login-nøglen mangler på denne enhed. Log ind igen.');
      }
      await storage.setItem(key, await encrypt(key, value));
    }),
    removeItem: key => serial(async () => {
      await storage.removeItem(key);
      await secrets.removeItem(keyId(key));
    }),
  };
}
