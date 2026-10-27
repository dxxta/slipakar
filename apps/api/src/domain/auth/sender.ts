export type AuthEmailMessage = {
  to: string;
  subject: string;
  text?: string;
  html: string;
};

export interface AuthEmailSenderInterface {
  sendMail(message: AuthEmailMessage): Promise<{ ok: true } | { ok: false; error: string }>;
  isConfigured?(): Promise<boolean>;
}
