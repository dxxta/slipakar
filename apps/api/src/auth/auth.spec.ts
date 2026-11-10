import { vi, describe, expect, it } from 'vitest';

const { betterAuthMock } = vi.hoisted(() => ({ betterAuthMock: vi.fn() }));

vi.mock('better-auth', () => ({ betterAuth: betterAuthMock }));
vi.mock('better-auth/adapters/prisma', () => ({ prismaAdapter: vi.fn(() => ({ adapter: 'mock' })) }));

import type { PrismaClient } from '@prisma/client';
import { createAuth } from './auth.js';

describe('createAuth', () => {
  it('passes configured trusted origins to Better Auth', () => {
    createAuth({
      prisma: {} as PrismaClient,
      env: {
        googleClientId: 'client-id',
        googleClientSecret: 'client-secret',
        secret: 'auth-secret',
        baseUrl: 'https://api.example.com',
        trustedOrigins: ['https://app.example.com', 'https://admin.example.com'],
      },
    });

    expect(betterAuthMock).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: 'https://api.example.com',
      trustedOrigins: ['https://app.example.com', 'https://admin.example.com'],
      advanced: { disableOriginCheck: false },
    }));
  });

  it('claims the demo project from the system owner after an administrator session is created', async () => {
    const tx = {
      user: { findUnique: vi.fn().mockResolvedValue({ id: 'system-owner' }) },
      project: { findFirst: vi.fn().mockResolvedValue({ id: 'demo-project' }), updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ email: 'admin@example.com' }) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<void>) => callback(tx)),
    } as unknown as PrismaClient;
    createAuth({
      prisma,
      env: { googleClientId: 'id', googleClientSecret: 'secret', secret: 'auth', baseUrl: 'http://localhost', trustedOrigins: [] },
      adminEmails: ['admin@example.com'],
    });
    const config = betterAuthMock.mock.calls.at(-1)?.[0];
    await config.databaseHooks.session.create.after({ userId: 'admin-id' });
    expect(tx.project.updateMany).toHaveBeenCalledWith({ where: { id: 'demo-project', ownerId: 'system-owner' }, data: { ownerId: 'admin-id' } });
    expect(tx.auditLog.createMany).toHaveBeenCalledOnce();
  });

  it('configures changeEmail and emailVerification when authEmailSender is provided', async () => {
    const sendMail = vi.fn().mockResolvedValue({ ok: true });
    createAuth({
      prisma: {} as PrismaClient,
      env: {
        googleClientId: 'client-id',
        googleClientSecret: 'client-secret',
        secret: 'auth-secret',
        baseUrl: 'https://api.example.com',
        trustedOrigins: ['https://app.example.com'],
        appUrl: 'https://app.example.com',
      },
      authEmailSender: { sendMail },
    });

    const config = betterAuthMock.mock.calls.at(-1)?.[0];
    expect(config.user?.changeEmail?.enabled).toBe(true);
    expect(config.emailVerification?.sendVerificationEmail).toBeDefined();

    // Call sendVerificationEmail and verify it sends through authEmailSender
    await config.emailVerification.sendVerificationEmail({
      user: { email: 'new@example.com', name: 'User' },
      url: 'https://api.example.com/api/auth/verify-email?token=xyz',
      token: 'xyz',
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'new@example.com',
        subject: expect.stringContaining('Verify'),
        html: expect.stringContaining('token=xyz'),
      }),
    );
  });

  it('rejects /change-email with EMAIL_CHANGE_UNAVAILABLE when authEmailSender is not provided', async () => {
    createAuth({
      prisma: {} as PrismaClient,
      env: {
        googleClientId: 'client-id',
        googleClientSecret: 'client-secret',
        secret: 'auth-secret',
        baseUrl: 'https://api.example.com',
        trustedOrigins: ['https://app.example.com'],
      },
    });

    const config = betterAuthMock.mock.calls.at(-1)?.[0];
    const emailGuard = config.plugins?.find((p: { id: string }) => p.id === 'email-change-guard');
    expect(emailGuard).toBeDefined();

    const hook = emailGuard.hooks.before[0];
    expect(hook.matcher({ path: '/change-email' })).toBe(true);
    await expect(hook.handler({ path: '/change-email' })).rejects.toThrow();
  });
});
