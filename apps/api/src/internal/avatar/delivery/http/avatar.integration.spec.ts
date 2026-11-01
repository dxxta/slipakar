import { startContainer } from '../../../../test-support/start-container.js';
import { execFileSync } from 'node:child_process';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { errorHandler } from '../../../../middleware/error-handler.js';
import { buildAuditRepository } from '../../../audit/repository/audit.js';
import { buildAvatarRepository } from '../../repository/avatar.js';
import { buildAvatarUseCase } from '../../usecase/avatar.js';
import { createAvatarRouter } from './avatar.js';
import type { StorageInterface } from '../../../../domain/storage/interface.js';

describe('Avatar HTTP Integration', () => {
  let pgContainer: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let app: express.Express;

  const storageMap = new Map<string, { body: Buffer; contentType: string }>();
  const fakeStorage: StorageInterface = {
    ensureBucket: async () => undefined,
    putObject: async ({ key, body, contentType }) => {
      storageMap.set(key, { body, contentType });
    },
    getObject: async (key) => {
      const item = storageMap.get(key);
      if (!item) throw new Error('Object not found');
      return item.body;
    },
    deleteObject: async (key) => {
      storageMap.delete(key);
    },
    objectExists: async (key) => storageMap.has(key),
  };

  let userId: string;

  beforeAll(async () => {
    pgContainer = await startContainer(() => new PostgreSqlContainer('postgres:16').start());
    const pgConn = pgContainer.getConnectionUri();

    execFileSync('npx', ['prisma', 'migrate', 'deploy', '--config', 'apps/api/prisma.config.ts'], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL: pgConn },
      stdio: 'pipe',
    });

    prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: pgConn }) });

    const auditRepository = buildAuditRepository(prisma);
    const repository = buildAvatarRepository({ prisma, auditRepository });
    const useCase = buildAvatarUseCase({ storage: fakeStorage, repository });

    app = express();
    app.use(
      createAvatarRouter({
        guards: [
          (_req, res, next) => {
            res.locals.userId = userId;
            next();
          },
        ],
        useCase,
      }),
    );
    app.use(errorHandler);

    const user = await prisma.user.create({
      data: {
        email: 'avatar-user@example.com',
        name: 'Avatar User',
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await pgContainer?.stop();
  });

  it('rejects upload of non-image file (e.g. text)', async () => {
    const res = await request(app)
      .post('/me/avatar')
      .attach('file', Buffer.from('hello world'), 'hello.txt');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_FILE_TYPE');
  });

  it('uploads valid PNG avatar, stores it, updates user image, and GET returns stream', async () => {
    const pngBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    ]);

    const uploadRes = await request(app)
      .post('/me/avatar')
      .attach('file', pngBuffer, 'avatar.png');

    expect(uploadRes.status).toBe(200);
    expect(uploadRes.body.success).toBe(true);
    expect(uploadRes.body.data.url).toMatch(new RegExp(`^/me/avatar/${userId}\\?v=`));

    // Verify DB user image updated
    const userInDb = await prisma.user.findUnique({ where: { id: userId } });
    expect(userInDb?.image).toBe(uploadRes.body.data.url);

    // GET avatar stream
    const getRes = await request(app).get(`/me/avatar/${userId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.headers['content-type']).toBe('image/png');
    expect(getRes.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(getRes.headers['vary']).toBe('Accept');
    expect(getRes.headers['x-content-type-options']).toBe('nosniff');
    expect(getRes.headers['etag']).toBeDefined();
    expect(getRes.body).toEqual(pngBuffer);

    // Test ETag conditional request
    const etag = getRes.headers['etag'];
    const notModifiedRes = await request(app)
      .get(`/me/avatar/${userId}`)
      .set('If-None-Match', etag);
    expect(notModifiedRes.status).toBe(304);
  });

  it('DELETE /me/avatar removes avatar and resets image to null', async () => {
    const deleteRes = await request(app).delete('/me/avatar');
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.success).toBe(true);

    const userInDb = await prisma.user.findUnique({ where: { id: userId } });
    expect(userInDb?.image).toBeNull();

    const getRes = await request(app).get(`/me/avatar/${userId}`);
    expect(getRes.status).toBe(404);
  });
});
