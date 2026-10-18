import { ed25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/ciphers/utils.js';

export const WRITE_PROTOCOL = 'stromblik-vault-write-v1';
// Conservative hosted HTTP limit; old larger snapshots remain readable.
export const MAX_WRITE_BYTES = 4 * 1024 * 1024;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const utf8 = value => new TextEncoder().encode(value);
function scope(projectUrl, householdId) {
  if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(projectUrl) || !uuid.test(householdId)) throw new Error('Invalid signing scope');
  return `${projectUrl}\n${householdId}`;
}
function seedFor(key, projectUrl, householdId) {
  if (!(key instanceof Uint8Array) || key.length !== 32) throw new Error('Invalid recovery key');
  return hkdf(sha256, key, utf8(scope(projectUrl, householdId)), utf8(`${WRITE_PROTOCOL}:ed25519`), 32);
}
export function vaultWriterPublicKey(key, projectUrl, householdId) {
  const seed = seedFor(key, projectUrl, householdId);
  try { return bytesToHex(ed25519.getPublicKey(seed)); } finally { seed.fill(0); }
}
export function writeMessage(write) {
  const { projectUrl, householdId, userId, expectedRevision, legacyDigest, publicKey, envelope } = write;
  scope(projectUrl, householdId);
  if (!uuid.test(userId) || !Number.isInteger(expectedRevision) || expectedRevision < 0 || expectedRevision >= 2147483647 || !/^[a-f0-9]{64}$/.test(publicKey)) throw new Error('Invalid write context');
  if (expectedRevision === 0 ? !/^[a-f0-9]{32}$/.test(legacyDigest) : legacyDigest !== null) throw new Error('Invalid migration digest');
  if (!envelope || Object.keys(envelope).sort().join(',') !== 'ciphertext,format,nonce' || envelope.format !== 'stromblik-xchacha20poly1305-v1' || !/^[a-f0-9]{48}$/.test(envelope.nonce) || typeof envelope.ciphertext !== 'string' || envelope.ciphertext.length < 32 || envelope.ciphertext.length > MAX_WRITE_BYTES - 2048 || envelope.ciphertext.length % 2 || !/^[a-f0-9]+$/.test(envelope.ciphertext)) throw new Error('Invalid or oversized envelope');
  // Fixed-order, newline-delimited ASCII fields with strict alphabets, not JSON
  // object serialization. Sign SHA-256 of ciphertext bytes, not plaintext.
  return utf8([WRITE_PROTOCOL, projectUrl, householdId, userId, expectedRevision, legacyDigest ?? '-', publicKey, envelope.format, envelope.nonce, bytesToHex(sha256(hexToBytes(envelope.ciphertext)))].join('\n'));
}
export function signVaultWrite(fields, key) {
  const seed = seedFor(key, fields.projectUrl, fields.householdId);
  try {
    const write = { ...fields, publicKey: bytesToHex(ed25519.getPublicKey(seed)) };
    return { ...write, signature: bytesToHex(ed25519.sign(writeMessage(write), seed)) };
  } finally { seed.fill(0); }
}
export function verifyVaultWrite(write) {
  try {
    if (!write || Object.keys(write).sort().join(',') !== 'envelope,expectedRevision,householdId,legacyDigest,projectUrl,publicKey,signature,userId' || typeof write.signature !== 'string' || !/^[a-f0-9]{128}$/.test(write.signature)) return false;
    return ed25519.verify(hexToBytes(write.signature), writeMessage(write), hexToBytes(write.publicKey), { zip215: false });
  } catch { return false; }
}

export const ELECTRICITY_RECORD_PROTOCOL = 'stromblik-electricity-records-write-v1';
export function validElectricityRecordKey(value) {
  if (typeof value !== 'string') return false;
  if (value === 'state/import') return true;
  const match = /^(hour|day|month|year)\/(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(value ?? '');
  if (!match) return false;
  const [, kind, year, month, day] = match;
  if (Number(year) < 2000 || Number(year) > 2200) return false;
  if (kind === 'hour') { const date = new Date(`${year}-${month}-${day}T12:00:00Z`); return !!day && Number.isFinite(+date) && date.toISOString().slice(0, 10) === `${year}-${month}-${day}`; }
  if (kind === 'day') return !day && !!month && Number(month) >= 1 && Number(month) <= 12;
  return !month && !day;
}
function electricityRecordMessage(write) {
  scope(write.projectUrl, write.householdId);
  if (!uuid.test(write.userId) || !/^[a-f0-9]{64}$/.test(write.publicKey) || !Array.isArray(write.records) || !write.records.length || write.records.length > 40) throw new Error('Invalid record write');
  const seen = new Set();
  const lines = [ELECTRICITY_RECORD_PROTOCOL, write.projectUrl, write.householdId, write.userId, write.publicKey];
  for (const record of [...write.records].sort((a, b) => a.recordKey < b.recordKey ? -1 : a.recordKey > b.recordKey ? 1 : 0)) {
    if (Object.keys(record).sort().join(',') !== 'envelope,expectedRevision,recordKey' || !validElectricityRecordKey(record.recordKey) || seen.has(record.recordKey) || !Number.isInteger(record.expectedRevision) || record.expectedRevision < 0 || record.expectedRevision >= 2147483647) throw new Error('Invalid record context');
    seen.add(record.recordKey);
    // Reuse the established envelope validation without changing the old protocol.
    writeMessage({ ...write, expectedRevision: Math.max(1, record.expectedRevision), legacyDigest: null, envelope: record.envelope });
    if (record.envelope.ciphertext.length > 256 * 1024) throw new Error('Oversized electricity record');
    lines.push(record.recordKey, String(record.expectedRevision), record.envelope.format, record.envelope.nonce, bytesToHex(sha256(hexToBytes(record.envelope.ciphertext))));
  }
  return utf8(lines.join('\n'));
}
export function signElectricityRecordsWrite(fields, key) {
  const seed = seedFor(key, fields.projectUrl, fields.householdId);
  try {
    const write = { ...fields, publicKey: bytesToHex(ed25519.getPublicKey(seed)) };
    return { ...write, signature: bytesToHex(ed25519.sign(electricityRecordMessage(write), seed)) };
  } finally { seed.fill(0); }
}
export function verifyElectricityRecordsWrite(write) {
  try {
    if (Object.keys(write ?? {}).sort().join(',') !== 'householdId,projectUrl,publicKey,records,signature,userId' || !/^[a-f0-9]{128}$/.test(write.signature)) return false;
    return ed25519.verify(hexToBytes(write.signature), electricityRecordMessage(write), hexToBytes(write.publicKey), { zip215: false });
  } catch { return false; }
}
