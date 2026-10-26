import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ivLength = 12;
const authTagLength = 16;

export type CryptoServiceInterface = {
  encrypt(plaintext: string): string;
  decrypt(payload: string): string;
};

export function createCryptoService(keyHex: string): CryptoServiceInterface {
  if (!/^[0-9a-fA-F]{64}$/.test(keyHex)) {
    throw new Error('Encryption key must be exactly 64 hexadecimal characters');
  }
  const key = Buffer.from(keyHex, 'hex');
  return {
    encrypt(plaintext: string): string {
      const iv = randomBytes(ivLength);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64');
    },
    decrypt(payload: string): string {
      const data = Buffer.from(payload, 'base64');
      const iv = data.subarray(0, ivLength);
      const authTag = data.subarray(ivLength, ivLength + authTagLength);
      const ciphertext = data.subarray(ivLength + authTagLength);
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    },
  };
}
