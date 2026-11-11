import { describe, expect, it } from 'vitest';
import { loadEnv } from './env.js';

describe('loadEnv', () => {
  const key = 'a'.repeat(64);
  const valid = {
    DATABASE_URL: 'postgresql://localhost/db',
    APP_ENCRYPTION_KEY: key,
    GOOGLE_CLIENT_ID: 'google-id',
    GOOGLE_CLIENT_SECRET: 'google-secret',
    BETTER_AUTH_SECRET: 'auth-secret',
    BETTER_AUTH_URL: 'http://localhost:3000',
    S3_ENDPOINT: 'localhost',
    S3_ACCESS_KEY: 's3-access',
    S3_SECRET_KEY: 's3-secret',
    S3_BUCKET: 'slipakar',
    REDIS_URL: 'redis://localhost:6379',
    RABBITMQ_URL: 'amqp://guest:guest@localhost:5672',
  };

  it('rejects a missing database URL', () => {
    const { DATABASE_URL: _omitted, ...rest } = valid;
    void _omitted;
    expect(() => loadEnv(rest)).toThrow();
  });

  it('rejects a short encryption key', () => {
    expect(() => loadEnv({ ...valid, APP_ENCRYPTION_KEY: 'abc' })).toThrow();
  });

  it.each([
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'BETTER_AUTH_SECRET',
    'BETTER_AUTH_URL',
    'S3_ENDPOINT',
    'S3_ACCESS_KEY',
    'S3_SECRET_KEY',
    'S3_BUCKET',
    'REDIS_URL',
    'RABBITMQ_URL',
  ])(
    'rejects a missing %s',
    (name) => {
      const copy: Record<string, string | undefined> = { ...valid };
      delete copy[name];
      expect(() => loadEnv(copy)).toThrow();
    },
  );

  it('accepts valid values and defaults the port', () => {
    expect(loadEnv(valid)).toEqual({
      ...valid,
      PORT: 3000,
      LOGIN_EVENT_RETENTION_DAYS: 90,
      TRUST_PROXY: 'false',
      SEED_DEMO_PROJECT: true,
      S3_PORT: 3900,
      S3_USE_SSL: false,
      S3_REGION: 'garage',
      S3_PATH_STYLE: true,
      ADMIN_EMAILS: [],
      TRUSTED_ORIGINS: [],
      API_ACCESS_ENABLED: false,
      API_ALLOWED_ORIGINS: [],
      EMBED_ALLOWED_ORIGINS: [],
      AUTH_SMTP_PORT: 587,
      AUTH_SMTP_SECURE: false,
    });
  });

  it('parses, validates and strips trailing slashes from trusted origins', () => {
    expect(loadEnv({ ...valid, TRUSTED_ORIGINS: ' https://app.example.com/,http://localhost:8081/ ' }).TRUSTED_ORIGINS)
      .toEqual(['https://app.example.com', 'http://localhost:8081']);
    expect(() => loadEnv({ ...valid, TRUSTED_ORIGINS: 'not-a-url' })).toThrow();
  });

  it('defaults API access off and validates browser origins as absolute origins', () => {
    expect(loadEnv(valid).API_ACCESS_ENABLED).toBe(false);
    expect(loadEnv(valid).API_ALLOWED_ORIGINS).toEqual([]);
    expect(loadEnv({ ...valid, API_ACCESS_ENABLED: 'true', API_ALLOWED_ORIGINS: 'https://app.example.com/, http://localhost:4300' })).toMatchObject({ API_ACCESS_ENABLED: true, API_ALLOWED_ORIGINS: ['https://app.example.com', 'http://localhost:4300'] });
    expect(loadEnv({ ...valid, API_ALLOWED_ORIGINS: 'https://app.example.com:443/' }).API_ALLOWED_ORIGINS).toEqual(['https://app.example.com']);
    expect(() => loadEnv({ ...valid, API_ALLOWED_ORIGINS: 'https://app.example.com/path' })).toThrow();
    expect(() => loadEnv({ ...valid, API_ALLOWED_ORIGINS: 'https://user:pass@app.example.com' })).toThrow();
  });

  it('validates embed origins as HTTPS or localhost and defaults embedding off', () => {
    expect(loadEnv(valid).EMBED_ALLOWED_ORIGINS).toEqual([]);
    expect(loadEnv({ ...valid, EMBED_ALLOWED_ORIGINS: 'https://host.example, http://localhost:4300/' }).EMBED_ALLOWED_ORIGINS).toEqual(['https://host.example', 'http://localhost:4300']);
    expect(() => loadEnv({ ...valid, EMBED_ALLOWED_ORIGINS: 'http://host.example' })).toThrow();
    expect(() => loadEnv({ ...valid, EMBED_ALLOWED_ORIGINS: 'https://host.example/path' })).toThrow();
    expect(() => loadEnv({ ...valid, EMBED_ALLOWED_ORIGINS: 'https://*.example.com' })).toThrow();
    expect(() => loadEnv({ ...valid, EMBED_ALLOWED_ORIGINS: 'http://127.0.0.1:4300' })).toThrow();
  });

  it('parses ADMIN_EMAILS into trimmed lowercase emails and ignores blanks', () => {
    expect(loadEnv({ ...valid, ADMIN_EMAILS: ' Boss@Example.com, ,ops@example.com ' }).ADMIN_EMAILS).toEqual([
      'boss@example.com',
      'ops@example.com',
    ]);
  });

  it('parses S3_USE_SSL, S3_PORT, S3_REGION and S3_PATH_STYLE', () => {
    const env = loadEnv({ ...valid, S3_USE_SSL: 'true', S3_PORT: '9100', S3_REGION: 'eu-west-1', S3_PATH_STYLE: 'false' });
    expect(env.S3_REGION).toBe('eu-west-1');
    expect(env.S3_PATH_STYLE).toBe(false);
    expect(env.S3_USE_SSL).toBe(true);
    expect(env.S3_PORT).toBe(9100);
  });

  it('rejects a RABBITMQ_URL that is not an amqp(s) URL', () => {
    expect(() => loadEnv({ ...valid, RABBITMQ_URL: 'http://localhost:5672' })).toThrow();
  });

  it('defaults demo seeding on outside tests and off in tests', () => {
    expect(loadEnv(valid).SEED_DEMO_PROJECT).toBe(true);
    expect(loadEnv({ ...valid, NODE_ENV: 'test' }).SEED_DEMO_PROJECT).toBe(false);
    expect(loadEnv({ ...valid, NODE_ENV: 'test', SEED_DEMO_PROJECT: 'true' }).SEED_DEMO_PROJECT).toBe(true);
  });

  it('rejects malformed optional monitoring URLs and treats empty optional values as unset', () => {
    expect(() => loadEnv({ ...valid, SETUP_GRAFANA_URL: 'not-a-url' })).toThrow();
    const env = loadEnv({ ...valid, SETUP_GRAFANA_URL: '', SETUP_UPTIME_URL: '', SETUP_UPTIME_PASSWORD: '', SETUP_UPTIME_USERNAME: '', SETUP_GRAFANA_API_TOKEN: '' });
    expect(env.SETUP_GRAFANA_URL).toBeUndefined();
    expect(env.SETUP_UPTIME_URL).toBeUndefined();
  });

  it('parses optional monitoring integration environment values', () => {
    const env = loadEnv({
      ...valid,
      SETUP_GRAFANA_URL: 'http://grafana:3000',
      SETUP_UPTIME_URL: 'http://uptime-kuma:3001',
      SETUP_UPTIME_USERNAME: 'admin',
      SETUP_UPTIME_PASSWORD: 'secret',
      SETUP_GRAFANA_API_TOKEN: 'token',
    });
    expect(env.SETUP_GRAFANA_URL).toBe('http://grafana:3000');
    expect(env.SETUP_UPTIME_URL).toBe('http://uptime-kuma:3001');
    expect(env.SETUP_UPTIME_USERNAME).toBe('admin');
    expect(env.SETUP_UPTIME_PASSWORD).toBe('secret');
    expect(env.SETUP_GRAFANA_API_TOKEN).toBe('token');
  });

  it('leaves METRICS_TOKEN undefined when it is not set', () => {
    expect(loadEnv(valid).METRICS_TOKEN).toBeUndefined();
  });

  it('accepts a METRICS_TOKEN and rejects one that is too short', () => {
    expect(loadEnv({ ...valid, METRICS_TOKEN: 'a'.repeat(16) }).METRICS_TOKEN).toBe('a'.repeat(16));
    expect(() => loadEnv({ ...valid, METRICS_TOKEN: 'short' })).toThrow();
  });

  it('rejects a non-URL REDIS_URL', () => {
    expect(() => loadEnv({ ...valid, REDIS_URL: 'not a url' })).toThrow();
  });

  it('parses optional AUTH_SMTP_* settings and APP_URL', () => {
    const env = loadEnv({
      ...valid,
      AUTH_SMTP_HOST: 'smtp.example.com',
      AUTH_SMTP_PORT: '587',
      AUTH_SMTP_SECURE: 'false',
      AUTH_SMTP_USER: 'auth-user',
      AUTH_SMTP_PASS: 'auth-pass',
      AUTH_MAIL_FROM: 'noreply@example.com',
      APP_URL: 'http://localhost:8080/',
    });
    expect(env.AUTH_SMTP_HOST).toBe('smtp.example.com');
    expect(env.AUTH_SMTP_PORT).toBe(587);
    expect(env.AUTH_SMTP_SECURE).toBe(false);
    expect(env.AUTH_SMTP_USER).toBe('auth-user');
    expect(env.AUTH_SMTP_PASS).toBe('auth-pass');
    expect(env.AUTH_MAIL_FROM).toBe('noreply@example.com');
    expect(env.APP_URL).toBe('http://localhost:8080');
  });

  it('rejects an invalid APP_URL or invalid AUTH_MAIL_FROM', () => {
    expect(() => loadEnv({ ...valid, APP_URL: 'not-a-url' })).toThrow();
    expect(() => loadEnv({ ...valid, AUTH_MAIL_FROM: 'not-an-email' })).toThrow();
  });

  it('enforces all-or-nothing validation on platform auth SMTP env vars', () => {
    expect(() => loadEnv({ ...valid, AUTH_SMTP_HOST: 'smtp.example.com' })).toThrow();
    expect(() => loadEnv({ ...valid, AUTH_MAIL_FROM: 'noreply@example.com' })).toThrow();
    expect(() => loadEnv({
      ...valid,
      AUTH_SMTP_HOST: 'smtp.example.com',
      AUTH_MAIL_FROM: 'noreply@example.com',
      AUTH_SMTP_USER: 'user',
    })).toThrow();
    expect(() => loadEnv({
      ...valid,
      AUTH_SMTP_HOST: 'smtp.example.com',
      AUTH_MAIL_FROM: 'noreply@example.com',
      AUTH_SMTP_PASS: 'pass',
    })).toThrow();
  });

  it('treats empty optional auth mail variables from docker-compose as unset', () => {
    const env = loadEnv({
      ...valid,
      APP_URL: '',
      AUTH_SMTP_HOST: '',
      AUTH_SMTP_PORT: '',
      AUTH_SMTP_SECURE: '',
      AUTH_SMTP_USER: '',
      AUTH_SMTP_PASS: '',
      AUTH_MAIL_FROM: '',
      TRUST_PROXY: '',
    });
    expect(env.APP_URL).toBeUndefined();
    expect(env.AUTH_SMTP_HOST).toBeUndefined();
    expect(env.AUTH_SMTP_PORT).toBe(587);
    expect(env.TRUST_PROXY).toBe('false');
  });

  it('parses TRUST_PROXY values (false, number string, CIDRs)', () => {
    expect(loadEnv({ ...valid, TRUST_PROXY: 'false' }).TRUST_PROXY).toBe('false');
    expect(loadEnv({ ...valid, TRUST_PROXY: '1' }).TRUST_PROXY).toBe('1');
    expect(loadEnv({ ...valid, TRUST_PROXY: '127.0.0.1, 172.18.0.0/16' }).TRUST_PROXY).toBe('127.0.0.1, 172.18.0.0/16');
  });
});
