import { startContainer } from '../test-support/start-container.js';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { PrismaClient } from '@prisma/client';

describe('Prisma schema', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;

  beforeAll(async () => {
    container = await startContainer(() => new PostgreSqlContainer('postgres:16').start());
    process.env.DATABASE_URL = container.getConnectionUri();
    execFileSync('npx', ['prisma', 'migrate', 'deploy', '--config', 'apps/api/prisma.config.ts'], {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'pipe',
    });
    const migrationsPath = 'apps/api/prisma/migrations';
    if (!existsSync(migrationsPath) || !readdirSync(migrationsPath).some((name) => name !== 'migration_lock.toml')) {
      throw new Error('No migration exists for the Prisma schema');
    }
    const { prisma: testPrisma } = await import('./client.js');
    prisma = testPrisma;
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  }, 120_000);

  it('creates a project with the specified defaults', async () => {
    const user = await prisma.user.create({ data: { email: 'owner@example.com', name: 'Owner' } });
    const project = await prisma.project.create({ data: { ownerId: user.id, name: 'Payroll' } });
    const found = await prisma.project.findUniqueOrThrow({ where: { id: project.id } });

    expect(found.rateLimitPerMinute).toBe(5);
    expect(found.maxUploadBytes).toBe(5_242_880);
    expect(found.maxRows).toBe(10_000);
  });

  it('rejects a duplicate user email', async () => {
    await prisma.user.create({ data: { email: 'duplicate@example.com', name: 'First' } });
    await expect(prisma.user.create({ data: { email: 'duplicate@example.com', name: 'Second' } })).rejects.toThrow();
  });

  it('rejects a duplicate recipient row in a campaign', async () => {
    const user = await prisma.user.create({ data: { email: 'campaign@example.com', name: 'Owner' } });
    const project = await prisma.project.create({ data: { ownerId: user.id, name: 'Campaign project' } });
    const smtp = await prisma.smtpConnection.create({ data: { projectId: project.id, host: 'smtp.example.com', port: 587, username: 'user', passwordEncrypted: 'ciphertext', secure: false } });
    const template = await prisma.emailTemplate.create({ data: { projectId: project.id, name: 'Email', subject: 'Hello', bodyHtml: '<p>Hello</p>' } });
    const upload = await prisma.dataUpload.create({ data: { projectId: project.id, fileName: 'rows.json', columns: ['email'], rows: [{ email: 'recipient@example.com' }], rowCount: 1 } });
    const campaign = await prisma.campaign.create({ data: { projectId: project.id, emailTemplateId: template.id, smtpConnectionId: smtp.id, uploadId: upload.id, emailColumn: 'email' } });

    await prisma.campaignRecipient.create({ data: { campaignId: campaign.id, rowIndex: 0, email: 'recipient@example.com' } });
    await expect(prisma.campaignRecipient.create({ data: { campaignId: campaign.id, rowIndex: 0, email: 'other@example.com' } })).rejects.toThrow();
  });

  it('rejects an invalid recipient status', async () => {
    await expect(prisma.$queryRawUnsafe('SELECT CAST(\'invalid\' AS "RecipientStatus")')).rejects.toThrow();
  });

  it('deletes project SMTP connections when the project is deleted', async () => {
    const user = await prisma.user.create({ data: { email: 'cascade@example.com', name: 'Owner' } });
    const project = await prisma.project.create({ data: { ownerId: user.id, name: 'Cascade project' } });
    const smtp = await prisma.smtpConnection.create({ data: { projectId: project.id, host: 'smtp.example.com', port: 587, username: 'user', passwordEncrypted: 'ciphertext', secure: false } });

    await prisma.project.delete({ where: { id: project.id } });
    expect(await prisma.smtpConnection.findUnique({ where: { id: smtp.id } })).toBeNull();
  });

  it('rejects a duplicate system configuration key', async () => {
    await prisma.systemConfig.create({ data: { key: 'docs.enabled', value: true } });
    await expect(prisma.systemConfig.create({ data: { key: 'docs.enabled', value: false } })).rejects.toThrow();
  });
});
