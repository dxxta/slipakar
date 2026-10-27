import nodemailer from 'nodemailer';
import type { AuthEmailMessage, AuthEmailSenderInterface } from '../../domain/auth/sender.js';
import type { ErrorReporter } from '../../domain/error-reporting/interface.js';
import type { AdminSetupRepositoryInterface } from '../../domain/admin-setup/interface.js';
import type { StoredMailCredentials } from '../../domain/admin-setup/interface.js';
import type { CryptoServiceInterface } from '../../services/crypto.js';
import type { AuthEmailSenderConfig } from './auth-email-sender.js';

type CachedConfig = {
  config: AuthEmailSenderConfig | null;
  expiresAt: number;
};

export class DynamicAuthEmailSender implements AuthEmailSenderInterface {
  private cache: CachedConfig | null = null;
  private readonly ttlMs: number = 30_000;

  constructor(
    private readonly repository: AdminSetupRepositoryInterface,
    private readonly cryptoService: CryptoServiceInterface,
    private readonly envFallback?: AuthEmailSenderConfig,
    private readonly errorReporter?: ErrorReporter,
  ) {}

  invalidate(): void {
    this.cache = null;
  }

  async resolveConfig(): Promise<AuthEmailSenderConfig | null> {
    const now = Date.now();
    if (this.cache && this.cache.expiresAt > now) {
      return this.cache.config;
    }

    let config: AuthEmailSenderConfig | null = null;
    try {
      const dbRecord = await this.repository.findByKey('mail');
      if (dbRecord) {
        const creds: StoredMailCredentials = JSON.parse(
          this.cryptoService.decrypt(dbRecord.credentialsEncrypted),
        );
        config = {
          host: dbRecord.baseUrl,
          port: creds.port,
          secure: creds.secure,
          user: creds.username,
          pass: creds.password,
          from: creds.fromAddress,
        };
      }
    } catch {
      // Ignore decryption/parse errors and fall back to env
    }

    if (!config && this.envFallback) {
      config = this.envFallback;
    }

    this.cache = {
      config,
      expiresAt: now + this.ttlMs,
    };

    return config;
  }

  async isConfigured(): Promise<boolean> {
    const config = await this.resolveConfig();
    return config !== null;
  }

  async sendMail(message: AuthEmailMessage): Promise<{ ok: true } | { ok: false; error: string }> {
    const config = await this.resolveConfig();
    if (!config) {
      return { ok: false, error: 'Platform mailer is not configured' };
    }

    const auth = config.user && config.pass ? { user: config.user, pass: config.pass } : undefined;
    const transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      ...(auth ? { auth } : {}),
    });

    try {
      await transporter.sendMail({
        from: config.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        html: message.html,
      });
      return { ok: true };
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error);
      const safe = config.pass ? raw.replaceAll(config.pass, '***') : raw;
      const safeError = `Auth email send failed: ${safe}`;

      if (this.errorReporter) {
        this.errorReporter.capture(
          error instanceof Error ? error : new Error(safeError),
          { to: message.to, subject: message.subject },
        );
      }

      return { ok: false, error: safeError };
    }
  }
}
