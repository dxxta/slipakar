import type { PrismaClient } from '@prisma/client';
import { APIError, betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import type { AuthEmailSenderInterface } from '../domain/auth/sender.js';
import type { LoginActivityUseCaseInterface } from '../domain/login-activity/interface.js';

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
};

function buildAuth({ prisma, env, authEmailSender, loginActivityUseCase }: AuthDeps) {
  const plugins = [];

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

  return betterAuth({
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    secret: env.secret,
    baseURL: env.baseUrl,
    trustedOrigins: env.trustedOrigins,
    advanced: { disableOriginCheck: false },
    plugins,
    databaseHooks: {
      session: {
        create: {
          after: async (session: { userId?: string; ipAddress?: string | null; userAgent?: string | null }, context?: unknown) => {
            if (loginActivityUseCase && session?.userId) {
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
                // Recording login event should not block sign-in
              }
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
      sendVerificationEmail: async (data) => {
        if (!authEmailSender) {
          throw new APIError(400, {
            message: 'Email change unavailable: SMTP is not configured',
            code: 'EMAIL_CHANGE_UNAVAILABLE',
          });
        }

        const verifyUrl = new URL(data.url);
        // If appUrl or trusted origin is available, rewrite callbackURL
        const frontendBase = env.appUrl || env.trustedOrigins[0];
        if (frontendBase && !verifyUrl.searchParams.has('callbackURL')) {
          verifyUrl.searchParams.set('callbackURL', `${frontendBase}/verify-email`);
        }

        const html = `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Verify your new email address</h2>
            <p>You requested to change your email address for your Slipakar account.</p>
            <p>Please click the link below to confirm this change:</p>
            <p style="margin: 24px 0;">
              <a href="${verifyUrl.toString()}" style="background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Confirm Email Change
              </a>
            </p>
            <p style="color: #6b7280; font-size: 14px;">If you did not request this change, you can safely ignore this email.</p>
          </div>
        `;

        const result = await authEmailSender.sendMail({
          to: data.user.email,
          subject: 'Verify your new email address',
          html,
        });

        if (!result.ok) {
          throw new APIError(500, {
            message: result.error,
            code: 'EMAIL_SEND_FAILED',
          });
        }
      },
    },
    socialProviders: {
      google: {
        clientId: env.googleClientId,
        clientSecret: env.googleClientSecret,
      },
    },
  });
}

export function createAuth(deps: AuthDeps): ReturnType<typeof buildAuth> {
  return buildAuth(deps);
}

