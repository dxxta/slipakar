import { vi, describe, expect, it } from 'vitest';

const { betterAuthMock } = vi.hoisted(() => ({ betterAuthMock: vi.fn() }));

vi.mock('better-auth', async (importOriginal) => ({ ...(await importOriginal<typeof import('better-auth')>()), betterAuth: betterAuthMock }));
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

  it('configures encrypted TOTP with ten backup codes, trusted devices, rate limits, and five-failure lockout', () => {
    createAuth({
      prisma: {} as PrismaClient,
      env: { googleClientId: 'id', googleClientSecret: 'secret', secret: 'auth', baseUrl: 'http://localhost', trustedOrigins: [] },
    });
    const config = betterAuthMock.mock.calls.at(-1)?.[0];
    const twoFactorPlugin = config.plugins.find((plugin: { id: string }) => plugin.id === 'two-factor');
    expect(twoFactorPlugin.options).toEqual(expect.objectContaining({
      issuer: 'Slipakar',
      totpOptions: { digits: 6, period: 30 },
      backupCodeOptions: { amount: 10, storeBackupCodes: 'encrypted' },
      trustDeviceMaxAge: 30 * 24 * 60 * 60,
      accountLockout: { enabled: true, maxFailedAttempts: 5, durationSeconds: 900 },
    }));
    expect(config.rateLimit.customRules).toEqual(expect.objectContaining({
      '/two-factor/verify-totp': { window: 60, max: 5 },
      '/two-factor/verify-backup-code': { window: 60, max: 5 },
    }));
  });

  it('defers credential 2FA role promotion and session side effects until verification succeeds', async () => {
    const userUpdate = vi.fn().mockResolvedValue({ id: 'user-1' });
    const recordLogin = vi.fn().mockResolvedValue({ id: 'event-1' });
    const userFindUnique = vi.fn(async ({ select }: { select?: Record<string, boolean> }) => {
      if (select?.disabledAt) return { id: 'user-1', email: 'admin@example.com', emailVerified: true, disabledAt: null, role: 'user', twoFactorEnabled: true };
      if (select?.twoFactorEnabled) return { twoFactorEnabled: true };
      return { email: 'admin@example.com', role: 'user', twoFactorEnabled: true };
    });
    const tx = { user: { findUnique: vi.fn().mockResolvedValue(null) } };
    createAuth({
      prisma: { user: { findUnique: userFindUnique, update: userUpdate }, $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<void>) => callback(tx)) } as unknown as PrismaClient,
      env: { googleClientId: 'id', googleClientSecret: 'secret', secret: 'auth', baseUrl: 'http://localhost', trustedOrigins: [] },
      adminEmails: ['admin@example.com'],
      loginActivityUseCase: { recordLogin } as never,
    });
    const config = betterAuthMock.mock.calls.at(-1)?.[0];
    await config.databaseHooks.session.create.before({ userId: 'user-1' }, { path: '/sign-in/email' });
    await config.databaseHooks.session.create.after({ userId: 'user-1' }, { path: '/sign-in/email' });
    expect(userUpdate).not.toHaveBeenCalled();
    expect(recordLogin).not.toHaveBeenCalled();

    await config.databaseHooks.session.create.before({ userId: 'user-1' }, { path: '/two-factor/verify-totp' });
    await config.databaseHooks.session.create.after({ userId: 'user-1' }, { path: '/two-factor/verify-totp' });
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 'user-1' }, data: { role: 'admin' } });
    expect(recordLogin).toHaveBeenCalledOnce();
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

  it('keeps disabled-account rejection, admin promotion, and login activity hooks on session creation', async () => {
    const userUpdate = vi.fn().mockResolvedValue({ id: 'admin-id' });
    const userFindUnique = vi.fn(async ({ where }: { where: { id: string } }) => {
      if (where.id === 'disabled-id') return { email: 'disabled@example.com', emailVerified: true, disabledAt: new Date(), role: 'user' };
      if (where.id === 'admin-id') return { email: 'admin@example.com', emailVerified: true, disabledAt: null, role: 'user' };
      return null;
    });
    const recordLogin = vi.fn().mockResolvedValue({ id: 'login-event' });
    createAuth({
      prisma: { user: { findUnique: userFindUnique, update: userUpdate } } as unknown as PrismaClient,
      env: { googleClientId: 'id', googleClientSecret: 'secret', secret: 'auth', baseUrl: 'http://localhost', trustedOrigins: [] },
      adminEmails: ['admin@example.com'],
      loginActivityUseCase: { recordLogin } as never,
      errorReporter: { capture: vi.fn() },
    });
    const config = betterAuthMock.mock.calls.at(-1)?.[0];
    await expect(config.databaseHooks.session.create.before({ userId: 'disabled-id' })).rejects.toMatchObject({ body: expect.objectContaining({ code: 'ACCOUNT_DISABLED' }) });
    await config.databaseHooks.session.create.before({ userId: 'admin-id' });
    expect(userUpdate).toHaveBeenCalledWith({ where: { id: 'admin-id' }, data: { role: 'admin' } });
    await config.databaseHooks.session.create.after(
      { userId: 'admin-id', ipAddress: '203.0.113.8', userAgent: 'Browser' },
      { headers: { get: (name: string) => name === 'x-forwarded-for' ? '203.0.113.8' : null } },
    );
    expect(recordLogin).toHaveBeenCalledWith({ userId: 'admin-id', ipAddress: '203.0.113.8', userAgent: 'Browser', forwardedFor: '203.0.113.8' });
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
    expect(config.emailVerification?.sendOnSignUp).toBe(true);
    expect(config.emailVerification?.autoSignInAfterVerification).toBe(false);
    expect(config.emailAndPassword).toEqual(expect.objectContaining({
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      autoSignIn: false,
    }));
    expect(config.account?.accountLinking).toEqual({
      enabled: true,
      trustedProviders: ['google'],
      allowDifferentEmails: true,
      allowUnlinkingAll: false,
      requireLocalEmailVerified: true,
    });
    expect(config.rateLimit?.customRules).toEqual(expect.objectContaining({
      '/sign-in/email': { window: 60, max: 5 },
      '/sign-up/email': { window: 600, max: 3 },
      '/request-password-reset': { window: 600, max: 3 },
      '/reset-password': { window: 600, max: 5 },
    }));

    // Call sendVerificationEmail and verify it sends through authEmailSender
    await config.emailVerification.sendVerificationEmail({
      user: { email: 'new@example.com', name: 'User', emailVerified: true },
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

    await config.emailVerification.sendVerificationEmail({
      user: { email: 'signup@example.com', name: 'New User', emailVerified: false },
      url: 'https://api.example.com/api/auth/verify-email?token=signup-token&callbackURL=%2Fverify-email',
      token: 'signup-token',
    });
    expect(sendMail).toHaveBeenLastCalledWith(expect.objectContaining({
      to: 'signup@example.com',
      subject: 'Verify your email address',
      html: expect.stringContaining('Confirm email'),
    }));
  });

  it('requires an available platform mailer before credential signup or reset can write data', async () => {
    const isConfigured = vi.fn().mockResolvedValue(false);
    createAuth({
      prisma: {} as PrismaClient,
      env: {
        googleClientId: 'client-id',
        googleClientSecret: 'client-secret',
        secret: 'auth-secret',
        baseUrl: 'https://api.example.com',
        trustedOrigins: ['https://app.example.com'],
      },
      authEmailSender: { isConfigured, sendMail: vi.fn() },
    });
    const config = betterAuthMock.mock.calls.at(-1)?.[0];
    const guard = config.plugins.find((plugin: { id: string }) => plugin.id === 'credential-email-availability');
    expect(guard).toBeDefined();
    const beforeHook = guard.hooks.before[0];
    expect(beforeHook.matcher({ path: '/sign-up/email' })).toBe(true);
    expect(beforeHook.matcher({ path: '/request-password-reset' })).toBe(true);
    await expect(beforeHook.handler()).rejects.toMatchObject({ body: expect.objectContaining({ code: 'EMAIL_UNAVAILABLE' }) });
    expect(isConfigured).toHaveBeenCalledOnce();
  });

  it('requires verified Google ownership for account linking and updates the verified account email', async () => {
    const userUpdate = vi.fn().mockResolvedValue({ id: 'user-1' });
    const accountDeleteMany = vi.fn().mockResolvedValue({ count: 0 });
    let localEmailVerified = true;
    let existingEmailOwner: { id: string } | null = null;
    const userFindUnique = vi.fn(async ({ where }: { where: { id?: string; email?: string } }) =>
      where.id ? { emailVerified: localEmailVerified } : existingEmailOwner,
    );
    createAuth({
      prisma: {
        user: { findUnique: userFindUnique, update: userUpdate },
        account: { deleteMany: accountDeleteMany },
      } as unknown as PrismaClient,
      env: {
        googleClientId: 'client-id',
        googleClientSecret: 'client-secret',
        secret: 'auth-secret',
        baseUrl: 'https://api.example.com',
        trustedOrigins: ['https://app.example.com'],
      },
    });
    const config = betterAuthMock.mock.calls.at(-1)?.[0];
    config.socialProviders.google.mapProfileToUser({ sub: 'google-sub', email: 'new@example.com', email_verified: true } as never);
    const linkedAccount = { providerId: 'google', accountId: 'google-sub', userId: 'user-1' };
    await config.databaseHooks.account.create.before(linkedAccount);
    await config.databaseHooks.account.create.after(linkedAccount);
    expect(userUpdate).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { email: 'new@example.com', emailVerified: true },
    });

    config.socialProviders.google.mapProfileToUser({ sub: 'google-sub-unverified', email: 'unverified@example.com', email_verified: false } as never);
    await expect(config.databaseHooks.account.create.before({
      providerId: 'google', accountId: 'google-sub-unverified', userId: 'user-1',
    })).rejects.toMatchObject({ body: expect.objectContaining({ code: 'GOOGLE_EMAIL_NOT_VERIFIED' }) });

    localEmailVerified = false;
    config.socialProviders.google.mapProfileToUser({ sub: 'google-sub-takeover', email: 'unverified@example.com', email_verified: true } as never);
    await expect(config.databaseHooks.account.create.before({
      providerId: 'google', accountId: 'google-sub-takeover', userId: 'user-1',
    })).rejects.toMatchObject({ body: expect.objectContaining({ code: 'EMAIL_NOT_VERIFIED' }) });
    expect(userUpdate).toHaveBeenCalledOnce();

    localEmailVerified = true;
    existingEmailOwner = { id: 'another-user' };
    config.socialProviders.google.mapProfileToUser({ sub: 'google-sub-conflict', email: 'owned@example.com', email_verified: true } as never);
    await expect(config.databaseHooks.account.create.before({
      providerId: 'google', accountId: 'google-sub-conflict', userId: 'user-1',
    })).rejects.toMatchObject({ body: expect.objectContaining({ code: 'GOOGLE_EMAIL_ALREADY_IN_USE' }) });
    expect(userUpdate).toHaveBeenCalledOnce();
  });

  it('blocks unlinking Google when the user has no credential password', async () => {
    const accountFindFirst = vi.fn().mockResolvedValue(null);
    createAuth({
      prisma: { account: { findFirst: accountFindFirst } } as unknown as PrismaClient,
      env: {
        googleClientId: 'client-id',
        googleClientSecret: 'client-secret',
        secret: 'auth-secret',
        baseUrl: 'https://api.example.com',
        trustedOrigins: ['https://app.example.com'],
      },
    });
    const config = betterAuthMock.mock.calls.at(-1)?.[0];
    await expect(config.databaseHooks.account.delete.before({
      id: 'account-google', userId: 'user-1', providerId: 'google', accountId: 'google-sub',
    })).rejects.toMatchObject({ body: expect.objectContaining({ code: 'CREDENTIAL_LOGIN_REQUIRED' }) });
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
