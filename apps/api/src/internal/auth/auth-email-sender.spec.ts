import { describe, expect, it, vi } from 'vitest';
import { buildAuthEmailSender } from './auth-email-sender.js';

describe('buildAuthEmailSender', () => {
  it('sends email via nodemailer transport and returns { ok: true } on success', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: '123' });
    const factory = vi.fn().mockReturnValue({ sendMail });

    const sender = buildAuthEmailSender({
      config: {
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        user: 'user@example.com',
        pass: 'super-secret',
        from: 'noreply@example.com',
      },
      transporterFactory: factory,
    });

    const result = await sender.sendMail({
      to: 'new@example.com',
      subject: 'Verify your new email',
      html: '<p>Click here</p>',
    });

    expect(result).toEqual({ ok: true });
    expect(factory).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: { user: 'user@example.com', pass: 'super-secret' },
    });
    expect(sendMail).toHaveBeenCalledWith({
      from: 'noreply@example.com',
      to: 'new@example.com',
      subject: 'Verify your new email',
      html: '<p>Click here</p>',
      text: undefined,
    });
  });

  it('redacts password from error message when sendMail fails', async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error('Auth failed for super-secret user'));
    const factory = vi.fn().mockReturnValue({ sendMail });

    const sender = buildAuthEmailSender({
      config: {
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        user: 'user@example.com',
        pass: 'super-secret',
        from: 'noreply@example.com',
      },
      transporterFactory: factory,
    });

    const result = await sender.sendMail({
      to: 'new@example.com',
      subject: 'Verify',
      html: '<p>Click</p>',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).not.toContain('super-secret');
      expect(result.error).toContain('***');
    }
  });

  it('reports error to ErrorReporter if provided', async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error('Connection error'));
    const errorReporter = {
      capture: vi.fn(),
    };

    const sender = buildAuthEmailSender({
      config: {
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        from: 'noreply@example.com',
      },
      transporterFactory: () => ({ sendMail }),
      errorReporter,
    });

    const result = await sender.sendMail({
      to: 'new@example.com',
      subject: 'Verify',
      html: '<p>Click</p>',
    });

    expect(result.ok).toBe(false);
    expect(errorReporter.capture).toHaveBeenCalled();
  });
});
