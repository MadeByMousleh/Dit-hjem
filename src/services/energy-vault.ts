import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_URL, getSupabase, getSupabaseProjectUrl } from './supabase';
import { MAX_WRITE_BYTES, signVaultWrite, signElectricityRecordsWrite, validElectricityRecordKey } from './vault-signing.mjs';
import { openVault, sealVault, parseRecoveryKey, recoveryKey } from './vault-crypto.mjs';
import type { ElectricityAgreement } from '../hooks/useElectricityAgreements';
import type { HeatHistory } from './private-heating';
import { materializeElectricityCache } from './electricity-cache.mjs';
import { writeOptionalCache } from './local-storage-cache.mjs';

export type VaultData = {
  heating?: HeatHistory[];
  version: 1; agreements: ElectricityAgreement[];
  meters: ElectricityMeter[];
  readings: { meter_id: string; starts_at: string; ends_at: string; kwh: number | null; resolution: string }[];
  synced_ranges?: { meter_id: string; resolution: string; from: string; to: string; fetched_at: string }[];
  electricity_cache?: { version: number; fingerprint: string; summaries: { meter_id: string; resolution: string; starts_at: string; ends_at: string; kwh: number | null; incomplete: boolean }[] };
};
export type ElectricityMeterDetails = {
  address: string | null; meterNumber: string | null; gridOperatorName: string | null; gridArea: string | null;
  balanceSupplierName: string | null; balanceSupplierStartDate: string | null; consumerStartDate: string | null;
  settlementMethod: string | null; meterReadingOccurrence: string | null; taxReduction: string | null;
};
export type ElectricityMeter = { id: string; metering_point_id: string; details?: ElectricityMeterDetails | null; details_fetched_at?: string | null };
type VaultRow = { household_id: string; revision: number; envelope: { format: string; nonce: string; ciphertext: string } };
type ElectricityPeriodRow = VaultRow & { record_key: string };
export type VaultVersion = { revision: number; saved_at: string };
export type VaultHistory = { currentRevision: number; versions: VaultVersion[]; hasMore: boolean };
const emptyData = (): VaultData => ({ version: 1, agreements: [], meters: [], readings: [] });
const validate = (value: VaultData): VaultData => {
  if (value?.version !== 1 || !Array.isArray(value.agreements) || !Array.isArray(value.meters) || !Array.isArray(value.readings)) throw new Error('Backup-format understøttes ikke.');
  return value;
};
export { parseRecoveryKey, recoveryKey };
export const generateKey = () => Crypto.getRandomBytesAsync(32);
const keyHex = (key: Uint8Array) => Array.from(key, value => value.toString(16).padStart(2, '0')).join('');
class ManagedKeyError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
export class EnergyVault {
  private key: Uint8Array | null = null;
  private revision = 0;
  private state = emptyData();
  private queue: Promise<unknown> = Promise.resolve();
  private closed = false;
  private electricityRecords = new Map<string, { row: ElectricityPeriodRow; payload: any }>();
  private absentElectricityRecords = new Map<string, number>();
  private electricityLoads = new Map<string, Promise<Record<string, any>>>();
  constructor(readonly householdId: string, readonly userId: string) {}
  get data() { if (!this.key) throw new Error('Lås dine eldata op først.'); return this.state; }
  private get keyName() { return `stromblik.vault.${this.userId}.${this.householdId}`; }
  private get cacheName() { return this.keyName + '.encrypted'; }
  private async remote(): Promise<VaultRow | null> {
    const db = await getSupabase();
    const result = await db.from('energy_vaults').select('*').eq('household_id', this.householdId).maybeSingle();
    if (result.error) throw new Error('Krypteret backup kunne ikke hentes. Kontrollér forbindelsen.');
    return result.data as VaultRow | null;
  }
  async exists() { try { return !!(await this.remote()); } catch (cause) { if (await AsyncStorage.getItem(this.cacheName)) return true; throw cause; } }
  private accept(row: VaultRow, key: Uint8Array) {
    if (this.closed) throw new Error('Lagringen er låst.');
    if (row.household_id !== this.householdId || row.revision < this.revision) throw new Error('Backup er ældre end denne enheds seneste version.');
    this.state = validate(openVault(row.envelope, key, this.householdId, row.revision));
    this.revision = row.revision;
  }
  private async cache(row: VaultRow) { try { await AsyncStorage.setItem(this.cacheName, JSON.stringify(row)); } catch { /* Cloud save remains authoritative. */ } }
  private recordCacheName(recordKey: string) { return `${this.keyName}.period.${recordKey}`; }
  cachedElectricityRecord(recordKey: string): any | undefined {
    if (!this.key || this.closed) throw new Error('Lagringen er låst.');
    return this.electricityRecords.get(recordKey)?.payload;
  }
  private acceptElectricityRecord(row: ElectricityPeriodRow) {
    if (!this.key || this.closed) throw new Error('Lagringen er låst.');
    if (row.household_id !== this.householdId || !validElectricityRecordKey(row.record_key) || !Number.isSafeInteger(row.revision) || row.revision < 1) throw new Error('Ugyldig historikpost.');
    const previous = this.electricityRecords.get(row.record_key);
    if (previous && row.revision < previous.row.revision) throw new Error('Historikposten er ældre end telefonens gemte version.');
    const wrapper = openVault(row.envelope, this.key, this.householdId, row.revision) as { recordKey: string; payload: unknown };
    // Reuse the established AEAD envelope; its encrypted wrapper additionally
    // binds each payload to its record key. The write signature binds it too.
    if (wrapper?.recordKey !== row.record_key || !wrapper.payload || typeof wrapper.payload !== 'object') throw new Error('Historikposten tilhører en anden periode.');
    this.electricityRecords.set(row.record_key, { row, payload: wrapper.payload });
    this.absentElectricityRecords.delete(row.record_key);
  }
  async loadElectricityRecords(keys: string[], fresh = false): Promise<Record<string, any>> {
    const unique = [...new Set(keys)].sort(), scope = `${fresh ? 'fresh' : 'cached'}:${unique.join(',')}`;
    const existing = this.electricityLoads.get(scope); if (existing) return existing;
    const pending = this.readElectricityRecords(unique, fresh);
    this.electricityLoads.set(scope, pending);
    try { return await pending; }
    finally { if (this.electricityLoads.get(scope) === pending) this.electricityLoads.delete(scope); }
  }
  private async readElectricityRecords(keys: string[], fresh: boolean): Promise<Record<string, any>> {
    if (!this.key || this.closed) throw new Error('Lagringen er låst.');
    const unique = [...new Set(keys)];
    if (unique.length > 40 || unique.some(key => !validElectricityRecordKey(key))) throw new Error('Ugyldige historikperioder.');
    for (const recordKey of unique) if (!this.electricityRecords.has(recordKey)) {
      try {
        const text = await AsyncStorage.getItem(this.recordCacheName(recordKey));
        if (text) { const row = JSON.parse(text); if (row.record_key === recordKey) this.acceptElectricityRecord(row); }
      } catch { /* A corrupt local item must not block cloud repair. */ }
    }
    if (!this.key || this.closed) throw new Error('Lagringen er låst.');
    const wanted = unique.filter(key => fresh || (!this.electricityRecords.has(key) && (this.absentElectricityRecords.get(key) ?? 0) < Date.now()));
    if (wanted.length) {
      const db = await getSupabase();
      const { data, error } = await db.from('electricity_period_records').select('household_id,record_key,revision,envelope').eq('household_id', this.householdId).in('record_key', wanted);
      if (error) throw new Error('Elhistorikken kunne ikke hentes. Kontroller forbindelsen og databaseopdateringen.');
      if (!this.key || this.closed) throw new Error('Lagringen er låst.');
      const found = new Set<string>();
      for (const row of data as ElectricityPeriodRow[]) {
        if (!wanted.includes(row.record_key) || found.has(row.record_key)) throw new Error('Uventet historikpost.');
        this.acceptElectricityRecord(row); found.add(row.record_key);
        await writeOptionalCache(AsyncStorage, this.recordCacheName(row.record_key), JSON.stringify(row));
      }
      for (const recordKey of wanted) if (!found.has(recordKey)) {
        if (this.electricityRecords.has(recordKey)) throw new Error('En tidligere gemt historikpost mangler på serveren.');
        this.absentElectricityRecords.set(recordKey, Date.now() + 5 * 60000);
      }
    }
    return Object.fromEntries(unique.map(key => [key, this.electricityRecords.get(key)?.payload]));
  }
  mutateElectricityRecords(keys: string[], change: (latest: Record<string, any>) => Record<string, any>): Promise<void> {
    const task = this.queue.catch(() => {}).then(async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const latest = await this.loadElectricityRecords(keys, true);
        const updates = Object.entries(change(JSON.parse(JSON.stringify(latest))));
        if (!updates.length) return;
        if (updates.some(([key]) => !keys.includes(key))) throw new Error('Uventet historikperiode.');
        const db = await getSupabase(), { data: sessionData } = await db.auth.getSession();
        if (!sessionData.session || sessionData.session.user.id !== this.userId || !this.key || this.closed) throw new Error('Log ind igen med den rigtige konto.');
        const projectUrl = await getSupabaseProjectUrl();
        const nonces = await Crypto.getRandomBytesAsync(24 * updates.length);
        if (!this.key || this.closed) throw new Error('Lagringen er låst.');
        const records = updates.map(([recordKey, payload], index) => {
          const expectedRevision = this.electricityRecords.get(recordKey)?.row.revision ?? 0;
          return { recordKey, expectedRevision, envelope: sealVault({ recordKey, payload }, this.key!, nonces.slice(index * 24, (index + 1) * 24), this.householdId, expectedRevision + 1) };
        });
        const write = signElectricityRecordsWrite({ projectUrl, householdId: this.householdId, userId: this.userId, records }, this.key);
        const body = JSON.stringify({ operation: 'electricity-records', write });
        if (body.length > MAX_WRITE_BYTES) throw new Error('Historikpakken er for stor. Intet er ændret.');
        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 30000);
        try {
          const response = await fetch(`${API_URL}/api/energy/vault`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionData.session.access_token}` }, body, signal: controller.signal });
          const result = await response.json();
          if (response.status === 409 && result.code === 'ELECTRICITY_REVISION_CONFLICT' && attempt < 2) continue;
          if (!response.ok) throw new Error(result.error ?? 'Historikken kunne ikke gemmes.');
          if (!Array.isArray(result.rows) || result.rows.length !== records.length) throw new Error('Historikgemningen kunne ikke verificeres.');
          const seen = new Set<string>();
          for (const row of result.rows as ElectricityPeriodRow[]) {
            const sent = records.find(record => record.recordKey === row.record_key);
            if (!sent || seen.has(row.record_key) || row.revision !== sent.expectedRevision + 1 || row.envelope?.format !== sent.envelope.format || row.envelope?.nonce !== sent.envelope.nonce || row.envelope?.ciphertext !== sent.envelope.ciphertext) throw new Error('Historikgemningen kunne ikke verificeres.');
            seen.add(row.record_key);
          }
          for (const row of result.rows as ElectricityPeriodRow[]) this.acceptElectricityRecord(row);
          // Cache summaries first; hour-cache quota failures never lose cloud data.
          for (const row of [...result.rows].sort((a, b) => Number(a.record_key.startsWith('hour/')) - Number(b.record_key.startsWith('hour/')))) {
            await writeOptionalCache(AsyncStorage, this.recordCacheName(row.record_key), JSON.stringify(row));
          }
          return;
        } finally { clearTimeout(timer); }
      }
    });
    this.queue = task; return task;
  }
  private async saveSigned(envelope: VaultRow['envelope'], key: Uint8Array, expectedRevision: number, legacyDigest: string | null = null): Promise<VaultRow> {
    const db = await getSupabase();
    const { data, error } = await db.auth.getSession();
    if (error || !data.session || data.session.user.id !== this.userId) throw new Error('Log ind igen med den rigtige konto.');
    const projectUrl = await getSupabaseProjectUrl();
    if (this.closed) throw new Error('Lagringen er låst.');
    if (envelope.ciphertext.length > MAX_WRITE_BYTES - 2048) throw new Error('Backup er for stor til signeret synkronisering. Intet er ændret.');
    const body = JSON.stringify(signVaultWrite({ projectUrl, householdId: this.householdId, userId: this.userId, expectedRevision, envelope, legacyDigest }, key));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API_URL}/api/energy/vault`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` }, body, signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(typeof result.error === 'string' ? result.error : 'Signeret backup kunne ikke gemmes. Synkroniser før du prøver igen.');
      const row = result.row as VaultRow;
      if (!row || row.household_id !== this.householdId || row.revision !== expectedRevision + 1 || row.envelope?.format !== envelope.format || row.envelope.nonce !== envelope.nonce || row.envelope.ciphertext !== envelope.ciphertext) throw new Error('Gemningen kunne ikke verificeres. Synkroniser før du prøver igen.');
      return row;
    } finally { clearTimeout(timeout); }
  }
  private async managedKey(operation: 'get' | 'register', key?: Uint8Array): Promise<string | null> {
    const db = await getSupabase();
    const { data, error } = await db.auth.getSession();
    if (error || !data.session || data.session.user.id !== this.userId) throw new Error('Log ind igen med den rigtige konto.');
    if (this.closed) throw new Error('Lagringen er låst.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
    const response = await fetch(`${API_URL}/api/energy/vault`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
      signal: controller.signal,
      body: JSON.stringify({ action: 'managed-key', operation, householdId: this.householdId, ...(key ? { key: keyHex(key) } : {}) }),
    });
    const result = await response.json().catch(() => { throw new Error('Forbindelsen til sikker lagring svarede ikke korrekt. Prøv igen.'); });
    if (!response.ok) throw new ManagedKeyError(typeof result.error === 'string' ? result.error : 'Automatisk sikker lagring kunne ikke gennemføres.', response.status);
    if (this.closed) throw new Error('Lagringen er låst.');
    if (operation === 'get') {
      if (result.key === null) return null;
      if (typeof result.key !== 'string' || !/^[a-f0-9]{64}$/.test(result.key)) throw new Error('Den sikre nøgle kunne ikke valideres.');
      return result.key;
    }
    if (result.registered !== true) throw new Error('Sikker lagring kunne ikke bekræftes. Prøv igen.');
    return null;
    } finally { clearTimeout(timeout); }
  }
  private async forgetLegacyRemembered() {
    try {
      if (Platform.OS === 'web') globalThis.localStorage.removeItem(this.keyName);
      else await SecureStore.deleteItemAsync(this.keyName);
    } catch { /* Migration is complete even if an obsolete device cache remains. */ }
  }
  private async unlockKey(key: Uint8Array, remember = false) {
    try {
      const previous = await AsyncStorage.getItem(this.cacheName);
      if (previous) {
        try {
          const cached = JSON.parse(previous) as VaultRow;
          validate(openVault(cached.envelope, key, this.householdId, cached.revision));
          this.revision = Math.max(this.revision, cached.revision);
        } catch { /* A damaged local cache must not prevent opening a valid cloud copy. */ }
      }
      let row: VaultRow | null;
      try { row = await this.remote(); }
      catch (cause) { const cached = await AsyncStorage.getItem(this.cacheName); if (!cached) throw cause; row = JSON.parse(cached); }
      if (!row) throw new Error('Ingen krypteret backup fundet.');
      this.accept(row, key); this.key = key;
      await this.cache(row);
      if (remember) await this.remember();
    } catch (cause) { if (this.key !== key) key.fill(0); throw cause; }
  }
  async unlock(text: string, remember = false) {
    const key = parseRecoveryKey(text);
    await this.unlockKey(key, remember);
  }
  async unlockRemembered() {
    const text = Platform.OS === 'web'
      ? globalThis.localStorage.getItem(this.keyName)
      : await SecureStore.getItemAsync(this.keyName, { requireAuthentication: true, authenticationPrompt: 'Lås dine eldata op' });
    if (!text) return false;
    await this.unlock(text); return true;
  }
  async remember() {
    if (!this.key) return;
    if (Platform.OS === 'web') {
      globalThis.localStorage.setItem(this.keyName, recoveryKey(this.key));
      return;
    }
    await SecureStore.setItemAsync(this.keyName, recoveryKey(this.key), { requireAuthentication: true, keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY, authenticationPrompt: 'Gem adgang på denne telefon' });
  }
  // Normal sign-in path. Existing users with a locally remembered old key are
  // migrated without showing it; a missing historic key remains intentionally
  // recoverable only through the one-time compatibility screen.
  async unlockAutomatically(): Promise<'ready' | 'migration-required'> {
    const managed = await this.managedKey('get');
    if (managed) {
      const key = new Uint8Array(managed.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
      if (await this.exists()) await this.unlockKey(key);
      else await this.enrollKey(key);
      return 'ready';
    }
    if (await this.exists()) {
      let remembered = false;
      try {
        remembered = await this.unlockRemembered();
      } catch { /* A stale remembered key must not silently create a replacement. */ }
      if (remembered) {
        // A server outage is retryable, not evidence that the user lost their key.
        await this.managedKey('register', this.key!);
        await this.forgetLegacyRemembered();
        return 'ready';
      }
      return 'migration-required';
    }
    const key = await generateKey();
    try {
      try { await this.managedKey('register', key); }
      catch (cause) {
        // Another device may have registered the household's first key.
        if (cause instanceof ManagedKeyError && cause.status === 409) {
          key.fill(0);
          const registered = await this.managedKey('get');
          if (!registered) throw cause;
          const sharedKey = new Uint8Array(registered.match(/.{2}/g)!.map(byte => parseInt(byte, 16)));
          await this.enrollKey(sharedKey);
          return 'ready';
        }
        throw cause;
      }
      await this.enrollKey(key);
      return 'ready';
    } catch (cause) { if (this.key !== key) key.fill(0); throw cause; }
  }
  async completeLegacyMigration(text: string) {
    const key = parseRecoveryKey(text);
    await this.unlockKey(key);
    await this.managedKey('register', this.key!);
    await this.forgetLegacyRemembered();
  }
  async enroll(text: string) {
    const key = parseRecoveryKey(text);
    return await this.enrollKey(key);
  }
  async enrollKey(key: Uint8Array) {
    try {
      if (await this.remote()) { await this.unlockKey(key); return; }
      const db = await getSupabase();
      const exported = await db.rpc('export_energy_for_encryption', { p_household: this.householdId });
      if (exported.error) throw new Error('Eksisterende data kunne ikke kopieres. Intet er slettet.');
      const payload = validate(exported.data.payload as VaultData);
      // Normalize imported timestamps to the same representation as mobile readings.
      payload.readings = payload.readings.map(row => ({ ...row, starts_at: new Date(row.starts_at).toISOString(), ends_at: new Date(row.ends_at).toISOString() }));
      const envelope = sealVault(payload, key, await Crypto.getRandomBytesAsync(24), this.householdId, 1);
      if (envelope.ciphertext.length > 64 * 1024 * 1024) throw new Error('Historikken er for stor til én backup. Intet er slettet.');
      try { await this.saveSigned(envelope, key, 0, exported.data.digest); }
      catch (cause) {
        // Another session using the same managed key can finish enrollment first.
        const concurrent = await this.remote().catch(() => null);
        if (!concurrent) throw cause;
        this.accept(concurrent, key); this.key = key;
        await this.cache(concurrent);
        return;
      }
      const verified = await this.remote();
      if (!verified) throw new Error('Backup kunne ikke verificeres. Gem din gendannelsesnøgle og prøv oplåsning.');
      this.accept(verified, key); this.key = key;
      if (JSON.stringify(this.state) !== JSON.stringify(payload)) throw new Error('Backup-kontrol fejlede. Intet er slettet.');
      await this.cache(verified);
    } catch (cause) { if (this.key !== key) key.fill(0); throw cause; }
  }
  async refresh() {
    if (!this.key) throw new Error('Lås dine eldata op først.');
    const row = await this.remote(); if (!row) throw new Error('Backup mangler.');
    this.accept(row, this.key); await this.cache(row);
  }
  async history(before?: number): Promise<VaultHistory> {
    if (this.closed) throw new Error('Lagringen er låst.');
    const head = await this.remote();
    if (!head) throw new Error('Backup mangler.');
    const db = await getSupabase();
    let query = db.from('energy_vault_versions').select('revision,saved_at').eq('household_id', this.householdId);
    if (before !== undefined) query = query.lt('revision', before);
    const result = await query.order('revision', { ascending: false }).limit(21);
    if (result.error) throw new Error('Versionshistorikken kunne ikke hentes. Kontrollér forbindelsen og at databaseopdateringen er installeret.');
    return { currentRevision: head.revision, versions: result.data.slice(0, 20), hasMore: result.data.length > 20 };
  }
  // Explicit recovery works even when the head cannot be decrypted. It never
  // lowers the server revision or copies ciphertext to a different AAD context.
  restoreVersion(text: string, revision: number, expectedRevision: number): Promise<void> {
    const task = this.queue.catch(() => {}).then(async () => {
      if (this.closed) throw new Error('Lagringen er låst.');
      if (!Number.isSafeInteger(revision) || revision < 1 || !Number.isSafeInteger(expectedRevision) || revision > expectedRevision || expectedRevision < this.revision) throw new Error('Ugyldig backupversion.');
      const key = parseRecoveryKey(text);
      try {
        const head = await this.remote();
        if (!head || head.revision !== expectedRevision) throw new Error('Backup er ændret på en anden enhed. Hent versionslisten igen, før du gendanner.');
        const db = await getSupabase();
        const version = await db.from('energy_vault_versions').select('*').eq('household_id', this.householdId).eq('revision', revision).maybeSingle();
        if (version.error || !version.data || version.data.household_id !== this.householdId || version.data.revision !== revision) throw new Error('Den valgte backupversion kunne ikke hentes.');
        const payload = validate(openVault(version.data.envelope, key, this.householdId, revision));
        const envelope = sealVault(payload, key, await Crypto.getRandomBytesAsync(24), this.householdId, expectedRevision + 1);
        if (envelope.ciphertext.length > 64 * 1024 * 1024) throw new Error('Backup er for stor. Intet er ændret.');
        if (this.closed) throw new Error('Lagringen er låst.');
        const saved = await this.saveSigned(envelope, key, expectedRevision);
        if (!saved || saved.household_id !== this.householdId || saved.revision !== expectedRevision + 1 || JSON.stringify(validate(openVault(saved.envelope, key, this.householdId, saved.revision))) !== JSON.stringify(payload)) throw new Error('Gendannelsen kunne ikke verificeres. Hent versionslisten igen; tidligere versioner er bevaret.');
        this.accept(saved, key);
        this.key?.fill(0); this.key = key;
        await this.cache(saved);
      } finally { if (this.key !== key) key.fill(0); }
    });
    this.queue = task;
    return task;
  }
  mutate(change: (latest: VaultData) => VaultData): Promise<void> {
    const task = this.queue.catch(() => {}).then(async () => {
      await this.refresh();
      const expected = this.revision;
      const next = materializeElectricityCache(validate(change(JSON.parse(JSON.stringify(this.data)))));
      const envelope = sealVault(next, this.key!, await Crypto.getRandomBytesAsync(24), this.householdId, expected + 1);
      if (envelope.ciphertext.length > 64 * 1024 * 1024) throw new Error('Backup er for stor. Ændringen blev ikke gemt.');
      if (this.closed) throw new Error('Lagringen er låst.');
      const row = await this.saveSigned(envelope, this.key!, expected);
      this.accept(row, this.key!); await this.cache(row);
    });
    this.queue = task; return task;
  }
  close() { this.closed = true; this.key?.fill(0); this.key = null; this.state = emptyData(); this.electricityRecords.clear(); this.absentElectricityRecords.clear(); this.electricityLoads.clear(); }
}
