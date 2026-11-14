import type { PrismaClient } from '@prisma/client';
import { createCryptoService } from '../services/crypto.js';
import { buildDataVault, type DataVaultInterface, type UserVault } from '../services/data-vault.js';
import { createEnvelopeService } from '../services/envelope.js';

const fakeUserVault: UserVault = {
  encryptText: (plaintext) => `enc:${plaintext}`,
  decryptText: (value) => value.replace(/^enc:/, ''),
  encryptJson: (value) => `enc:${JSON.stringify(value)}`,
  decryptJson: <T>(value: unknown): T => JSON.parse(String(value).replace(/^enc:/, '')) as T,
  encryptBytes: (bytes) => bytes,
  decryptBytes: (bytes) => bytes,
};

/** Readable fake for unit tests: values are prefixed with `enc:` instead of encrypted. */
export const fakeDataVault: DataVaultInterface = {
  forUser: async () => fakeUserVault,
  forProject: async () => fakeUserVault,
  attachPassword: async () => undefined,
  setPassword: async () => undefined,
};

/** Real envelope encryption on top of a real database, for integration tests. */
export const realDataVault = (prisma: PrismaClient): DataVaultInterface =>
  buildDataVault({ prisma, envelope: createEnvelopeService(createCryptoService('a'.repeat(64))) });
