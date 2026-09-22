import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { bytesToHex, hexToBytes } from '@noble/ciphers/utils.js';

export const VAULT_FORMAT = 'stromblik-xchacha20poly1305-v1';
export function recoveryKey(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== 32) throw new Error('Invalid key');
  return bytesToHex(bytes).match(/.{4}/g).join('-');
}
export function parseRecoveryKey(text) {
  const normalized = text.trim().replace(/[\s-]/g, '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) throw new Error('Indtast hele gendannelsesnøglen.');
  return hexToBytes(normalized);
}
function context(householdId, revision) {
  if (!/^[a-f0-9-]{36}$/i.test(householdId) || !Number.isSafeInteger(revision) || revision < 1) throw new Error('Invalid context');
  return new TextEncoder().encode(`${VAULT_FORMAT}:${householdId}:${revision}`);
}
// Randomness is supplied by Expo's asynchronous native CSPRNG, never Math.random.
export function sealVault(payload, key, nonce, householdId, revision) {
  if (key.length !== 32 || nonce.length !== 24) throw new Error('Invalid key or nonce');
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  try {
    return { format: VAULT_FORMAT, nonce: bytesToHex(nonce), ciphertext: bytesToHex(xchacha20poly1305(key, nonce, context(householdId, revision)).encrypt(plaintext)) };
  } finally { plaintext.fill(0); }
}
export function openVault(envelope, key, householdId, revision) {
  if (envelope?.format !== VAULT_FORMAT || !/^[a-f0-9]{48}$/.test(envelope.nonce) || typeof envelope.ciphertext !== 'string' || envelope.ciphertext.length < 32 || envelope.ciphertext.length % 2 !== 0 || envelope.ciphertext.length > 64 * 1024 * 1024 || !/^[a-f0-9]+$/.test(envelope.ciphertext)) throw new Error('Ukendt eller beskadiget krypteret backup.');
  let plaintext;
  try {
    plaintext = xchacha20poly1305(key, hexToBytes(envelope.nonce), context(householdId, revision)).decrypt(hexToBytes(envelope.ciphertext));
    return JSON.parse(new TextDecoder().decode(plaintext));
  } catch { throw new Error('Nøglen passer ikke, eller backup er beskadiget. Intet er overskrevet.'); }
  finally { plaintext?.fill(0); }
}
