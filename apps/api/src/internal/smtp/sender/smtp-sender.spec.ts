import { describe, expect, it } from 'vitest';
import { buildSmtpSender } from './smtp-sender.js';

const config = { host: 'smtp.example.com', port: 587, username: 'sender', password: 'secret-123', secure: false };

describe('buildSmtpSender', () => {
  it('returns ok when verification succeeds', async () => {
    const sender = buildSmtpSender(() => ({ verify: async () => true, sendMail: async () => ({}) }));
    await expect(sender.verify(config)).resolves.toEqual({ ok: true });
  });

  it('returns a safe error when verification fails', async () => {
    const sender = buildSmtpSender(() => ({
      verify: async () => { throw new Error(`Authentication failed for ${config.password}`); },
      sendMail: async () => ({}),
    }));
    const result = await sender.verify(config);
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(config.password);
    if (!result.ok) expect(result.error.length).toBeGreaterThan(0);
  });

  it('sendMail returns ok true when transporter.sendMail resolves', async () => {
    const sender = buildSmtpSender(() => ({
      verify: async () => true,
      sendMail: async () => ({ messageId: 'msg-1' }),
    }));
    const result = await sender.sendMail(config, {
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Hello',
      html: '<p>World</p>',
    });
    expect(result).toEqual({ ok: true });
  });

  it('sendMail returns ok false with a message without password when transporter.sendMail rejects', async () => {
    const sender = buildSmtpSender(() => ({
      verify: async () => true,
      sendMail: async () => {
        throw new Error(`Failed to send using password ${config.password}: 535 Auth failed`);
      },
    }));
    const result = await sender.sendMail(config, {
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Hello',
      html: '<p>World</p>',
    });
    expect(result.ok).toBe(false);
    expect(JSON.stringify(result)).not.toContain(config.password);
    if (!result.ok) {
      expect(result.error).toContain('SMTP send failed');
      expect(result.error).not.toContain(config.password);
    }
  });

  it('sendMail forwards attachments to nodemailer transporter', async () => {
    let capturedMail: { attachments?: unknown } | undefined;
    const sender = buildSmtpSender(() => ({
      verify: async () => true,
      sendMail: async (mail) => {
        capturedMail = mail;
        return { messageId: 'msg-1' };
      },
    }));

    const attachments = [
      { filename: 'doc.pdf', content: Buffer.from('%PDF-1.4'), contentType: 'application/pdf' },
    ];

    const result = await sender.sendMail(config, {
      from: 'sender@example.com',
      to: 'recipient@example.com',
      subject: 'Hello',
      html: '<p>World</p>',
      attachments,
    });

    expect(result).toEqual({ ok: true });
    expect(capturedMail.attachments).toEqual(attachments);
  });

  describe('error classification (transient vs permanent)', () => {
    it.each([
      ['ECONNREFUSED', new Error('connect ECONNREFUSED 127.0.0.1:587')],
      ['ECONNRESET', new Error('read ECONNRESET')],
      ['ETIMEDOUT', new Error('connect ETIMEDOUT')],
      ['ESOCKET', Object.assign(new Error('socket error'), { code: 'ESOCKET' })],
      ['ECONNECTION', Object.assign(new Error('connection failed'), { code: 'ECONNECTION' })],
      ['EAI_AGAIN', Object.assign(new Error('getaddrinfo EAI_AGAIN'), { code: 'EAI_AGAIN' })],
      ['421 Service not available', new Error('421 Service not available, closing transmission channel')],
      ['450 Mailbox unavailable', new Error('450 Requested mail action not taken: mailbox busy')],
      ['451 Aborted - local error', new Error('451 Requested action aborted: local error in processing')],
      ['452 Storage exceeded', new Error('452 Requested action not taken: insufficient system storage')],
    ])('classifies %s as transient error', async (_name, error) => {
      const sender = buildSmtpSender(() => ({
        verify: async () => true,
        sendMail: async () => {
          throw error;
        },
      }));

      const result = await sender.sendMail(config, {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Hello',
        html: '<p>World</p>',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.transient).toBe(true);
      }
    });

    it.each([
      ['535 Auth failed', new Error('535 5.7.8 Error: authentication failed')],
      ['550 User not found', new Error('550 5.1.1 <nobody@example.com>: Recipient address rejected')],
      ['554 Transaction failed', new Error('554 Transaction failed')],
      ['Generic Error', new Error('Something went wrong without smtp code')],
    ])('classifies %s as permanent error', async (_name, error) => {
      const sender = buildSmtpSender(() => ({
        verify: async () => true,
        sendMail: async () => {
          throw error;
        },
      }));

      const result = await sender.sendMail(config, {
        from: 'sender@example.com',
        to: 'recipient@example.com',
        subject: 'Hello',
        html: '<p>World</p>',
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.transient).toBe(false);
      }
    });
  });
});
