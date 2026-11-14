import type { PrismaClient } from '@prisma/client';
import type { EnvelopeServiceInterface } from './envelope.js';

export type UserVault = {
  encryptText(plaintext: string): string;
  decryptText(value: string): string;
  encryptJson(value: unknown): string;
  decryptJson<T>(value: unknown): T;
  encryptBytes(bytes: Buffer): Buffer;
  decryptBytes(bytes: Buffer): Buffer;
};

export interface DataVaultInterface {
  /** Vault of a user. Creates the user's data key the first time. */
  forUser(userId: string): Promise<UserVault>;
  /** Vault of the user who owns the project. */
  forProject(projectId: string): Promise<UserVault>;
  /** Adds or repairs the password-wrapped copy of the data key after a successful sign-in or sign-up. */
  attachPassword(userId: string, password: string): Promise<void>;
  /** Wraps the data key with a new password after a password change, set or reset. */
  setPassword(userId: string, newPassword: string): Promise<void>;
}

const keyCacheMs = 60_000;

export function buildDataVault({ prisma, envelope }: { prisma: PrismaClient; envelope: EnvelopeServiceInterface }): DataVaultInterface {
  const cache = new Map<string, { key: Buffer; expiresAt: number }>();

  const loadKey = async (userId: string): Promise<Buffer> => {
    const cached = cache.get(userId);
    if (cached && cached.expiresAt > Date.now()) return cached.key;
    let record = await prisma.userDataKey.findUnique({ where: { userId } });
    if (!record) {
      const fresh = envelope.generateDataKey();
      try {
        record = await prisma.userDataKey.create({ data: { userId, serverWrapped: envelope.wrapWithServer(fresh) } });
      } catch {
        // Another request created the key first.
        record = await prisma.userDataKey.findUnique({ where: { userId } });
      }
    }
    if (!record) throw new Error('Could not load the data key');
    const key = envelope.unwrapWithServer(record.serverWrapped);
    cache.set(userId, { key, expiresAt: Date.now() + keyCacheMs });
    return key;
  };

  const toVault = (key: Buffer): UserVault => ({
    encryptText: (plaintext) => envelope.encryptValue(key, plaintext),
    decryptText: (value) => envelope.decryptValue(key, value),
    encryptJson: (value) => envelope.encryptValue(key, JSON.stringify(value)),
    decryptJson: <T>(value: unknown): T => {
      if (typeof value !== 'string') throw new Error('Stored value is not encrypted');
      return JSON.parse(envelope.decryptValue(key, value)) as T;
    },
    encryptBytes: (bytes) => envelope.encryptBytes(key, bytes),
    decryptBytes: (bytes) => envelope.decryptBytes(key, bytes),
  });

  return {
    async forUser(userId) {
      return toVault(await loadKey(userId));
    },
    async forProject(projectId) {
      const project = await prisma.project.findUnique({ where: { id: projectId }, select: { ownerId: true } });
      if (!project) throw new Error('Project not found');
      return toVault(await loadKey(project.ownerId));
    },
    async attachPassword(userId, password) {
      const key = await loadKey(userId);
      const record = await prisma.userDataKey.findUnique({ where: { userId } });
      if (record?.passwordWrapped) {
        try {
          if ((await envelope.unwrapWithPassword(record.passwordWrapped, password)).equals(key)) return;
        } catch {
          // The password changed through another path, so wrap the key again below.
        }
      }
      await prisma.userDataKey.update({ where: { userId }, data: { passwordWrapped: await envelope.wrapWithPassword(key, password) } });
    },
    async setPassword(userId, newPassword) {
      const key = await loadKey(userId);
      await prisma.userDataKey.update({ where: { userId }, data: { passwordWrapped: await envelope.wrapWithPassword(key, newPassword) } });
    },
  };
}
