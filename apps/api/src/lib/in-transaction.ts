import type { Prisma, PrismaClient } from '@prisma/client';

export function inTransaction<T>(prisma: PrismaClient, fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(fn);
}
