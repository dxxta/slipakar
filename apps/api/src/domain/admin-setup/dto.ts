import { z } from 'zod';
import { validateIntegrationUrl } from '../../lib/ssrf-guard.js';

export const INTEGRATION_KEYS = ['uptime', 'grafana', 'mail'] as const;
export type IntegrationKey = (typeof INTEGRATION_KEYS)[number];

export const integrationKeySchema = z.enum(INTEGRATION_KEYS);

const urlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2048)
  .superRefine((val, ctx) => {
    try {
      validateIntegrationUrl(val);
    } catch (err: unknown) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: err instanceof Error ? err.message : 'Invalid URL',
      });
    }
  });

export const updateUptimeIntegrationDto = z.strictObject({
  baseUrl: urlSchema,
  username: z.string().trim().max(256).optional(),
  password: z.string().max(1024).optional(),
  apiKey: z.string().trim().max(1024).optional(),
}).superRefine((val, ctx) => {
  const hasUser = Boolean(val.username);
  const hasPass = Boolean(val.password);
  const hasKey = Boolean(val.apiKey);

  if (hasKey && (hasUser || hasPass)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Provide either apiKey or username/password, not both',
    });
  }
  if ((hasUser && !hasPass) || (!hasUser && hasPass)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Both username and password are required when using password authentication',
    });
  }
});

export type UpdateUptimeIntegrationDto = z.infer<typeof updateUptimeIntegrationDto>;

export const updateGrafanaIntegrationDto = z.strictObject({
  baseUrl: urlSchema,
  apiToken: z.string().trim().max(2048).optional(),
});

export type UpdateGrafanaIntegrationDto = z.infer<typeof updateGrafanaIntegrationDto>;

export const updateMailIntegrationDto = z.strictObject({
  host: z.string().trim().min(1).max(512),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.boolean(),
  username: z.string().trim().max(256).optional(),
  password: z.string().max(1024).optional(),
  fromAddress: z.string().trim().email().max(254),
}).superRefine((val, ctx) => {
  const hasUser = Boolean(val.username);
  const hasPass = Boolean(val.password);
  if ((hasUser && !hasPass) || (!hasUser && hasPass)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Both username and password are required if credentials are provided',
    });
  }
});

export type UpdateMailIntegrationDto = z.infer<typeof updateMailIntegrationDto>;

export const updateIntegrationDto = z.union([
  updateUptimeIntegrationDto,
  updateGrafanaIntegrationDto,
  updateMailIntegrationDto,
]);

export type UpdateIntegrationDto = z.infer<typeof updateIntegrationDto>;

export const mailTestSendDto = z.strictObject({
  to: z.string().trim().email().max(254),
});

export type MailTestSendDto = z.infer<typeof mailTestSendDto>;

export const mailSettingsViewDto = z.strictObject({
  host: z.string(),
  port: z.number().int(),
  secure: z.boolean(),
  username: z.string().nullable(),
  fromAddress: z.string(),
});

export type MailSettingsView = z.infer<typeof mailSettingsViewDto>;

export const integrationItemViewDto = z.strictObject({
  key: integrationKeySchema,
  label: z.string(),
  configured: z.boolean(),
  source: z.enum(['database', 'env']).nullable(),
  baseUrl: z.string().nullable(),
  hasCredentials: z.boolean(),
  credentialHint: z.string().nullable(),
  settings: mailSettingsViewDto.nullable(),
  lastStatus: z.enum(['ok', 'failed']).nullable(),
  lastTestedAt: z.string().datetime().nullable(),
  lastError: z.string().nullable(),
});

export type IntegrationItemView = z.infer<typeof integrationItemViewDto>;

export const adminSetupViewDto = z.strictObject({
  complete: z.boolean(),
  integrations: z.array(integrationItemViewDto),
});

export type AdminSetupView = z.infer<typeof adminSetupViewDto>;
