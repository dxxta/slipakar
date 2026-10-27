import nodemailer from 'nodemailer';
import type { AuthEmailMessage, AuthEmailSenderInterface } from '../../domain/auth/sender.js';
import type { ErrorReporter } from '../../domain/error-reporting/interface.js';

export type AuthEmailSenderConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
};

type TransportConfig = {
  host: string;
  port: number;
  secure: boolean;
  auth?: { user: string; pass: string };
};

type Transporter = {
  sendMail(mail: {
    from: string;
    to: string;
    subject: string;
    text?: string;
    html: string;
  }): Promise<unknown>;
};

export function buildAuthEmailSender({
  config,
  transporterFactory = (transportConfig) => nodemailer.createTransport(transportConfig),
  errorReporter,
}: {
  config: AuthEmailSenderConfig;
  transporterFactory?: (transportConfig: TransportConfig) => Transporter;
  errorReporter?: ErrorReporter;
}): AuthEmailSenderInterface {
  const auth = config.user && config.pass ? { user: config.user, pass: config.pass } : undefined;
  const transporter = transporterFactory({
    host: config.host,
    port: config.port,
    secure: config.secure,
    ...(auth ? { auth } : {}),
  });

  return {
    async sendMail(message: AuthEmailMessage): Promise<{ ok: true } | { ok: false; error: string }> {
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

        if (errorReporter) {
          errorReporter.capture(
            error instanceof Error ? error : new Error(safeError),
            { to: message.to, subject: message.subject },
          );
        }

        return { ok: false, error: safeError };
      }
    },
  };
}
