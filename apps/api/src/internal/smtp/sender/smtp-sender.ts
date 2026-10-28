import nodemailer from 'nodemailer';
import type { SmtpInput } from '../../../domain/smtp/dto.js';
import type { SmtpSenderInterface } from '../../../domain/smtp/interface.js';

type TransportConfig = { host: string; port: number; secure: boolean; auth: { user: string; pass: string } };
type Transporter = {
  verify(): Promise<unknown>;
  sendMail(mail: {
    from: string;
    to: string;
    subject: string;
    html: string;
    attachments?: { filename: string; content: Buffer; contentType: string }[];
  }): Promise<unknown>;
};

export function isTransientError(error: unknown): boolean {
  if (!error) return false;

  const code = (error as { code?: string }).code;
  if (code && typeof code === 'string') {
    const transientCodes = ['ECONNREFUSED', 'ECONNRESET', 'ETIMEDOUT', 'ESOCKET', 'ECONNECTION', 'EAI_AGAIN'];
    if (transientCodes.includes(code)) return true;
  }

  const responseCode = (error as { responseCode?: number }).responseCode;
  if (typeof responseCode === 'number' && responseCode >= 400 && responseCode < 500) {
    return true;
  }

  const message = error instanceof Error ? error.message : String(error);
  // Match common error codes or response codes in message string
  if (
    message.includes('ECONNREFUSED') ||
    message.includes('ECONNRESET') ||
    message.includes('ETIMEDOUT') ||
    message.includes('ESOCKET') ||
    message.includes('ECONNECTION') ||
    message.includes('EAI_AGAIN')
  ) {
    return true;
  }

  // SMTP 4xx response codes in message (e.g. 421, 450, 451, 452)
  if (/\b4[0-9]{2}\b/.test(message)) {
    return true;
  }

  return false;
}

export function buildSmtpSender(
  transporterFactory: (config: TransportConfig) => Transporter = (config) => nodemailer.createTransport(config),
): SmtpSenderInterface {
  return {
    async verify(config: SmtpInput): Promise<{ ok: true } | { ok: false; error: string }> {
      try {
        await transporterFactory({ host: config.host, port: config.port, secure: config.secure, auth: { user: config.username, pass: config.password } }).verify();
        return { ok: true };
      } catch {
        return { ok: false, error: 'SMTP verification failed' };
      }
    },
    async sendMail(
      config: SmtpInput,
      mail: {
        from: string;
        to: string;
        subject: string;
        html: string;
        attachments?: { filename: string; content: Buffer; contentType: string }[];
      },
    ): Promise<{ ok: true } | { ok: false; error: string; transient: boolean }> {
      try {
        await transporterFactory({ host: config.host, port: config.port, secure: config.secure, auth: { user: config.username, pass: config.password } }).sendMail(mail);
        return { ok: true };
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error);
        const safe = raw.replaceAll(config.password, '***');
        const transient = isTransientError(error);
        return { ok: false, error: `SMTP send failed: ${safe}`, transient };
      }
    },
  };
}
