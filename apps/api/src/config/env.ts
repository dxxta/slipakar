import { z } from 'zod';

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),
  TRUSTED_ORIGINS: z
    .string()
    .default('')
    .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean))
    .pipe(z.array(z.string().url()))
    .transform((origins) => origins.map((origin) => new URL(origin).origin)),
  API_ACCESS_ENABLED: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  API_ALLOWED_ORIGINS: z.string().default('').transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean)).pipe(z.array(z.string().url().refine((value) => { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname) && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash; }, 'API_ALLOWED_ORIGINS entries must be absolute origins'))).transform((origins) => origins.map((origin) => new URL(origin).origin)),
  EMBED_ALLOWED_ORIGINS: z.string().default('').transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean)).pipe(z.array(z.string().url().refine((value) => { const url = new URL(value); return Boolean(url.hostname) && !url.username && !url.password && !url.hostname.includes('*') && url.pathname === '/' && !url.search && !url.hash && (url.protocol === 'https:' || (url.protocol === 'http:' && url.hostname === 'localhost')); }, 'EMBED_ALLOWED_ORIGINS must be HTTPS origins or localhost'))).transform((origins) => origins.map((origin) => new URL(origin).origin)),
  // Any S3-compatible store (Garage by default, MinIO also works with S3_PATH_STYLE=true).
  S3_ENDPOINT: z.string().min(1),
  S3_PORT: z.coerce.number().int().min(1).max(65535).default(3900),
  S3_USE_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().min(1),
  // Garage rejects Signature V4 requests that do not carry its configured region.
  S3_REGION: z.string().min(1).default('garage'),
  S3_PATH_STYLE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),
  REDIS_URL: z.string().url(),
  RABBITMQ_URL: z
    .string()
    .url()
    .refine(
      (value) => /^amqps?:\/\//.test(value),
      'RABBITMQ_URL must start with amqp:// or amqps://',
    ),
  ADMIN_EMAILS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter((email) => email.length > 0),
    ),
  // Optional bearer token required to read /metrics; when unset, /metrics is open (local development).
  METRICS_TOKEN: z.string().min(16).optional(),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  // Platform SMTP settings for sending transactional auth emails (e.g. email change verification).
  AUTH_SMTP_HOST: z.string().trim().min(1).optional(),
  AUTH_SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(587),
  AUTH_SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  AUTH_SMTP_USER: z.string().trim().min(1).optional(),
  AUTH_SMTP_PASS: z.string().min(1).optional(),
  AUTH_MAIL_FROM: z.string().trim().email().max(254).optional(),
  // Optional base URL of the frontend user web app for callbacks (defaults to first trusted origin).
  APP_URL: z
    .string()
    .url()
    .transform((url) => url.replace(/\/+$/, ''))
    .optional(),
  // Retention period in days for LoginEvent records (default: 90 days, between 1 and 3650 days).
  LOGIN_EVENT_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(90),
  // Trust proxy setting for Express: 'false', hop count (e.g. '1'), or CIDR / IP list.
  TRUST_PROXY: z.string().trim().default('false'),
  SEED_DEMO_PROJECT: z.enum(['true', 'false']).default('true').transform((value) => value === 'true'),
  SETUP_GRAFANA_URL: z.string().url().optional(),
  SETUP_UPTIME_URL: z.string().url().optional(),
  SETUP_UPTIME_USERNAME: z.string().trim().min(1).optional(),
  SETUP_UPTIME_PASSWORD: z.string().min(1).optional(),
  SETUP_GRAFANA_API_TOKEN: z.string().trim().min(1).optional(),
}).refine((data) => {
  const hasHost = Boolean(data.AUTH_SMTP_HOST);
  const hasFrom = Boolean(data.AUTH_MAIL_FROM);
  if ((hasHost && !hasFrom) || (!hasHost && hasFrom)) {
    return false;
  }
  const hasUser = Boolean(data.AUTH_SMTP_USER);
  const hasPass = Boolean(data.AUTH_SMTP_PASS);
  if ((hasUser && !hasPass) || (!hasUser && hasPass)) {
    return false;
  }
  return true;
}, {
  message: 'AUTH_SMTP_HOST and AUTH_MAIL_FROM must be configured together; AUTH_SMTP_USER and AUTH_SMTP_PASS must be configured together',
});

export type Env = z.infer<typeof envSchema>;

// docker-compose passes unset optional variables as empty strings; treat those as absent.
const optionalWhenEmpty = ['APP_URL', 'AUTH_SMTP_HOST', 'AUTH_SMTP_PORT', 'AUTH_SMTP_SECURE', 'AUTH_SMTP_USER', 'AUTH_SMTP_PASS', 'AUTH_MAIL_FROM', 'LOGIN_EVENT_RETENTION_DAYS', 'TRUST_PROXY', 'SEED_DEMO_PROJECT', 'SETUP_GRAFANA_URL', 'SETUP_UPTIME_URL', 'SETUP_UPTIME_USERNAME', 'SETUP_UPTIME_PASSWORD', 'SETUP_GRAFANA_API_TOKEN', 'API_ALLOWED_ORIGINS', 'EMBED_ALLOWED_ORIGINS'];

export function loadEnv(source: Record<string, string | undefined>): Env {
  const cleaned = { ...source };
  for (const key of optionalWhenEmpty) {
    if (cleaned[key]?.trim() === '') delete cleaned[key];
  }
  if (cleaned.SEED_DEMO_PROJECT === undefined && cleaned.NODE_ENV === 'test') {
    cleaned.SEED_DEMO_PROJECT = 'false';
  }
  return envSchema.parse(cleaned);
}
