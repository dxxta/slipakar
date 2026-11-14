import { createCipheriv, createDecipheriv, randomBytes, scrypt as scryptCallback } from 'node:crypto';
import type { CryptoServiceInterface } from './crypto.js';

const ivLength = 12;
const authTagLength = 16;
const saltLength = 16;
const keyLength = 32;
// scrypt cost: N = 2^15, r = 8, p = 1 needs about 32 MiB, so allow double for headroom.
const scryptOptions = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;
// Every stored value carries this prefix. A value without it is never treated as encrypted data.
export const encryptedValuePrefix = 'enc1:';
// Encrypted files start with these bytes.
export const encryptedFileMagic = Buffer.from('SLE1');

export type EnvelopeServiceInterface = {
  generateDataKey(): Buffer;
  wrapWithPassword(dataKey: Buffer, password: string): Promise<string>;
  unwrapWithPassword(wrapped: string, password: string): Promise<Buffer>;
  wrapWithServer(dataKey: Buffer): string;
  unwrapWithServer(wrapped: string): Buffer;
  encryptValue(dataKey: Buffer, plaintext: string): string;
  decryptValue(dataKey: Buffer, value: string): string;
  isEncryptedValue(value: string): boolean;
  encryptBytes(dataKey: Buffer, bytes: Buffer): Buffer;
  decryptBytes(dataKey: Buffer, bytes: Buffer): Buffer;
};

const deriveKey = (password: string, salt: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    scryptCallback(password.normalize('NFKC'), salt, keyLength, scryptOptions, (error, key) => (error ? reject(error) : resolve(key)));
  });

const seal = (key: Buffer, plaintext: Buffer): Buffer => {
  const iv = randomBytes(ivLength);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
};

const open = (key: Buffer, payload: Buffer): Buffer => {
  const iv = payload.subarray(0, ivLength);
  const authTag = payload.subarray(ivLength, ivLength + authTagLength);
  const ciphertext = payload.subarray(ivLength + authTagLength);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
};

/**
 * Envelope encryption: each user has one random data key. The data key encrypts the user's data and is
 * stored wrapped twice, by a key derived from the user's password and by the server key.
 */
export function createEnvelopeService(serverCrypto: CryptoServiceInterface): EnvelopeServiceInterface {
  return {
    generateDataKey: () => randomBytes(keyLength),
    async wrapWithPassword(dataKey, password) {
      const salt = randomBytes(saltLength);
      const kek = await deriveKey(password, salt);
      return Buffer.concat([salt, seal(kek, dataKey)]).toString('base64');
    },
    async unwrapWithPassword(wrapped, password) {
      const data = Buffer.from(wrapped, 'base64');
      const kek = await deriveKey(password, data.subarray(0, saltLength));
      return open(kek, data.subarray(saltLength));
    },
    wrapWithServer: (dataKey) => serverCrypto.encrypt(dataKey.toString('hex')),
    unwrapWithServer: (wrapped) => Buffer.from(serverCrypto.decrypt(wrapped), 'hex'),
    encryptValue: (dataKey, plaintext) => encryptedValuePrefix + seal(dataKey, Buffer.from(plaintext, 'utf8')).toString('base64'),
    decryptValue(dataKey, value) {
      if (!value.startsWith(encryptedValuePrefix)) throw new Error('Stored value is not encrypted');
      return open(dataKey, Buffer.from(value.slice(encryptedValuePrefix.length), 'base64')).toString('utf8');
    },
    isEncryptedValue: (value) => value.startsWith(encryptedValuePrefix),
    encryptBytes: (dataKey, bytes) => Buffer.concat([encryptedFileMagic, seal(dataKey, bytes)]),
    decryptBytes(dataKey, bytes) {
      if (!bytes.subarray(0, encryptedFileMagic.length).equals(encryptedFileMagic)) throw new Error('Stored file is not encrypted');
      return open(dataKey, bytes.subarray(encryptedFileMagic.length));
    },
  };
}
