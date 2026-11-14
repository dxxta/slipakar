import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { StorageInterface } from '../../domain/storage/interface.js';
import { createCryptoService } from '../../services/crypto.js';
import { buildDataVault } from '../../services/data-vault.js';
import { createEnvelopeService } from '../../services/envelope.js';
import { buildEncryptedStorage } from './encrypted-storage.js';

const projectId = '11111111-2222-3333-4444-555555555555';

const setup = () => {
  const objects = new Map<string, Buffer>();
  const raw: StorageInterface = {
    ensureBucket: async () => undefined,
    putObject: async ({ key, body }) => { objects.set(key, body); },
    getObject: async (key) => objects.get(key)!,
    deleteObject: async (key) => { objects.delete(key); },
    objectExists: async (key) => objects.has(key),
  };
  const keys = new Map<string, { userId: string; serverWrapped: string; passwordWrapped: null }>();
  const prisma = {
    userDataKey: {
      findUnique: async ({ where }: { where: { userId: string } }) => keys.get(where.userId) ?? null,
      create: async ({ data }: { data: { userId: string; serverWrapped: string } }) => { const row = { ...data, passwordWrapped: null }; keys.set(data.userId, row); return row; },
    },
    project: { findUnique: async () => ({ ownerId: 'u1' }) },
  } as unknown as PrismaClient;
  const dataVault = buildDataVault({ prisma, envelope: createEnvelopeService(createCryptoService('d'.repeat(64))) });
  return { objects, storage: buildEncryptedStorage({ storage: raw, dataVault }) };
};

describe('buildEncryptedStorage', () => {
  it('stores project files encrypted and reads them back', async () => {
    const { objects, storage } = setup();
    await storage.putObject({ key: `${projectId}/file/payslip.pdf`, body: Buffer.from('%PDF salary 9000'), contentType: 'application/pdf' });
    expect(objects.get(`${projectId}/file/payslip.pdf`)!.includes(Buffer.from('salary'))).toBe(false);
    expect((await storage.getObject(`${projectId}/file/payslip.pdf`)).toString()).toBe('%PDF salary 9000');
  });

  it('leaves avatars and other keys unchanged', async () => {
    const { objects, storage } = setup();
    await storage.putObject({ key: 'avatars/u1/a.png', body: Buffer.from('png'), contentType: 'image/png' });
    expect(objects.get('avatars/u1/a.png')!.toString()).toBe('png');
  });
});
