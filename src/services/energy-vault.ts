import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { API_URL, getSupabase, getSupabaseProjectUrl } from './supabase';
import { MAX_WRITE_BYTES, signVaultWrite } from './vault-signing.mjs';
import { openVault, sealVault, parseRecoveryKey, recoveryKey } from './vault-crypto.mjs';
import type { ElectricityAgreement } from '../hooks/useElectricityAgreements';
import type { HeatHistory } from './private-heating';

export type VaultData = {
  heating?: HeatHistory[];
  version: 1; agreements: ElectricityAgreement[];
  meters: ElectricityMeter[];
  readings: { meter_id: string; starts_at: string; ends_at: string; kwh: number | null; resolution: string }[];
  synced_ranges?: { meter_id: string; resolution: string; from: string; to: string; fetched_at: string }[];
};
export type ElectricityMeterDetails = {
  address: string | null; meterNumber: string | null; gridOperatorName: string | null; gridArea: string | null;
  balanceSupplierName: string | null; balanceSupplierStartDate: string | null; consumerStartDate: string | null;
  settlementMethod: string | null; meterReadingOccurrence: string | null; taxReduction: string | null;
};
export type ElectricityMeter = { id: string; metering_point_id: string; details?: ElectricityMeterDetails | null; details_fetched_at?: string | null };
type VaultRow = { household_id: string; revision: number; envelope: { format: string; nonce: string; ciphertext: string } };
export type VaultVersion = { revision: number; saved_at: string };
export type VaultHistory = { currentRevision: number; versions: VaultVersion[]; hasMore: boolean };
const emptyData = (): VaultData => ({ version: 1, agreements: [], meters: [], readings: [] });
const validate = (value: VaultData): VaultData => {
  if (value?.version !== 1 || !Array.isArray(value.agreements) || !Array.isArray(value.meters) || !Array.isArray(value.readings)) throw new Error('Backup-format understøttes ikke.');
  return value;
};
export { parseRecoveryKey, recoveryKey };
export const generateKey = () => Crypto.getRandomBytesAsync(32);
export class EnergyVault {
  private key: Uint8Array | null = null;
  private revision = 0;
  private state = emptyData();
  private queue: Promise<unknown> = Promise.resolve();
  private closed = false;
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
  async unlock(text: string, remember = false) {
    const key = parseRecoveryKey(text);
    try {
      const previous = await AsyncStorage.getItem(this.cacheName);
      if (previous) { const cached = JSON.parse(previous) as VaultRow; validate(openVault(cached.envelope,key,this.householdId,cached.revision)); this.revision = cached.revision; }
      let row: VaultRow | null;
      try { row = await this.remote(); }
      catch (cause) { const cached = await AsyncStorage.getItem(this.cacheName); if (!cached) throw cause; row = JSON.parse(cached); }
      if (!row) throw new Error('Ingen krypteret backup fundet.');
      this.accept(row, key); this.key = key;
      await this.cache(row);
      if (remember) await this.remember();
    } catch (cause) { if (this.key !== key) key.fill(0); throw cause; }
  }
  async unlockRemembered() {
    if (Platform.OS === 'web') return false;
    const text = await SecureStore.getItemAsync(this.keyName, { requireAuthentication: true, authenticationPrompt: 'Lås dine eldata op' });
    if (!text) return false;
    await this.unlock(text); return true;
  }
  async remember() {
    if (!this.key || Platform.OS === 'web') return;
    await SecureStore.setItemAsync(this.keyName, recoveryKey(this.key), { requireAuthentication: true, keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY, authenticationPrompt: 'Gem adgang på denne telefon' });
  }
  async enroll(text: string) {
    const key = parseRecoveryKey(text);
    try {
      if (await this.remote()) throw new Error('En backup findes allerede. Brug dens gendannelsesnøgle.');
      const db = await getSupabase();
      const exported = await db.rpc('export_energy_for_encryption', { p_household: this.householdId });
      if (exported.error) throw new Error('Eksisterende data kunne ikke kopieres. Intet er slettet.');
      const payload = validate(exported.data.payload as VaultData);
      // Normalize imported timestamps to the same representation as mobile readings.
      payload.readings = payload.readings.map(row => ({ ...row, starts_at: new Date(row.starts_at).toISOString(), ends_at: new Date(row.ends_at).toISOString() }));
      const envelope = sealVault(payload, key, await Crypto.getRandomBytesAsync(24), this.householdId, 1);
      if (envelope.ciphertext.length > 64 * 1024 * 1024) throw new Error('Historikken er for stor til én backup. Intet er slettet.');
      await this.saveSigned(envelope, key, 0, exported.data.digest);
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
      const next = validate(change(JSON.parse(JSON.stringify(this.data))));
      const envelope = sealVault(next, this.key!, await Crypto.getRandomBytesAsync(24), this.householdId, expected + 1);
      if (envelope.ciphertext.length > 64 * 1024 * 1024) throw new Error('Backup er for stor. Ændringen blev ikke gemt.');
      if (this.closed) throw new Error('Lagringen er låst.');
      const row = await this.saveSigned(envelope, this.key!, expected);
      this.accept(row, this.key!); await this.cache(row);
    });
    this.queue = task; return task;
  }
  close() { this.closed = true; this.key?.fill(0); this.key = null; this.state = emptyData(); }
}
