import { describe, expect, it } from 'vitest';
import { createCryptoService } from './crypto.js';
import { createEnvelopeService } from './envelope.js';

const envelope = createEnvelopeService(createCryptoService('b'.repeat(64)));

describe('createEnvelopeService', () => {
  it('round trips a value with the data key and marks it encrypted', () => {
    const key = envelope.generateDataKey();
    const stored = envelope.encryptValue(key, 'Ada,ada@example.com');
    expect(envelope.isEncryptedValue(stored)).toBe(true);
    expect(stored).not.toContain('Ada');
    expect(envelope.decryptValue(key, stored)).toBe('Ada,ada@example.com');
  });

  it('refuses values and files that are not encrypted', () => {
    const key = envelope.generateDataKey();
    expect(() => envelope.decryptValue(key, 'plain text')).toThrow();
    expect(() => envelope.decryptBytes(key, Buffer.from('plain bytes'))).toThrow();
  });

  it('round trips file bytes', () => {
    const key = envelope.generateDataKey();
    const stored = envelope.encryptBytes(key, Buffer.from('%PDF-1.7 payslip'));
    expect(stored.includes(Buffer.from('payslip'))).toBe(false);
    expect(envelope.decryptBytes(key, stored).toString()).toBe('%PDF-1.7 payslip');
  });

  it('unwraps the data key with the right password only', async () => {
    const key = envelope.generateDataKey();
    const wrapped = await envelope.wrapWithPassword(key, 'correct horse battery');
    expect((await envelope.unwrapWithPassword(wrapped, 'correct horse battery')).equals(key)).toBe(true);
    await expect(envelope.unwrapWithPassword(wrapped, 'wrong password here')).rejects.toThrow();
  });

  it('wraps the data key with the server key', () => {
    const key = envelope.generateDataKey();
    expect(envelope.unwrapWithServer(envelope.wrapWithServer(key)).equals(key)).toBe(true);
  });

  it('rejects tampered ciphertext', () => {
    const key = envelope.generateDataKey();
    const stored = envelope.encryptValue(key, 'secret');
    const tampered = stored.slice(0, -2) + (stored.endsWith('AA') ? 'BB' : 'AA');
    expect(() => envelope.decryptValue(key, tampered)).toThrow();
  });
});
