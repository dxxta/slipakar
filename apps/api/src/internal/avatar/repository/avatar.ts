import type { Prisma, PrismaClient } from '@prisma/client';
import type { AuditRepositoryInterface } from '../../../domain/audit/interface.js';

export interface AvatarRepositoryInterface {
  updateUserImage(args: {
    userId: string;
    imageUrl: string | null;
    tx?: Prisma.TransactionClient;
  }): Promise<void>;
  getUserImage(userId: string): Promise<string | null>;
}

export function buildAvatarRepository({
  prisma,
  auditRepository,
}: {
  prisma: PrismaClient;
  auditRepository: AuditRepositoryInterface;
}): AvatarRepositoryInterface {
  return {
    async updateUserImage({
      userId,
      imageUrl,
      tx,
    }: {
      userId: string;
      imageUrl: string | null;
      tx?: Prisma.TransactionClient;
    }): Promise<void> {
      const client = tx ?? prisma;
      await client.user.update({
        where: { id: userId },
        data: { image: imageUrl },
      });

      await auditRepository.createAuditRepository({
        entity: 'User',
        entityId: userId,
        action: 'update',
        changes: [{ fieldName: 'image', fieldValue: imageUrl }],
        auditUserId: userId,
        tx,
      });
    },

    async getUserImage(userId: string): Promise<string | null> {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { image: true },
      });
      return user?.image ?? null;
    },
  };
}
