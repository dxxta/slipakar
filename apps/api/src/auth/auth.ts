import type { PrismaClient } from '@prisma/client';
import { APIError, betterAuth, type BetterAuthPlugin } from 'better-auth';
import { createAuthMiddleware } from 'better-auth/api';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { twoFactor } from 'better-auth/plugins';
import type { AuthEmailSenderInterface } from '../domain/auth/sender.js';
import type { LoginActivityUseCaseInterface } from '../domain/login-activity/interface.js';
import { claimSystemDemoProject } from '../internal/demo-project/claim.js';
import type { ErrorReporter } from '../domain/error-reporting/interface.js';

export type AuthDeps = {
  prisma: PrismaClient;
  env: {
    googleClientId: string;
    googleClientSecret: string;
    secret: string;
    baseUrl: string;
    trustedOrigins: string[];
    appUrl?: string;
  };
  authEmailSender?: AuthEmailSenderInterface;
  loginActivityUseCase?: LoginActivityUseCaseInterface;
  adminEmails?: string[];
  errorReporter?: ErrorReporter;
};

function buildAuth({ prisma, env, authEmailSender, loginActivityUseCase, adminEmails = [], errorReporter }: AuthDeps) {
  const plugins: BetterAuthPlugin[] = [];
  const adminEmailSet = new Set(adminEmails.map((email) => email.trim().toLowerCase()));
  const googleProfiles = new Map<string, { email: string; verified: boolean; expiresAt: number }>();

  const endpointPath = (context: unknown): string | null => {
    if (!context || typeof context !== 'object') return null;
    const endpointContext = context as { path?: unknown; request?: { url?: unknown } };
    const normalizePath = (path: string): string => {
      const withoutBasePath = path.replace(/^\/api\/auth(?=\/)/, '');
      return withoutBasePath.startsWith('/') ? withoutBasePath : `/${withoutBasePath}`;
    };
    if (typeof endpointContext.path === 'string') return normalizePath(endpointContext.path);
    if (typeof endpointContext.request?.url === 'string') {
      try { return normalizePath(new URL(endpointContext.request.url).pathname); } catch { return null; }
    }
    return null;
  };

  const isCredentialSignIn = (context: unknown): boolean => endpointPath(context) === '/sign-in/email';

  const throwEmailUnavailable = (): never => {
    throw new APIError(400, {
      message: 'Credential login email is unavailable because platform SMTP is not configured',
      code: 'EMAIL_UNAVAILABLE',
    });
  };

  const ensureEmailSender = async (): Promise<void> => {
    if (!authEmailSender) return throwEmailUnavailable();
    if (authEmailSender.isConfigured) {
      let configured = false;
      try {
        configured = await authEmailSender.isConfigured();
      } catch { configured = false; }
      if (!configured) throwEmailUnavailable();
    }
  };

  const sendAuthenticationEmail = async ({
    to,
    subject,
    heading,
    intro,
    actionLabel,
    url,
  }: {
    to: string;
    subject: string;
    heading: string;
    intro: string;
    actionLabel: string;
    url: string;
  }): Promise<void> => {
    await ensureEmailSender();
    const safeUrl = url.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
    let result: { ok: boolean };
    try {
      result = await authEmailSender!.sendMail({
        to,
        subject,
        text: `${heading}\n\n${intro}\n\n${actionLabel}: ${url}\n\nIf you did not request this, you can ignore this email.`,
        html: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;"><h2>${heading}</h2><p>${intro}</p><p style="margin: 24px 0;"><a href="${safeUrl}" style="background-color: #D4F03C; color: #151513; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">${actionLabel}</a></p><p style="color: #6b7280; font-size: 14px;">If you did not request this, you can ignore this email.</p></div>`,
      });
    } catch {
      throw new APIError(500, { message: 'Could not send the authentication email', code: 'EMAIL_SEND_FAILED' });
    }
    if (!result.ok) {
      throw new APIError(500, { message: 'Could not send the authentication email', code: 'EMAIL_SEND_FAILED' });
    }
  };

  const authCallbackFallback = (request?: Request): string => {
    const origin = request?.headers.get('origin');
    if (origin && env.trustedOrigins.includes(origin)) return `${origin.replace(/\/$/, '')}/verify-email`;
    const frontendOrigin = env.appUrl || env.trustedOrigins[0];
    return frontendOrigin ? `${frontendOrigin.replace(/\/$/, '')}/verify-email` : `${env.baseUrl}/verify-email`;
  };

  const googleProfileFor = (accountId: string) => {
    const profile = googleProfiles.get(accountId);
    if (profile && profile.expiresAt <= Date.now()) {
      googleProfiles.delete(accountId);
      return undefined;
    }
    return profile;
  };

  const assertGoogleCanLink = async (account: { accountId?: string; userId?: string }): Promise<{ email: string; verified: boolean }> => {
    if (!account.accountId || !account.userId) {
      throw new APIError(400, { message: 'Google account details are incomplete', code: 'GOOGLE_ACCOUNT_INVALID' });
    }
    const profile = googleProfileFor(account.accountId);
    if (!profile?.verified) {
      throw new APIError(403, { message: 'Google must provide a verified email address', code: 'GOOGLE_EMAIL_NOT_VERIFIED' });
    }
    const [user, emailOwner] = await Promise.all([
      prisma.user.findUnique({ where: { id: account.userId }, select: { emailVerified: true } }),
      prisma.user.findUnique({ where: { email: profile.email }, select: { id: true } }),
    ]);
    if (!user?.emailVerified) {
      throw new APIError(403, { message: 'Verify your account email before linking Google login', code: 'EMAIL_NOT_VERIFIED' });
    }
    if (emailOwner && emailOwner.id !== account.userId) {
      throw new APIError(409, { message: 'That Google email is already connected to another account', code: 'GOOGLE_EMAIL_ALREADY_IN_USE' });
    }
    return { email: profile.email, verified: profile.verified };
  };

  const syncGoogleEmail = async (account: { accountId: string; userId: string; providerId: string }, removeNewLinkOnConflict: boolean): Promise<void> => {
    const profile = googleProfileFor(account.accountId);
    if (!profile?.verified) {
      if (removeNewLinkOnConflict) await prisma.account.deleteMany({ where: { userId: account.userId, providerId: 'google', accountId: account.accountId } });
      throw new APIError(403, { message: 'Google must provide a verified email address', code: 'GOOGLE_EMAIL_NOT_VERIFIED' });
    }
    try {
      const emailOwner = await prisma.user.findUnique({ where: { email: profile.email }, select: { id: true } });
      if (emailOwner && emailOwner.id !== account.userId) {
        throw new APIError(409, { message: 'That Google email is already connected to another account', code: 'GOOGLE_EMAIL_ALREADY_IN_USE' });
      }
      await prisma.user.update({
        where: { id: account.userId },
        data: { email: profile.email, emailVerified: true, ...(adminEmailSet.has(profile.email) ? { role: 'admin' } : {}) },
      });
    } catch (error: unknown) {
      if (removeNewLinkOnConflict) await prisma.account.deleteMany({ where: { userId: account.userId, providerId: 'google', accountId: account.accountId } });
      if (error instanceof APIError) throw error;
      throw new APIError(409, { message: 'That Google email could not be connected to this account', code: 'GOOGLE_EMAIL_ALREADY_IN_USE' });
    } finally {
      googleProfiles.delete(account.accountId);
    }
  };

  const credentialEmailGuard: BetterAuthPlugin = {
    id: 'credential-email-availability',
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === '/sign-up/email' || ctx.path === '/request-password-reset' || ctx.path === '/send-verification-email',
          handler: async () => ensureEmailSender(),
        },
      ],
    },
  };
  plugins.push(credentialEmailGuard);

  plugins.push({
    id: 'email-change-guard',
    hooks: {
      before: [
        {
          matcher: (ctx: { path?: string }) => ctx.path === '/change-email',
          handler: async () => {
            if (!authEmailSender) {
              throw new APIError(400, {
                message: 'Email change unavailable: SMTP is not configured',
                code: 'EMAIL_CHANGE_UNAVAILABLE',
              });
            }
            if (authEmailSender.isConfigured) {
              const configured = await authEmailSender.isConfigured();
              if (!configured) {
                throw new APIError(400, {
                  message: 'Email change unavailable: SMTP is not configured',
                  code: 'EMAIL_CHANGE_UNAVAILABLE',
                });
              }
            }
          },
        },
      ],
    },
  });

  plugins.push(twoFactor({
    issuer: 'Slipakar',
    totpOptions: { digits: 6, period: 30 },
    backupCodeOptions: { amount: 10, storeBackupCodes: 'encrypted' },
    trustDeviceMaxAge: 30 * 24 * 60 * 60,
    accountLockout: { enabled: true, maxFailedAttempts: 5, durationSeconds: 15 * 60 },
  }) as BetterAuthPlugin);

  const finishSessionSetup = async (session: { userId?: string; ipAddress?: string | null; userAgent?: string | null }, context?: unknown): Promise<void> => {
    if (!session.userId) return;
    try {
      const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true } });
      if (user) {
        await claimSystemDemoProject({
          prisma,
          userId: session.userId,
          userEmail: user.email,
          adminEmails,
          errorReporter: errorReporter ?? { capture: (error) => console.error('Demo project claim failed', error) },
        });
      }
    } catch (error: unknown) {
      try {
        if (errorReporter) errorReporter.capture(error, { source: 'demo-project-claim' });
        else console.error('Demo project claim failed', error);
      } catch {
        // Sign-in must not fail because demo ownership could not be updated.
      }
    }
    if (loginActivityUseCase) {
      try {
        const ctx = context as { headers?: Record<string, string | string[] | undefined> & { get?: (k: string) => string | null }; request?: { headers?: { get?: (k: string) => string | null } } } | undefined;
        const forwardedFor = ctx?.headers?.get?.('x-forwarded-for') ??
          ctx?.request?.headers?.get?.('x-forwarded-for') ??
          ctx?.headers?.['x-forwarded-for'];
        await loginActivityUseCase.recordLogin({
          userId: session.userId,
          ipAddress: session.ipAddress ?? null,
          userAgent: session.userAgent ?? null,
          forwardedFor,
        });
      } catch {
        // Recording login event should not block sign-in.
      }
    }
  };

  // A trusted-device credential sign-in does not need the verify endpoint, so
  // run deferred session side effects only after Better Auth leaves its session intact.
  plugins.push({
    id: 'two-factor-session-finalizer',
    hooks: {
      after: [{
        matcher: (ctx) => ctx.path === '/sign-in/email',
        handler: createAuthMiddleware(async (ctx) => {
          const session = ctx.context.newSession as { user?: { twoFactorEnabled?: boolean }; session?: { userId?: string; ipAddress?: string | null; userAgent?: string | null } } | null;
          if (!session?.user?.twoFactorEnabled || !session.session) return;
          const userId = session.session.userId;
          if (userId) {
            const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, role: true } });
            if (user && adminEmailSet.has(user.email.trim().toLowerCase()) && user.role !== 'admin') {
              await prisma.user.update({ where: { id: userId }, data: { role: 'admin' } });
            }
          }
          await finishSessionSetup(session.session, ctx);
        }),
      }],
    },
  });

  plugins.push({
    id: 'credential-account-link-guard',
    hooks: {
      before: [
        {
          matcher: (ctx) => ctx.path === '/link-social' || ctx.path === '/unlink-account',
          handler: createAuthMiddleware(async (ctx) => {
            const session = ctx.context.session as { user?: { id?: string; emailVerified?: boolean } } | null | undefined;
            const userId = session?.user?.id;
            if (!userId) return;
            if (ctx.path === '/link-social') {
              const user = await prisma.user.findUnique({ where: { id: userId }, select: { emailVerified: true } });
              if (!user?.emailVerified) {
                throw new APIError(403, { message: 'Verify your email before connecting Google login', code: 'EMAIL_NOT_VERIFIED' });
              }
              const body = ctx.body as { provider?: unknown } | undefined;
              if (body?.provider !== 'google') {
                throw new APIError(400, { message: 'Only Google login can be connected here', code: 'UNSUPPORTED_ACCOUNT_PROVIDER' });
              }
              return;
            }
            const body = ctx.body as { accountId?: unknown } | undefined;
            if (typeof body?.accountId !== 'string') return;
            const account = await prisma.account.findFirst({
              where: { id: body.accountId, userId, providerId: 'google' },
              select: { id: true },
            });
            if (!account) return;
            const credential = await prisma.account.findFirst({
              where: { userId, providerId: 'credential' },
              select: { password: true },
            });
            if (!credential?.password) {
              throw new APIError(400, { message: 'Set and verify a credential login before disconnecting Google', code: 'CREDENTIAL_LOGIN_REQUIRED' });
            }
          }),
        },
      ],
    },
  });

  return betterAuth({
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    secret: env.secret,
    baseURL: env.baseUrl,
    trustedOrigins: env.trustedOrigins,
    advanced: { disableOriginCheck: false },
    plugins,
    rateLimit: {
      customRules: {
        '/sign-in/email': { window: 60, max: 5 },
        '/sign-up/email': { window: 600, max: 3 },
        '/request-password-reset': { window: 600, max: 3 },
        '/reset-password': { window: 600, max: 5 },
        '/two-factor/verify-totp': { window: 60, max: 5 },
        '/two-factor/verify-backup-code': { window: 60, max: 5 },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: { role: adminEmailSet.has(String(user.email).trim().toLowerCase()) ? 'admin' : user.role },
          }),
        },
      },
      session: {
        create: {
          before: async (session, context?: unknown) => {
            if (!session?.userId) return;
            const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { email: true, emailVerified: true, disabledAt: true, role: true, twoFactorEnabled: true } });
            if (user?.disabledAt) {
              throw new APIError(403, { message: 'This account is disabled', code: 'ACCOUNT_DISABLED' });
            }
            if (user && !(user.twoFactorEnabled && isCredentialSignIn(context)) && adminEmailSet.has(user.email.trim().toLowerCase()) && user.role !== 'admin') {
              await prisma.user.update({ where: { id: session.userId }, data: { role: 'admin' } });
            }
          },
          after: async (session: { userId?: string; ipAddress?: string | null; userAgent?: string | null }, context?: unknown) => {
            if (!session?.userId) return;
            const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { twoFactorEnabled: true } });
            if (user?.twoFactorEnabled && isCredentialSignIn(context)) return;
            await finishSessionSetup(session, context);
          },
        },
      },
      account: {
        create: {
          before: async (account) => {
            if (account.providerId === 'google') await assertGoogleCanLink(account);
          },
          after: async (account) => {
            if (account.providerId === 'google') await syncGoogleEmail(account, true);
          },
        },
        update: {
          before: async (account) => {
            if (account.providerId === 'google') await assertGoogleCanLink(account);
          },
          after: async (account) => {
            if (account.providerId === 'google') await syncGoogleEmail(account, false);
          },
        },
        delete: {
          before: async (account) => {
            if (account.providerId !== 'google') return;
            const credential = await prisma.account.findFirst({ where: { userId: account.userId, providerId: 'credential' }, select: { password: true } });
            if (!credential?.password) {
              throw new APIError(400, { message: 'Set a credential login before disconnecting Google', code: 'CREDENTIAL_LOGIN_REQUIRED' });
            }
          },
        },
      },
    },
    user: {
      changeEmail: {
        enabled: true,
      },
      additionalFields: {
        role: { type: 'string', defaultValue: 'user', input: false },
        disabledAt: { type: 'date', required: false, input: false },
        disabledReason: { type: 'string', required: false, input: false },
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      sendVerificationEmail: async (data, request) => {
        const verifyUrl = new URL(data.url);
        const callbackURL = verifyUrl.searchParams.get('callbackURL');
        if (!callbackURL || callbackURL === '/') {
          verifyUrl.searchParams.set('callbackURL', authCallbackFallback(request));
        }
        const requestPath = request ? new URL(request.url).pathname : '';
        const isEmailChange = requestPath.endsWith('/change-email');
        const isSignup = !isEmailChange && !data.user.emailVerified;
        await sendAuthenticationEmail({
          to: data.user.email,
          subject: isSignup ? 'Verify your email address' : 'Verify your new email address',
          heading: isSignup ? 'Verify your email address' : 'Verify your new email address',
          intro: isSignup ? 'Confirm your email address to finish creating your Slipakar account.' : 'You requested to change your email address for your Slipakar account.',
          actionLabel: isSignup ? 'Confirm email' : 'Confirm Email Change',
          url: verifyUrl.toString(),
        });
      },
    },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: true,
      autoSignIn: false,
      sendResetPassword: async (data) => {
        await sendAuthenticationEmail({
          to: data.user.email,
          subject: 'Reset your Slipakar password',
          heading: 'Choose a password for Slipakar',
          intro: 'Use the secure link below to set or reset the password for your Slipakar account.',
          actionLabel: 'Choose password',
          url: data.url,
        });
      },
    },
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: ['google'],
        allowDifferentEmails: true,
        allowUnlinkingAll: false,
        requireLocalEmailVerified: true,
      },
    },
    socialProviders: {
      google: {
        clientId: env.googleClientId,
        clientSecret: env.googleClientSecret,
        requireEmailVerification: true,
        mapProfileToUser: (profile) => {
          const now = Date.now();
          for (const [id, pending] of googleProfiles) {
            if (pending.expiresAt <= now) googleProfiles.delete(id);
          }
          if (googleProfiles.size > 500) googleProfiles.clear();
          googleProfiles.set(profile.sub, {
            email: profile.email.trim().toLowerCase(),
            verified: profile.email_verified === true,
            expiresAt: now + 5 * 60_000,
          });
          return {};
        },
      },
    },
  });
}

export function createAuth(deps: AuthDeps): ReturnType<typeof buildAuth> {
  return buildAuth(deps);
}

