import { startContainer } from '../../../test-support/start-container.js';
import { execFileSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildAuditRepository } from './audit.js';

describe('audit repository', () => {
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

  it('writes one row per change', async () => {
    const repository = buildAuditRepository(prisma);
    const result = await repository.createAuditRepository({
      entity: 'Project', entityId: 'project-1', action: 'update', auditUserId: 'user-1',
      changes: [{ fieldName: 'name', fieldValue: 'Payroll' }, { fieldName: 'maxRows', fieldValue: 100 }],
    });
    expect(result).toEqual({ data: { count: 2 } });
    const rows = await prisma.auditLog.findMany({ where: { entity: 'Project', entityId: 'project-1' } });
    expect(rows.map((row) => row.fieldName).sort()).toEqual(['maxRows', 'name']);
  });

  it('never stores sensitive fields or values', async () => {
    const repository = buildAuditRepository(prisma);
    const changes = ['password', 'passwordEncrypted', 'SECRET', 'accessKey', 'secretKey'].map((fieldName) => ({ fieldName, fieldValue: 'sensitive-value' }));
    expect(await repository.createAuditRepository({ entity: 'SmtpConnection', entityId: 'smtp-1', action: 'update', auditUserId: 'user-1', changes })).toEqual({ data: { count: 0 } });
    const rows = await prisma.auditLog.findMany({ where: { entity: 'SmtpConnection', entityId: 'smtp-1' } });
    expect(rows).toEqual([]);
  });

  it('finds paginated project activity across project and child entities in newest-first order without sensitive fields', async () => {
    const repository = buildAuditRepository(prisma);

    const user = await prisma.user.create({ data: { email: 'activity-user@example.com', name: 'Activity User' } });
    const project = await prisma.project.create({ data: { ownerId: user.id, name: 'Main Activity Project' } });
    const smtp = await prisma.smtpConnection.create({
      data: {
        projectId: project.id,
        host: 'smtp.example.com',
        port: 587,
        username: 'user',
        passwordEncrypted: 'enc:secret',
        secure: false,
      },
    });

    await repository.createAuditRepository({
      entity: 'Project',
      entityId: project.id,
      action: 'create',
      auditUserId: user.id,
      changes: [{ fieldName: 'name', fieldValue: 'Main Activity Project' }],
    });

    await repository.createAuditRepository({
      entity: 'SmtpConnection',
      entityId: smtp.id,
      action: 'create',
      auditUserId: user.id,
      changes: [
        { fieldName: 'host', fieldValue: 'smtp.example.com' },
        { fieldName: 'password', fieldValue: 'supersecret' }, // Should be omitted by createAudit
      ],
    });

    const res = await repository.findActivityByProjectRepository({
      projectId: project.id,
      page: 1,
      limit: 10,
    });

    expect(res.metadata).toEqual({ page: 1, limit: 10, total: 2 });
    expect(res.data.length).toBe(2);
    expect(res.data[0].entity).toBe('SmtpConnection');
    expect(res.data[0].fieldName).toBe('host');
    expect(res.data[1].entity).toBe('Project');
    expect(res.data[1].fieldName).toBe('name');

    // Ensure no sensitive fields
    expect(res.data.some((d) => d.fieldName.toLowerCase() === 'password')).toBe(false);
  });
});
