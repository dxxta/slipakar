import type { PrismaClient } from '@prisma/client';
import type { Express, Request, RequestHandler, Response } from 'express';
import { Redis } from 'ioredis';
import { fromNodeHeaders } from 'better-auth/node';
import { Client as MinioClient } from 'minio';
import { Router } from 'express';
import { createApp } from './app.js';
import { createAuth } from './auth/auth.js';
import { createAuthRouter } from './auth/auth.router.js';
import { createRequireAuth } from './auth/require-auth.js';
import type { Env } from './config/env.js';
import type { RedisPubSubClient } from './domain/system-config/interface.js';
import type { ErrorLogSink, ErrorReporter } from './domain/error-reporting/interface.js';
import { buildErrorLogSink } from './internal/error-reporting/sink.js';
import { buildErrorReporter } from './internal/error-reporting/reporter.js';
import type { QueueInterface } from './domain/queue/interface.js';
import type { StorageInterface } from './domain/storage/interface.js';
import type { AuthEmailSenderInterface } from './domain/auth/sender.js';
import type { AuthEmailSenderConfig } from './internal/auth/auth-email-sender.js';
import { DynamicAuthEmailSender } from './internal/auth/dynamic-auth-email-sender.js';
import { createCampaignsRouter } from './internal/campaigns/delivery/http/campaigns.js';
import { buildCampaignsRepository } from './internal/campaigns/repository/campaigns.js';
import { buildCampaignsUseCase } from './internal/campaigns/usecase/campaigns.js';
import { createNotificationsRouter } from './internal/notifications/delivery/http/notifications.js';
import { buildNotificationsRepository } from './internal/notifications/repository/notifications.js';
import { buildNotificationsUseCase } from './internal/notifications/usecase/notifications.js';
import { buildQueue } from './internal/queue/queue.js';
import type { MetricsInterface } from './domain/metrics/interface.js';
import { requestMetrics } from './internal/metrics/http-middleware.js';
import { createMetricsRouter } from './internal/metrics/delivery/http/metrics.js';
import { buildMetrics } from './internal/metrics/metrics.js';
import { createPreferencesRouter } from './internal/preferences/delivery/http/preferences.js';
import { PreferencesRepository } from './internal/preferences/repository/preferences.js';
import { PreferencesUseCase } from './internal/preferences/usecase/preferences.js';
import { createLoginActivityRouter } from './internal/login-activity/delivery/http/login-activity.js';
import { LoginActivityRepository } from './internal/login-activity/repository/login-activity.js';
import { LoginContextStateRepository } from './internal/login-activity/repository/login-context-state.js';
import { LoginActivityUseCase } from './internal/login-activity/usecase/login-activity.js';
import { createBroadcastsRouter } from './internal/broadcasts/delivery/http/broadcasts.js';
import { BroadcastRepository } from './internal/broadcasts/repository/broadcasts.js';
import { BroadcastUseCase } from './internal/broadcasts/usecase/broadcasts.js';
import { createUserNoticesRouter } from './internal/user-notices/delivery/http/user-notices.js';
import { UserNoticesRepository } from './internal/user-notices/repository/user-notices.js';
import { UserNoticesUseCase } from './internal/user-notices/usecase/user-notices.js';
import { buildIntegrationOpenApiDocument, buildOpenApiDocument } from './internal/openapi/document.js';
import { createOpenApiRouter } from './internal/openapi/delivery/http/openapi.js';
import { allRouteDocs } from './internal/openapi/routes/index.js';
import { buildRateLimiter } from './internal/sending/rate-limiter.js';
import { buildSendWorker } from './internal/sending/worker.js';
import { buildPdfRenderer } from './internal/pdf/renderer.js';
import { createPdfTemplatesRouter } from './internal/pdf-templates/delivery/http/pdf-templates.js';
import { extractPdfPlaceholders } from './internal/pdf-templates/placeholders.js';
import { buildPdfTemplatesRepository } from './internal/pdf-templates/repository/pdf-templates.js';
import { buildPdfTemplatesUseCase } from './internal/pdf-templates/usecase/pdf-templates.js';
import { buildAttachmentStore } from './internal/attachments/attachment-store.js';
import { requireFeature } from './internal/system-config/middleware/require-feature.js';
import type { FeatureFlagsInterface } from './domain/system-config/interface.js';
import { createAttachmentsRouter } from './internal/attachments/delivery/http/attachments.js';
import { buildAttachmentsRepository } from './internal/attachments/repository/attachments.js';
import { buildAttachmentsUseCase } from './internal/attachments/usecase/attachments.js';
import { buildStorage } from './internal/storage/storage.js';
import { createSystemConfigRouter } from './internal/system-config/delivery/http/system-config.js';
import { requireAdmin } from './internal/system-config/middleware/require-admin.js';
import { buildSystemConfigRepository } from './internal/system-config/repository/system-config.js';
import { buildFeatureFlags } from './internal/system-config/service/feature-flags.js';
import { buildSystemConfigUseCase } from './internal/system-config/usecase/system-config.js';
import { buildAuditRepository } from './internal/audit/repository/audit.js';
import { buildAuditUseCase } from './internal/audit/usecase/audit.js';
import { createAuditRouter } from './internal/audit/delivery/http/audit.js';
import { createMappingRouter } from './internal/mapping/delivery/http/mapping.js';
import { buildMappingRepository } from './internal/mapping/repository/mapping.js';
import { buildMappingUseCase } from './internal/mapping/usecase/mapping.js';
import { buildDemoProjectUseCase } from './internal/demo-project/usecase/demo-project.js';
import { seedSystemDemoProject } from './internal/demo-project/startup-seed.js';
import { createDemoProjectRouter } from './internal/demo-project/delivery/http/demo-project.js';
import { buildAvatarRepository } from './internal/avatar/repository/avatar.js';
import { buildAvatarUseCase } from './internal/avatar/usecase/avatar.js';
import { createAvatarRouter } from './internal/avatar/delivery/http/avatar.js';
import { buildAdminUsersRepository } from './internal/admin-users/repository/admin-users.js';
import { buildAdminUsersUseCase } from './internal/admin-users/usecase/admin-users.js';
import { createAdminUsersRouter } from './internal/admin-users/delivery/http/admin-users.js';
import { AdminSetupRepository } from './internal/admin-setup/repository/admin-setup.js';
import { AdminSetupUseCase } from './internal/admin-setup/usecase/admin-setup.js';
import { createAdminSetupRouter } from './internal/admin-setup/delivery/http/admin-setup.js';
import { createProjectsRouter } from './internal/projects/delivery/http/projects.js';
import { buildProjectsRepository } from './internal/projects/repository/projects.js';
import { buildProjectsUseCase } from './internal/projects/usecase/projects.js';
import { createSmtpRouter } from './internal/smtp/delivery/http/smtp.js';
import { buildSmtpRepository } from './internal/smtp/repository/smtp.js';
import { buildSmtpSender } from './internal/smtp/sender/smtp-sender.js';
import { buildSmtpUseCase } from './internal/smtp/usecase/smtp.js';
import { createTemplatesRouter } from './internal/templates/delivery/http/templates.js';
import { buildTemplatesRepository } from './internal/templates/repository/templates.js';
import {
  extractPlaceholders,
  renderTemplate,
} from './internal/templates/renderer/template-renderer.js';
import { buildTemplatesUseCase } from './internal/templates/usecase/templates.js';
import { createUploadsRouter } from './internal/uploads/delivery/http/uploads.js';
import { fileParser } from './internal/uploads/parser/file-parser.js';
import { buildUploadsRepository } from './internal/uploads/repository/uploads.js';
import { buildUploadsUseCase } from './internal/uploads/usecase/uploads.js';
import { createCryptoService } from './services/crypto.js';
import { buildApiKeysRepository } from './internal/apikeys/repository/api-keys.js';
import { buildApiKeysUseCase } from './internal/apikeys/usecase/api-keys.js';
import { createApiKeysRouter } from './internal/apikeys/delivery/http/api-keys.js';
import { createApiAccessRouter } from './internal/apikeys/delivery/http/api-access.js';
import { createApiAccessCheck } from './internal/apikeys/service/api-access.js';
import { createApiKeyMiddleware } from './internal/apikeys/auth/api-key-middleware.js';

export type CompositionDeps = {
  env: Env;
  prisma: PrismaClient;
  // Test seam: replaces the session-based authentication middleware.
  requireAuth?: RequestHandler;
  // Test seams: replace the MinIO client and the two Redis connections (publisher and subscriber).
  storage?: StorageInterface;
  queue?: QueueInterface;
  authEmailSender?: AuthEmailSenderInterface;
  flags?: FeatureFlagsInterface;
  metrics?: MetricsInterface;
  errorReporter?: ErrorReporter;
  errorLogSink?: ErrorLogSink;
  // Test seam: shorter SMTP retry delays and attempts for the send worker.
  sendRetry?: { maxAttempts?: number; retryScheduleMs?: number[] };
  redis?: { publisher: RedisPubSubClient; subscriber: RedisPubSubClient };
};

export type Application = {
  app: Express;
  errorReporter: ErrorReporter;
  // Prepares external resources: creates the bucket and subscribes to flag invalidations.
  start(): Promise<void>;
  stop(): Promise<void>;
  seedSystemDemoProject(): Promise<void>;
};

export function buildApp(deps: CompositionDeps): Express {
  return buildApplication(deps).app;
}

export function buildApplication({
  env,
  prisma,
  requireAuth: requireAuthOverride,
  storage: storageOverride,
  queue: queueOverride,
  authEmailSender: authEmailSenderOverride,
  flags: flagsOverride,
  errorReporter: errorReporterOverride,
  errorLogSink: errorLogSinkOverride,
  sendRetry,
  metrics: metricsOverride,
  redis: redisOverride,
}: CompositionDeps): Application {
  const cryptoService = createCryptoService(env.APP_ENCRYPTION_KEY);
  const auditRepository = buildAuditRepository(prisma);
  const adminSetupRepository = new AdminSetupRepository(prisma, auditRepository);

  const envMailConfig: AuthEmailSenderConfig | undefined =
    env.AUTH_SMTP_HOST && env.AUTH_MAIL_FROM
      ? {
          host: env.AUTH_SMTP_HOST,
          port: env.AUTH_SMTP_PORT,
          secure: env.AUTH_SMTP_SECURE,
          user: env.AUTH_SMTP_USER,
          pass: env.AUTH_SMTP_PASS,
          from: env.AUTH_MAIL_FROM,
        }
      : undefined;

  const dynamicAuthEmailSender = new DynamicAuthEmailSender(
    adminSetupRepository,
    cryptoService,
    envMailConfig,
    errorReporterOverride,
  );

  const authEmailSender =
    authEmailSenderOverride ?? dynamicAuthEmailSender;

  const loginActivityRepository = new LoginActivityRepository(prisma);
  const loginContextRedis = new Redis(env.REDIS_URL, { lazyConnect: true });
  const loginActivityUseCase = new LoginActivityUseCase(
    loginActivityRepository,
    env.LOGIN_EVENT_RETENTION_DAYS,
    buildRateLimiter({ redis: loginContextRedis }),
    new LoginContextStateRepository(loginContextRedis),
  );

  const auth = createAuth({
    prisma,
    env: {
      googleClientId: env.GOOGLE_CLIENT_ID,
      googleClientSecret: env.GOOGLE_CLIENT_SECRET,
      secret: env.BETTER_AUTH_SECRET,
      baseUrl: env.BETTER_AUTH_URL,
      trustedOrigins: env.TRUSTED_ORIGINS ?? [],
      appUrl: env.APP_URL,
    },
    authEmailSender,
    loginActivityUseCase,
    adminEmails: env.ADMIN_EMAILS,
    errorReporter: errorReporterOverride,
  });

  const requireAuth =
    requireAuthOverride ??
    createRequireAuth(async (headers) => {
      const session = await auth.api.getSession({ headers });
      if (!session) return null;
      const { id, email } = session.user;
      const role = (session.user as { role?: string }).role ?? 'user';
      const disabledAt = (session.user as { disabledAt?: Date | string | null }).disabledAt;
      const disabledReason = (session.user as { disabledReason?: string | null }).disabledReason;
      return {
        user: {
          id,
          email,
          role,
          disabledAt: disabledAt ? new Date(disabledAt) : null,
          disabledReason: disabledReason ?? null,
        },
      };
    });
  const guards = [requireAuth];
  // Whether the request carries a valid session (used by /openapi.json to choose between the full and the scoped document).
  const hasSession = async (request: Request): Promise<boolean> => {
    if (requireAuthOverride) {
      return new Promise<boolean>((resolve) => {
        void Promise.resolve(requireAuthOverride(request, { locals: {} } as unknown as Response, (error?: unknown) => resolve(!error))).catch(() => resolve(false));
      });
    }
    return Boolean(await auth.api.getSession({ headers: fromNodeHeaders(request.headers) }));
  };

  const projectsRepository = buildProjectsRepository({
    prisma,
    auditRepository,
  });
  const templatesRepository = buildTemplatesRepository({
    prisma,
    auditRepository,
  });
  const uploadsRepository = buildUploadsRepository({ prisma, auditRepository });

  const findOwnedProject = async (projectId: string, userId: string) =>
    (
      await projectsRepository.getSingleProjectRepository({
        filter: { id: projectId, ownerId: userId },
      })
    ).data;
  const ownsProject = async (
    projectId: string,
    userId: string,
  ): Promise<boolean> => (await findOwnedProject(projectId, userId)) !== null;

  const projectsUseCase = buildProjectsUseCase({
    repository: projectsRepository,
    prisma,
  });
  const smtpRepository = buildSmtpRepository({ prisma, auditRepository });
  const smtpSender = buildSmtpSender();
  const smtpUseCase = buildSmtpUseCase({
    repository: smtpRepository,
    prisma,
    cryptoService,
    sender: smtpSender,
    projectLookup: ownsProject,
  });
  const templatesUseCase = buildTemplatesUseCase({
    repository: templatesRepository,
    prisma,
    projectLookup: ownsProject,
  });
  const uploadsUseCase = buildUploadsUseCase({
    repository: uploadsRepository,
    prisma,
    parser: fileParser,
    settingsLookup: async (projectId, userId) => {
      const project = await findOwnedProject(projectId, userId);
      return project
        ? { maxUploadBytes: project.maxUploadBytes, maxRows: project.maxRows }
        : null;
    },
    projectLookup: ownsProject,
  });
  const attachmentsRepository = buildAttachmentsRepository({
    prisma,
    auditRepository,
  });
  const pdfTemplatesRepository = buildPdfTemplatesRepository({
    prisma,
    auditRepository,
  });
  const pdfTemplateLookup = async (
    projectId: string,
    id: string,
  ): Promise<{ placeholders: string[] } | null> => {
    const { data } = await pdfTemplatesRepository.getPdfTemplatesRepository({
      filter: { projectId, id },
    });
    return data
      ? { placeholders: extractPdfPlaceholders(data.nodeTree) }
      : null;
  };
  const mappingRepository = buildMappingRepository({ prisma, auditRepository });
  const mappingUseCase = buildMappingUseCase({
    repository: mappingRepository,
    prisma,
    pdfTemplateLookup,
    engine: { extractPlaceholders, renderTemplate },
    templateLookup: async (projectId, templateId) => {
      const { data } = await templatesRepository.getTemplateRepository({
        filter: { projectId, id: templateId },
      });
      return data ? { subject: data.subject, bodyHtml: data.bodyHtml } : null;
    },
    uploadLookup: async (projectId, uploadId) => {
      const { data } = await uploadsRepository.findByIdUploadsRepository({
        filter: { projectId, id: uploadId },
      });
      return data ? { columns: data.columns, rowCount: data.rowCount } : null;
    },
    rowLookup: async (projectId, uploadId, rowIndex) => {
      const { data } = await uploadsRepository.getRowsUploadsRepository({
        filter: { projectId, id: uploadId },
      });
      return data?.[rowIndex] ?? null;
    },
    projectLookup: ownsProject,
  });

  const storage =
    storageOverride ??
    buildStorage({
      client: new MinioClient({
        endPoint: env.S3_ENDPOINT,
        port: env.S3_PORT,
        useSSL: env.S3_USE_SSL,
        accessKey: env.S3_ACCESS_KEY,
        secretKey: env.S3_SECRET_KEY,
        region: env.S3_REGION,
        pathStyle: env.S3_PATH_STYLE,
      }),
      bucket: env.S3_BUCKET,
    });
  // Errors always land in the MinIO log (source of truth); an external reporter such as Sentry is optional and may be rate limited.
  const errorLogSink = errorLogSinkOverride ?? buildErrorLogSink({ storage });
  const errorReporter = errorReporterOverride ?? buildErrorReporter({ sink: errorLogSink });
  const pdfRenderer = buildPdfRenderer({
    imageLoader: async (projectId, attachmentId) => {
      const { data } =
        await attachmentsRepository.findByIdAttachmentsRepository({
          filter: { projectId, id: attachmentId },
        });
      return data ? storage.getObject(data.objectKey) : null;
    },
  });
  const pdfTemplatesUseCase = buildPdfTemplatesUseCase({
    repository: pdfTemplatesRepository,
    prisma,
    projectLookup: ownsProject,
    attachmentLookup: async (projectId, attachmentId) =>
      (
        await attachmentsRepository.findByIdAttachmentsRepository({
          filter: { projectId, id: attachmentId },
        })
      ).data !== null,
    renderer: pdfRenderer,
  });
  const attachmentStore = buildAttachmentStore({
    prisma,
    storage,
    auditRepository,
    repository: attachmentsRepository,
  });
  const attachmentsUseCase = buildAttachmentsUseCase({
    repository: attachmentsRepository,
    prisma,
    storage,
    projectLookup: ownsProject,
    quotaLookup: async (projectId, userId) => {
      const project = await findOwnedProject(projectId, userId);
      return project ? { storageQuotaBytes: project.storageQuotaBytes } : null;
    },
  });

  // ioredis connects lazily on the first command, so building these here opens no connection in tests.
  const publisher =
    redisOverride?.publisher ?? new Redis(env.REDIS_URL, { lazyConnect: true });
  const subscriber =
    redisOverride?.subscriber ??
    new Redis(env.REDIS_URL, { lazyConnect: true });
  const systemConfigRepository = buildSystemConfigRepository({
    prisma,
    auditRepository,
  });
  const flags =
    flagsOverride ??
    buildFeatureFlags({
      repository: systemConfigRepository,
      publisher,
      subscriber,
    });
  const systemConfigUseCase = buildSystemConfigUseCase({
    repository: systemConfigRepository,
    prisma,
    flags,
    notifyChanged: (key) => flags.notifyChanged(key),
    apiAccessEnvEnabled: env.API_ACCESS_ENABLED,
  });
  const isApiAccessActive = createApiAccessCheck({ environmentEnabled: env.API_ACCESS_ENABLED, flags });
  const apiKeysRepository = buildApiKeysRepository({ prisma, auditRepository });
  const apiKeysUseCase = buildApiKeysUseCase({ repository: apiKeysRepository, prisma, projectLookup: ownsProject, isActive: isApiAccessActive });
  const apiKeyRedis = new Redis(env.REDIS_URL, { lazyConnect: true });
  const apiKeyMiddleware = createApiKeyMiddleware({ repository: apiKeysRepository, isActive: isApiAccessActive, rateLimiter: buildRateLimiter({ redis: apiKeyRedis }), allowedOrigins: env.API_ALLOWED_ORIGINS });

  const metrics = metricsOverride ?? buildMetrics();
  const queue = queueOverride ?? buildQueue({ url: env.RABBITMQ_URL, metrics, errorReporter });
  const campaignsRepository = buildCampaignsRepository({ prisma, auditRepository });
  const campaignsUseCase = buildCampaignsUseCase({
    repository: campaignsRepository,
    prisma,
    queue,
    pdfTemplateLookup,
    templateLookup: async (projectId, id) => {
      const { data } = await templatesRepository.getTemplateRepository({
        filter: { projectId, id },
      });
      return data ? { subject: data.subject, bodyHtml: data.bodyHtml } : null;
    },
    smtpLookup: async (projectId, id) => {
      const { data } = await smtpRepository.getSmtpRepository({
        filter: { projectId, id },
      });
      return data ? { id: data.id } : null;
    },
    uploadLookup: async (projectId, id) => {
      const upload = (
        await uploadsRepository.findByIdUploadsRepository({
          filter: { projectId, id },
        })
      ).data;
      if (!upload) return null;
      const rows =
        (
          await uploadsRepository.getRowsUploadsRepository({
            filter: { projectId, id },
          })
        ).data ?? [];
      return { columns: upload.columns, rows };
    },
    mappingLookup: async (_projectId, templateId, uploadId) => {
      const { data } = await mappingRepository.getMappingRepository({
        filter: { templateId, uploadId },
      });
      return data ? data.mapping : null;
    },
    projectLookup: ownsProject,
  });
  const notificationsUseCase = buildNotificationsUseCase({
    repository: buildNotificationsRepository({ prisma, auditRepository }),
    prisma,
    projectLookup: ownsProject,
  });
  const auditUseCase = buildAuditUseCase({
    repository: auditRepository,
    prisma,
    projectLookup: ownsProject,
  });

  const preferencesRepository = new PreferencesRepository(prisma, auditRepository);
  const preferencesUseCase = new PreferencesUseCase(preferencesRepository);

  const userNoticesRepository = new UserNoticesRepository(prisma);
  const userNoticesUseCase = new UserNoticesUseCase(userNoticesRepository);

  const broadcastRepository = new BroadcastRepository(prisma, auditRepository);
  const broadcastUseCase = new BroadcastUseCase(
    broadcastRepository,
    auditRepository,
    authEmailSender,
  );

  const avatarRepository = buildAvatarRepository({ prisma, auditRepository });
  const avatarUseCase = buildAvatarUseCase({ storage, repository: avatarRepository });

  const adminUsersRepository = buildAdminUsersRepository({ prisma, auditRepository });
  const adminUsersUseCase = buildAdminUsersUseCase({
    repository: adminUsersRepository,
    prisma,
    adminEmails: env.ADMIN_EMAILS,
  });

  const adminSetupUseCase = new AdminSetupUseCase(
    adminSetupRepository,
    cryptoService,
    envMailConfig,
    () => dynamicAuthEmailSender.invalidate(),
    undefined,
    {
      grafana: env.SETUP_GRAFANA_URL ? { baseUrl: env.SETUP_GRAFANA_URL, apiToken: env.SETUP_GRAFANA_API_TOKEN } : undefined,
      uptime: env.SETUP_UPTIME_URL ? { baseUrl: env.SETUP_UPTIME_URL, username: env.SETUP_UPTIME_USERNAME, password: env.SETUP_UPTIME_PASSWORD } : undefined,
    },
  );

  const demoProjectUseCase = buildDemoProjectUseCase({
    prisma,
    projectsRepository,
    templatesRepository,
    uploadsUseCase,
    mappingUseCase,
    pdfTemplatesRepository,
    campaignsRepository,
    smtpUseCase,
  });
  // The rate limiter sends ordinary commands, so it gets its own connection (not the pub/sub ones).
  const sendWorker = buildSendWorker({
    prisma,
    queue,
    cryptoService,
    sender: smtpSender,
    rateLimiter: buildRateLimiter({
      redis: new Redis(env.REDIS_URL, { lazyConnect: true }),
    }),
    engine: { renderTemplate },
    auditRepository,
    metrics,
    pdfRenderer,
    attachmentStore,
    storage,
    errorReporter,
    ...sendRetry,
  });

  // Order matters: the auth router must be mounted before routers whose guards
  // apply requireAuth to every path.
  const openApiDocument = buildOpenApiDocument(allRouteDocs, { title: 'Slipakar API', version: '1.0.0' });
  const integrationOpenApiDocument = buildIntegrationOpenApiDocument(allRouteDocs, { title: 'Slipakar Integrations API', version: '1.0.0' });
  const app = createApp({
    trustProxy: env.TRUST_PROXY,
    errorReporter,
    middleware: [requestMetrics(metrics), apiKeyMiddleware],
    routers: [
      createAuthRouter(auth),
      createApiAccessRouter({ userGuards: guards, adminGuards: [...guards, requireAdmin(env.ADMIN_EMAILS)], isActive: isApiAccessActive, envEnabled: env.API_ACCESS_ENABLED, allowedOrigins: env.API_ALLOWED_ORIGINS, flags }),
      createApiKeysRouter({ guards, useCase: apiKeysUseCase }),
      // /metrics has its own bearer-token check (METRICS_TOKEN), so it is mounted before the session guards.
      createMetricsRouter({ metrics, token: env.METRICS_TOKEN }),
      // API docs: sign-in required, and hidden (404) while the scalar_docs flag is off.
      Router().get('/docs', ...guards, requireFeature(flags, 'scalar_docs'), (_request, _response, next) => next()),
      createOpenApiRouter({ document: openApiDocument, integrationDocument: integrationOpenApiDocument, integrationEnabled: isApiAccessActive, getSession: hasSession, fullDocsEnabled: () => flags.isEnabled('scalar_docs') }),
      createPreferencesRouter({ guards, preferencesUseCase }),
      createLoginActivityRouter({
        userGuards: guards,
        adminGuards: [...guards, requireAdmin(env.ADMIN_EMAILS)],
        useCase: loginActivityUseCase,
      }),
      createUserNoticesRouter({ userGuards: guards, useCase: userNoticesUseCase }),
      createAvatarRouter({ guards, useCase: avatarUseCase }),
      createSmtpRouter({ guards, useCase: smtpUseCase }),
      createTemplatesRouter({ guards, useCase: templatesUseCase }),
      createUploadsRouter({ guards, useCase: uploadsUseCase }),
      createMappingRouter({ guards, useCase: mappingUseCase }),
      createAttachmentsRouter({ guards, useCase: attachmentsUseCase }),
      // The pdf_builder flag switches the PDF template routes off (404) without touching other routes.
      Router().use(
        '/projects/:projectId/pdf-templates',
        ...guards,
        requireFeature(flags, 'pdf_builder'),
      ),
      createPdfTemplatesRouter({ guards, useCase: pdfTemplatesUseCase }),
      createCampaignsRouter({ guards, useCase: campaignsUseCase }),
      createNotificationsRouter({ guards, useCase: notificationsUseCase }),
      createAuditRouter({ guards, useCase: auditUseCase }),
      createProjectsRouter({ guards, useCase: projectsUseCase }),
      // Admin routes mounted with requireAdmin guard
      createAdminUsersRouter({
        guards: [...guards, requireAdmin(env.ADMIN_EMAILS)],
        useCase: adminUsersUseCase,
      }),
      createAdminSetupRouter({
        guards: [...guards, requireAdmin(env.ADMIN_EMAILS)],
        useCase: adminSetupUseCase,
      }),
      createBroadcastsRouter({
        adminGuards: [...guards, requireAdmin(env.ADMIN_EMAILS)],
        useCase: broadcastUseCase,
      }),
      createDemoProjectRouter({
        guards: [...guards, requireAdmin(env.ADMIN_EMAILS)],
        useCase: demoProjectUseCase,
      }),
      // Must stay last: its guards include requireAdmin, which would otherwise
      // reject non-admins on every router mounted after it.
      createSystemConfigRouter({
        guards: [...guards, requireAdmin(env.ADMIN_EMAILS)],
        useCase: systemConfigUseCase,
      }),
    ],
  });

  let retentionTimer: NodeJS.Timeout | null = null;

  return {
    app,
    errorReporter,
    async seedSystemDemoProject(): Promise<void> {
      await seedSystemDemoProject({ prisma, demoProjectUseCase, errorReporter });
    },
    async start(): Promise<void> {
      await storage.ensureBucket();
      errorLogSink.start();
      await flags.start();
      await queue.start();
      await queue.consumeSendEmail((message) =>
        sendWorker.handleSendEmail(message),
      );
      await queue.consumeNotify((message) =>
        notificationsUseCase.handleNotify(message),
      );

      // Run expired login events cleanup at start and every 24h
      try {
        await loginActivityUseCase.purgeExpired();
      } catch {
        // Log or sink error without throwing
      }
      retentionTimer = setInterval(async () => {
        try {
          await loginActivityUseCase.purgeExpired();
        } catch {
          // Log or sink error
        }
      }, 24 * 60 * 60 * 1000);
      retentionTimer.unref();
    },
    async stop(): Promise<void> {
      if (retentionTimer) {
        clearInterval(retentionTimer);
        retentionTimer = null;
      }
      await queue.stop();
      await flags.stop();
      await errorLogSink.stop();
      loginContextRedis.disconnect();
      apiKeyRedis.disconnect();
    },
  };
}
