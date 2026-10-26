import { describe, expect, it } from 'vitest';
import { createCryptoService } from './crypto.js';

const keyHex = 'a'.repeat(64);

describe('createCryptoService', () => {
  it('round trips plaintext in the iv + tag + ciphertext base64 format', () => {
    const service = createCryptoService(keyHex);
    const payload = service.encrypt('sensitive value');
    expect(service.decrypt(payload)).toBe('sensitive value');
    // 12-byte iv + 16-byte auth tag + ciphertext (same length as the utf8 plaintext for GCM)
    expect(Buffer.from(payload, 'base64').length).toBe(12 + 16 + Buffer.byteLength('sensitive value'));
  });

  it('uses a fresh IV for each encryption', () => {
    const service = createCryptoService(keyHex);
    expect(service.encrypt('same text')).not.toBe(service.encrypt('same text'));
  });

  it('rejects changed ciphertext', () => {
    const service = createCryptoService(keyHex);
    const payload = Buffer.from(service.encrypt('sensitive value'), 'base64');
    for (let index = 0; index < payload.length; index += 1) {
      const changed = Buffer.from(payload);
      changed[index] ^= 1;
      expect(() => service.decrypt(changed.toString('base64'))).toThrow();
    }
  });

  it('rejects another key', () => {
    const payload = createCryptoService(keyHex).encrypt('sensitive value');
    expect(() => createCryptoService('b'.repeat(64)).decrypt(payload)).toThrow();
  });

  it.each(['', 'a'.repeat(63), 'g'.repeat(64)])('rejects an invalid key', (key) => {
    expect(() => createCryptoService(key)).toThrow();
  });

  it.each(['', '薪資明細 🔒'])('round trips empty and Unicode text', (value) => {
    const service = createCryptoService(keyHex);
    expect(service.decrypt(service.encrypt(value))).toBe(value);
  });
});
