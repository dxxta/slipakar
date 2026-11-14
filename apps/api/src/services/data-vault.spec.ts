import { describe, expect, it } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { createCryptoService } from './crypto.js';
import { buildDataVault } from './data-vault.js';
import { createEnvelopeService } from './envelope.js';

type Row = { userId: string; serverWrapped: string; passwordWrapped: string | null };

const setup = () => {
  const rows = new Map<string, Row>();
  const prisma = {
    userDataKey: {
      findUnique: async ({ where }: { where: { userId: string } }) => rows.get(where.userId) ?? null,
      create: async ({ data }: { data: { userId: string; serverWrapped: string } }) => {
        const row = { ...data, passwordWrapped: null };
        rows.set(data.userId, row);
        return row;
      },
      update: async ({ where, data }: { where: { userId: string }; data: Partial<Row> }) => {
        const row = { ...rows.get(where.userId)!, ...data };
        rows.set(where.userId, row);
        return row;
      },
    },
    project: { findUnique: async ({ where }: { where: { id: string } }) => (where.id === 'p1' ? { ownerId: 'u1' } : null) },
  } as unknown as PrismaClient;
  const envelope = createEnvelopeService(createCryptoService('c'.repeat(64)));
  return { rows, vault: buildDataVault({ prisma, envelope }), envelope };
};

describe('buildDataVault', () => {
  it('creates one key per user and round trips JSON', async () => {
    const { vault, rows } = setup();
    const user = await vault.forUser('u1');
    const stored = user.encryptJson([{ name: 'Ada', salary: '9000' }]);
    expect(stored).not.toContain('Ada');
    expect(user.decryptJson<{ name: string }[]>(stored)[0]?.name).toBe('Ada');
    expect(rows.size).toBe(1);
  });

  it('uses the project owner key for a project', async () => {
    const { vault } = setup();
    const stored = (await vault.forUser('u1')).encryptText('secret');
    expect((await vault.forProject('p1')).decryptText(stored)).toBe('secret');
  });

  it('keeps data readable when the password changes or is reset', async () => {
    const { vault, rows, envelope } = setup();
    const stored = (await vault.forUser('u1')).encryptText('secret');
    await vault.attachPassword('u1', 'first password 123');
    const first = rows.get('u1')!.passwordWrapped!;
    await vault.setPassword('u1', 'second password 456');
    const second = rows.get('u1')!.passwordWrapped!;
    expect(second).not.toBe(first);
    const key = await envelope.unwrapWithPassword(second, 'second password 456');
    expect(envelope.decryptValue(key, stored)).toBe('secret');
    expect((await vault.forUser('u1')).decryptText(stored)).toBe('secret');
  });

  it('repairs the password copy when the password changed elsewhere', async () => {
    const { vault, rows } = setup();
    await vault.attachPassword('u1', 'old password 123456');
    await vault.attachPassword('u1', 'new password 123456');
    const wrapped = rows.get('u1')!.passwordWrapped!;
    expect(wrapped).toBeTruthy();
  });
});
