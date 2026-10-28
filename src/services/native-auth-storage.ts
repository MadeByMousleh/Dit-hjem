import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import {xchacha20poly1305} from '@noble/ciphers/chacha.js';
import {sha256} from '@noble/hashes/sha2.js';
import {bytesToHex, hexToBytes, utf8ToBytes} from '@noble/hashes/utils.js';
import {resilientStorage} from './local-storage-cache.mjs';
import {protectedSessionStorage} from './auth-session-storage.mjs';

const options = {keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY};
export function authSessionStorage() {
  const storage = resilientStorage(AsyncStorage);
  if (Platform.OS === 'web') return storage;
  return protectedSessionStorage({
    storage,
    secrets: {
      getItem: key => SecureStore.getItemAsync(key, options),
      setItem: (key, value) => SecureStore.setItemAsync(key, value, options),
      removeItem: key => SecureStore.deleteItemAsync(key, options),
    },
    keyId: key => 'huslyg.auth.' + bytesToHex(sha256(utf8ToBytes(key))),
    randomBytes: size => bytesToHex(Crypto.getRandomBytes(size)),
    seal: (secret, nonce, value, context) => nonce + ':' + bytesToHex(
      xchacha20poly1305(hexToBytes(secret), hexToBytes(nonce), utf8ToBytes(context)).encrypt(utf8ToBytes(value))),
    open: (secret, value, context) => {
      const [nonce, ciphertext, extra] = value.split(':');
      if (extra !== undefined || typeof nonce !== 'string' || typeof ciphertext !== 'string' || !/^[a-f0-9]{48}$/.test(nonce) || !/^(?:[a-f0-9]{2}){16,}$/.test(ciphertext)) throw Error('Den gemte login-session er beskadiget.');
      return new TextDecoder().decode(xchacha20poly1305(hexToBytes(secret), hexToBytes(nonce), utf8ToBytes(context)).decrypt(hexToBytes(ciphertext)));
    },
  });
}
