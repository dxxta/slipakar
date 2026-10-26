import { startContainer } from '../test-support/start-container.js';
import { execFileSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inTransaction } from './in-transaction.js';

describe('inTransaction', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;

  beforeAll(async () => {
    container = await startContainer(() => new PostgreSqlContainer('postgres:16').start());
    const connectionString = container.getConnectionUri();
    execFileSync('npx', ['prisma', 'migrate', 'deploy', '--config', 'apps/api/prisma.config.ts'], {
      cwd: process.cwd(), env: { ...process.env, DATABASE_URL: connectionString }, stdio: 'pipe',
    });
    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  it('commits two writes when the callback resolves', async () => {
    const count = await inTransaction(prisma, async (tx) => {
      await tx.user.create({ data: { email: 'commit-a@example.com', name: 'A' } });
      await tx.user.create({ data: { email: 'commit-b@example.com', name: 'B' } });
      return tx.user.count({ where: { email: { in: ['commit-a@example.com', 'commit-b@example.com'] } } });
    });
    expect(count).toBe(2);
    expect(await prisma.user.count({ where: { email: { in: ['commit-a@example.com', 'commit-b@example.com'] } } })).toBe(2);
  });

  it('rolls back both writes when the callback throws', async () => {
    await expect(inTransaction(prisma, async (tx) => {
      await tx.user.create({ data: { email: 'rollback-a@example.com', name: 'A' } });
      await tx.user.create({ data: { email: 'rollback-b@example.com', name: 'B' } });
      throw new Error('Stop transaction');
    })).rejects.toThrow('Stop transaction');
    expect(await prisma.user.count({ where: { email: { in: ['rollback-a@example.com', 'rollback-b@example.com'] } } })).toBe(0);
  });
});
