import type {
  AdminSetupRepositoryInterface,
  AdminSetupUseCaseInterface,
  StoredCredentials,
  StoredGrafanaCredentials,
  StoredMailCredentials,
  StoredUptimeCredentials,
} from '../../../domain/admin-setup/interface.js';
import {
  INTEGRATION_KEYS,
  type AdminSetupView,
  type IntegrationItemView,
  type IntegrationKey,
  mailTestSendDto,
  updateGrafanaIntegrationDto,
  updateMailIntegrationDto,
  updateUptimeIntegrationDto,
} from '../../../domain/admin-setup/dto.js';
import type { CryptoServiceInterface } from '../../../services/crypto.js';
import { validateIntegrationUrl } from '../../../lib/ssrf-guard.js';
import { AppError } from '../../../lib/app-error.js';
import { validateAndThrow } from '../../../lib/validate-and-throw.js';
import type { IntegrationConfig } from '@prisma/client';
import nodemailer from 'nodemailer';
import type { AuthEmailSenderConfig } from '../../auth/auth-email-sender.js';

export type IntegrationTester = (
  key: IntegrationKey,
  config: { baseUrl: string; credentials: StoredCredentials },
) => Promise<{ ok: true } | { ok: false; error: string }>;

export const defaultIntegrationTester: IntegrationTester = async (key, config) => {
  if (key === 'mail') {
    const creds = config.credentials as StoredMailCredentials;
    const auth = creds.username && creds.password ? { user: creds.username, pass: creds.password } : undefined;
    const transporter = nodemailer.createTransport({
      host: config.baseUrl,
      port: creds.port,
      secure: creds.secure,
      ...(auth ? { auth } : {}),
      connectionTimeout: 10_000,
    });

    try {
      await transporter.verify();
      return { ok: true };
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      const safe = creds.password ? raw.replaceAll(creds.password, '***') : raw;
      return { ok: false, error: safe.slice(0, 500) };
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    const base = config.baseUrl.replace(/\/+$/, '');
    if (key === 'uptime') {
      const creds = config.credentials as StoredUptimeCredentials;
      const headers: Record<string, string> = {};
      if (creds.apiKey) {
        headers['Authorization'] = `Bearer ${creds.apiKey}`;
      } else if (creds.username && creds.password) {
        const token = Buffer.from(`${creds.username}:${creds.password}`).toString('base64');
        headers['Authorization'] = `Basic ${token}`;
      }

      // Check HTTP reachability / metrics / status endpoint without redirect following
      const url = `${base}/api/health`;
      const res = await fetch(url, {
        headers,
        signal: controller.signal,
        redirect: 'error',
      }).catch(async () => {
        return fetch(`${base}/metrics`, {
          headers,
          signal: controller.signal,
          redirect: 'error',
        }).catch(async () => {
          return fetch(base, {
            headers,
            signal: controller.signal,
            redirect: 'error',
          });
        });
      });

      if (!res.ok && res.status >= 500) {
        return { ok: false, error: `Uptime check returned HTTP ${res.status}` };
      }
      return { ok: true };
    } else if (key === 'grafana') {
      const creds = config.credentials as StoredGrafanaCredentials;
      // Step 1: GET <base>/api/health
      const healthRes = await fetch(`${base}/api/health`, {
        signal: controller.signal,
        redirect: 'error',
      });
      if (!healthRes.ok) {
        return { ok: false, error: `Grafana /api/health returned HTTP ${healthRes.status}` };
      }

      // Step 2: GET <base>/api/org with the bearer token (if token provided)
      if (creds.apiToken) {
        const orgRes = await fetch(`${base}/api/org`, {
          headers: {
            Authorization: `Bearer ${creds.apiToken}`,
          },
          signal: controller.signal,
          redirect: 'error',
        });
        if (!orgRes.ok) {
          return { ok: false, error: `Grafana /api/org returned HTTP ${orgRes.status}` };
        }
      }
      return { ok: true };
    }

    return { ok: false, error: `Unknown integration: ${key}` };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Connection failed';
    return { ok: false, error: errorMsg.slice(0, 500) };
  } finally {
    clearTimeout(timeoutId);
  }
};

export class AdminSetupUseCase implements AdminSetupUseCaseInterface {
  constructor(
    private readonly repository: AdminSetupRepositoryInterface,
    private readonly cryptoService: CryptoServiceInterface,
    private readonly envMailConfig?: AuthEmailSenderConfig,
    private readonly onMailConfigChanged?: () => void,
    private readonly tester: IntegrationTester = defaultIntegrationTester,
  ) {}

  private computeCredentialHint(secret: string | undefined): string | null {
    if (!secret || secret.length < 8) return null;
    return `••••${secret.slice(-4)}`;
  }

  private mapToView(
    key: IntegrationKey,
    record: IntegrationConfig | null,
  ): IntegrationItemView {
    const labels: Record<IntegrationKey, string> = {
      uptime: 'Uptime Kuma',
      grafana: 'Grafana',
      mail: 'Platform Mailer',
    };
    const label = labels[key];

    if (!record) {
      if (key === 'mail' && this.envMailConfig) {
        const secretForHint = this.envMailConfig.pass;
        return {
          key,
          label,
          configured: true,
          source: 'env',
          baseUrl: this.envMailConfig.host,
          hasCredentials: Boolean(secretForHint),
          credentialHint: this.computeCredentialHint(secretForHint),
          settings: {
            host: this.envMailConfig.host,
            port: this.envMailConfig.port,
            secure: this.envMailConfig.secure,
            username: this.envMailConfig.user ?? null,
            fromAddress: this.envMailConfig.from,
          },
          lastStatus: 'ok',
          lastTestedAt: null,
          lastError: null,
        };
      }

      return {
        key,
        label,
        configured: false,
        source: null,
        baseUrl: null,
        hasCredentials: false,
        credentialHint: null,
        settings: null,
        lastStatus: null,
        lastTestedAt: null,
        lastError: null,
      };
    }

    let credentials: StoredCredentials = {} as StoredCredentials;
    try {
      credentials = JSON.parse(
        this.cryptoService.decrypt(record.credentialsEncrypted),
      );
    } catch {
      // ignore
    }

    let secretForHint: string | undefined;
    if (key === 'uptime') {
      const c = credentials as StoredUptimeCredentials;
      secretForHint = c.apiKey || c.password;
    } else if (key === 'grafana') {
      const c = credentials as StoredGrafanaCredentials;
      secretForHint = c.apiToken;
    } else if (key === 'mail') {
      const c = credentials as StoredMailCredentials;
      secretForHint = c.password;
    }

    const hasCredentials = Boolean(secretForHint);
    const credentialHint = this.computeCredentialHint(secretForHint);

    let settings: IntegrationItemView['settings'] = null;
    if (key === 'mail') {
      const c = credentials as StoredMailCredentials;
      settings = {
        host: record.baseUrl,
        port: c.port,
        secure: c.secure,
        username: c.username ?? null,
        fromAddress: c.fromAddress,
      };
    }

    return {
      key,
      label,
      configured: true,
      source: 'database',
      baseUrl: record.baseUrl,
      hasCredentials,
      credentialHint,
      settings,
      lastStatus: (record.lastStatus as 'ok' | 'failed') ?? null,
      lastTestedAt: record.lastTestedAt ? record.lastTestedAt.toISOString() : null,
      lastError: record.lastError,
    };
  }

  async getSetup(): Promise<AdminSetupView> {
    const all = await this.repository.listAll();
    const map = new Map<string, IntegrationConfig>();
    for (const item of all) {
      map.set(item.key, item);
    }

    const integrations: IntegrationItemView[] = INTEGRATION_KEYS.map((k) =>
      this.mapToView(k, map.get(k) ?? null),
    );

    const complete =
      integrations.length === INTEGRATION_KEYS.length &&
      integrations.every((i) => i.configured && i.lastStatus === 'ok');

    return {
      complete,
      integrations,
    };
  }

  async updateIntegration(
    key: string,
    payload: unknown,
    userId: string,
  ): Promise<IntegrationItemView> {
    if (!INTEGRATION_KEYS.includes(key as IntegrationKey)) {
      throw new AppError(400, 'VALIDATION', `Invalid integration key: ${key}`);
    }
    const integrationKey = key as IntegrationKey;

    const existing = await this.repository.findByKey(integrationKey);
    let existingCreds: StoredCredentials = {} as StoredCredentials;
    if (existing) {
      try {
        existingCreds = JSON.parse(
          this.cryptoService.decrypt(existing.credentialsEncrypted),
        );
      } catch {
        // ignore
      }
    }

    let newCreds: StoredCredentials = {} as StoredCredentials;
    let validatedBaseUrl = '';

    if (integrationKey === 'uptime') {
      const validated = validateAndThrow({
        schema: updateUptimeIntegrationDto,
        data: payload ?? {},
      });
      validatedBaseUrl = validated.baseUrl;
      const uptimeExisting = existingCreds as StoredUptimeCredentials;

      const username = validated.username ?? uptimeExisting.username;
      const password =
        validated.password !== undefined && validated.password !== ''
          ? validated.password
          : uptimeExisting.password;
      const apiKey =
        validated.apiKey !== undefined && validated.apiKey !== ''
          ? validated.apiKey
          : uptimeExisting.apiKey;

      newCreds = {
        username: username || undefined,
        password: password || undefined,
        apiKey: apiKey || undefined,
      };
    } else if (integrationKey === 'grafana') {
      const validated = validateAndThrow({
        schema: updateGrafanaIntegrationDto,
        data: payload ?? {},
      });
      validatedBaseUrl = validated.baseUrl;
      const grafanaExisting = existingCreds as StoredGrafanaCredentials;

      const apiToken =
        validated.apiToken !== undefined && validated.apiToken !== ''
          ? validated.apiToken
          : grafanaExisting.apiToken;

      newCreds = {
        apiToken: apiToken || undefined,
      };
    } else if (integrationKey === 'mail') {
      const validated = validateAndThrow({
        schema: updateMailIntegrationDto,
        data: payload ?? {},
      });
      validatedBaseUrl = validated.host;
      const mailExisting = existingCreds as StoredMailCredentials;

      const username = validated.username ?? mailExisting.username;
      const password =
        validated.password !== undefined && validated.password !== ''
          ? validated.password
          : mailExisting.password;

      newCreds = {
        port: validated.port,
        secure: validated.secure,
        username: username || undefined,
        password: password || undefined,
        fromAddress: validated.fromAddress,
      };
    }

    const credentialsEncrypted = this.cryptoService.encrypt(
      JSON.stringify(newCreds),
    );

    const record = await this.repository.upsert({
      key: integrationKey,
      baseUrl: validatedBaseUrl,
      credentialsEncrypted,
      updatedBy: userId,
    });

    if (integrationKey === 'mail') {
      this.onMailConfigChanged?.();
    }

    return this.mapToView(integrationKey, record);
  }

  async deleteIntegration(
    key: string,
    userId: string,
  ): Promise<IntegrationItemView> {
    if (!INTEGRATION_KEYS.includes(key as IntegrationKey)) {
      throw new AppError(400, 'VALIDATION', `Invalid integration key: ${key}`);
    }
    const integrationKey = key as IntegrationKey;

    await this.repository.deleteByKey(integrationKey, userId);

    if (integrationKey === 'mail') {
      this.onMailConfigChanged?.();
    }

    return this.mapToView(integrationKey, null);
  }

  async testIntegration(key: string): Promise<IntegrationItemView> {
    if (!INTEGRATION_KEYS.includes(key as IntegrationKey)) {
      throw new AppError(400, 'VALIDATION', `Invalid integration key: ${key}`);
    }
    const integrationKey = key as IntegrationKey;

    const record = await this.repository.findByKey(integrationKey);
    let baseUrl = '';
    let credentials: StoredCredentials = {} as StoredCredentials;

    if (!record) {
      if (integrationKey === 'mail' && this.envMailConfig) {
        baseUrl = this.envMailConfig.host;
        credentials = {
          port: this.envMailConfig.port,
          secure: this.envMailConfig.secure,
          username: this.envMailConfig.user,
          password: this.envMailConfig.pass,
          fromAddress: this.envMailConfig.from,
        };
      } else {
        throw new AppError(404, 'NOT_FOUND', `Integration '${key}' is not configured`);
      }
    } else {
      baseUrl = record.baseUrl;
      try {
        credentials = JSON.parse(
          this.cryptoService.decrypt(record.credentialsEncrypted),
        );
      } catch {
        // ignore
      }
    }

    // SSRF re-check on HTTP/HTTPS integrations
    if (integrationKey !== 'mail') {
      try {
        validateIntegrationUrl(baseUrl);
      } catch (err: unknown) {
        const lastError = err instanceof Error ? err.message : 'Invalid integration URL';
        if (record) {
          const updated = await this.repository.updateTestStatus(integrationKey, {
            lastStatus: 'failed',
            lastTestedAt: new Date(),
            lastError,
          });
          return this.mapToView(integrationKey, updated);
        }
        return this.mapToView(integrationKey, null);
      }
    }

    const result = await this.tester(integrationKey, {
      baseUrl,
      credentials,
    });

    const now = new Date();
    if (record) {
      const updated = await this.repository.updateTestStatus(integrationKey, {
        lastStatus: result.ok ? 'ok' : 'failed',
        lastTestedAt: now,
        lastError: result.ok ? null : result.error,
      });
      return this.mapToView(integrationKey, updated);
    }

    return this.mapToView(integrationKey, null);
  }

  async testSendMail(to: string, userId?: string): Promise<{ ok: true } | { ok: false; error: string }> {
    void userId;
    const validated = validateAndThrow({
      schema: mailTestSendDto,
      data: { to },
    });

    const record = await this.repository.findByKey('mail');
    let host = '';
    let port = 587;
    let secure = false;
    let username: string | undefined;
    let password: string | undefined;
    let fromAddress = '';

    if (record) {
      host = record.baseUrl;
      const creds: StoredMailCredentials = JSON.parse(
        this.cryptoService.decrypt(record.credentialsEncrypted),
      );
      port = creds.port;
      secure = creds.secure;
      username = creds.username;
      password = creds.password;
      fromAddress = creds.fromAddress;
    } else if (this.envMailConfig) {
      host = this.envMailConfig.host;
      port = this.envMailConfig.port;
      secure = this.envMailConfig.secure;
      username = this.envMailConfig.user;
      password = this.envMailConfig.pass;
      fromAddress = this.envMailConfig.from;
    } else {
      throw new AppError(400, 'MAIL_NOT_CONFIGURED', 'Platform mailer is not configured');
    }

    const auth = username && password ? { user: username, pass: password } : undefined;
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      ...(auth ? { auth } : {}),
      connectionTimeout: 10_000,
    });

    try {
      await transporter.sendMail({
        from: fromAddress,
        to: validated.to,
        subject: 'LokaSlip Platform Mailer Test',
        text: 'This is a test message from your LokaSlip setup.',
        html: '<p>This is a test message from your LokaSlip setup.</p>',
      });
      return { ok: true };
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      const safe = password ? raw.replaceAll(password, '***') : raw;
      return { ok: false, error: safe.slice(0, 500) };
    }
  }
}
