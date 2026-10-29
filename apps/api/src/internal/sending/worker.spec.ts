import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { AuditRepositoryInterface } from '../../../domain/audit/interface.js';
import type { QueuePublisher } from '../../../domain/queue/interface.js';
import type { SmtpSenderInterface } from '../../../domain/smtp/interface.js';
import type { CryptoServiceInterface } from '../../../services/crypto.js';
import type { RateLimiterInterface } from './rate-limiter.js';
import type { StorageInterface } from '../../../domain/storage/interface.js';
import type { PdfRendererInterface } from '../../../domain/pdf/interface.js';
import type { AttachmentStoreInterface } from '../../attachments/attachment-store.js';
import { buildSendWorker } from './worker.js';

describe('SendWorker unit tests', () => {
  let fakeCrypto: CryptoServiceInterface;
  let fakeEngine: { renderTemplate: ReturnType<typeof vi.fn> };
  let fakeRateLimiter: RateLimiterInterface;
  let fakeSender: SmtpSenderInterface;
  let fakeQueue: QueuePublisher;
  let fakeAudit: AuditRepositoryInterface;
  let txRecipientUpdate: ReturnType<typeof vi.fn>;
  let txRecipientCount: ReturnType<typeof vi.fn>;
  let txCampaignUpdateMany: ReturnType<typeof vi.fn>;
  let fakeTx: Prisma.TransactionClient;
  let findUniqueMock: ReturnType<typeof vi.fn>;
  let recipientUpdateMock: ReturnType<typeof vi.fn>;
  let recipientCountMock: ReturnType<typeof vi.fn>;
  let campaignUpdateManyMock: ReturnType<typeof vi.fn>;
  let fieldMappingFindFirstMock: ReturnType<typeof vi.fn>;
  let attachmentFindManyMock: ReturnType<typeof vi.fn>;
  let pdfTemplateFindUniqueMock: ReturnType<typeof vi.fn>;
  let prismaMock: PrismaClient;
  let fakeStorage: StorageInterface;
  let fakePdfRenderer: PdfRendererInterface;
  let fakeAttachmentStore: AttachmentStoreInterface;

  beforeEach(() => {
    fakeCrypto = {
      encrypt: (v) => `enc:${v}`,
      decrypt: () => 'decrypted-pass',
    };

    fakeEngine = {
      renderTemplate: vi.fn().mockImplementation((tpl: { subject: string; bodyHtml: string }, row: Record<string, string>) => {
        if (tpl.subject.includes('{{missing}}')) {
          throw new Error('Unresolved placeholders: missing');
        }
        return {
          subject: `Hello ${row.name ?? ''}`,
          body: `<p>Hello ${row.name ?? ''}</p>`,
        };
      }),
    };

    fakeRateLimiter = {
      tryAcquire: vi.fn().mockResolvedValue({ allowed: true }),
    };

    fakeSender = {
      verify: vi.fn().mockResolvedValue({ ok: true }),
      sendMail: vi.fn().mockResolvedValue({ ok: true }),
    };

    fakeQueue = {
      publishSendEmail: vi.fn().mockResolvedValue(undefined),
      publishNotify: vi.fn().mockResolvedValue(undefined),
    };

    fakeAudit = {
      createAuditRepository: vi.fn().mockResolvedValue({ data: { count: 1 } }),
    };

    txRecipientUpdate = vi.fn().mockResolvedValue({ id: 'r-1' });
    txRecipientCount = vi.fn().mockResolvedValue(0);
    txCampaignUpdateMany = vi.fn().mockResolvedValue({ count: 1 });

    fakeTx = {
      campaignRecipient: {
        update: txRecipientUpdate,
        count: txRecipientCount,
      },
      campaign: {
        updateMany: txCampaignUpdateMany,
      },
    } as unknown as Prisma.TransactionClient;

    findUniqueMock = vi.fn();
    recipientUpdateMock = vi.fn();
    recipientCountMock = vi.fn();
    campaignUpdateManyMock = vi.fn();
    fieldMappingFindFirstMock = vi.fn();
    attachmentFindManyMock = vi.fn().mockResolvedValue([]);
    pdfTemplateFindUniqueMock = vi.fn();

    prismaMock = {
      campaignRecipient: {
        findUnique: findUniqueMock,
        update: recipientUpdateMock,
        count: recipientCountMock,
      },
      campaign: {
        updateMany: campaignUpdateManyMock,
      },
      fieldMapping: {
        findFirst: fieldMappingFindFirstMock,
      },
      attachment: {
        findMany: attachmentFindManyMock,
      },
      pdfTemplate: {
        findUnique: pdfTemplateFindUniqueMock,
      },
      $transaction: async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => fn(fakeTx),
    } as unknown as PrismaClient;

    fakeStorage = {
      ensureBucket: vi.fn(),
      putObject: vi.fn().mockResolvedValue(undefined),
      getObject: vi.fn().mockResolvedValue(Buffer.from('attachment bytes')),
      deleteObject: vi.fn().mockResolvedValue(undefined),
      objectExists: vi.fn().mockResolvedValue(true),
    };

    fakePdfRenderer = {
      renderPdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 rendered')),
    };

    fakeAttachmentStore = {
      storeAttachment: vi.fn().mockResolvedValue({ id: 'gen-att-1' }),
      removeAttachment: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('idempotent skip when recipient is already sent', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 'r-1',
      campaignId: 'c-1',
      status: 'sent',
      campaign: { status: 'sending' },
    });

    const worker = buildSendWorker({
      prisma: prismaMock,
      queue: fakeQueue,
      cryptoService: fakeCrypto,
      sender: fakeSender,
      rateLimiter: fakeRateLimiter,
      engine: fakeEngine,
      auditRepository: fakeAudit,
    });

    await worker.handleSendEmail({ campaignId: 'c-1', recipientId: 'r-1' });

    expect(fakeSender.sendMail).not.toHaveBeenCalled();
    expect(fakeQueue.publishNotify).not.toHaveBeenCalled();
  });

  it('idempotent skip when campaign is draft', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 'r-1',
      campaignId: 'c-1',
      status: 'pending',
      campaign: { status: 'draft' },
    });

    const worker = buildSendWorker({
      prisma: prismaMock,
      queue: fakeQueue,
      cryptoService: fakeCrypto,
      sender: fakeSender,
      rateLimiter: fakeRateLimiter,
      engine: fakeEngine,
      auditRepository: fakeAudit,
    });

    await worker.handleSendEmail({ campaignId: 'c-1', recipientId: 'r-1' });

    expect(fakeSender.sendMail).not.toHaveBeenCalled();
  });

  it('campaign without pdfTemplateId behaves as before', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 'r-1',
      campaignId: 'c-1',
      status: 'pending',
      rowIndex: 0,
      email: 'user@example.com',
      campaign: {
        id: 'c-1',
        projectId: 'p-1',
        status: 'sending',
        smtpConnectionId: 'smtp-1',
        emailTemplateId: 'tpl-1',
        uploadId: 'up-1',
        emailTemplate: { subject: 'Hi {{name}}', bodyHtml: '<p>Hi</p>' },
        smtpConnection: { id: 'smtp-1', host: 'smtp.test', port: 587, secure: false, username: 'sender@test', passwordEncrypted: 'enc:pass' },
        upload: { rows: [{ name: 'Alice', email: 'user@example.com' }] },
        project: { rateLimitPerMinute: 60 },
      },
    });

    fieldMappingFindFirstMock.mockResolvedValueOnce({ mapping: { name: 'name' } });

    const worker = buildSendWorker({
      prisma: prismaMock,
      queue: fakeQueue,
      cryptoService: fakeCrypto,
      sender: fakeSender,
      rateLimiter: fakeRateLimiter,
      engine: fakeEngine,
      auditRepository: fakeAudit,
    });

    await worker.handleSendEmail({ campaignId: 'c-1', recipientId: 'r-1' });

    expect(fakeSender.sendMail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        from: 'sender@test',
        to: 'user@example.com',
        subject: 'Hello Alice',
        attachments: undefined,
      }),
    );
  });

  it('PDF rendered and attached, shared attachments attached', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 'r-1',
      campaignId: 'c-1',
      status: 'pending',
      rowIndex: 0,
      email: 'user@example.com',
      campaign: {
        id: 'c-1',
        projectId: 'p-1',
        status: 'sending',
        smtpConnectionId: 'smtp-1',
        emailTemplateId: 'tpl-1',
        pdfTemplateId: 'pdf-tpl-1',
        uploadId: 'up-1',
        emailTemplate: { subject: 'Hi {{name}}', bodyHtml: '<p>Hi</p>' },
        smtpConnection: { id: 'smtp-1', host: 'smtp.test', port: 587, secure: false, username: 'sender@test', fromAddress: 'custom-from@test', passwordEncrypted: 'enc:pass' },
        upload: { rows: [{ name: 'Alice', email: 'user@example.com' }] },
        project: { rateLimitPerMinute: 60 },
      },
    });

    attachmentFindManyMock
      .mockResolvedValueOnce([{ id: 'extra-1', fileName: 'extra.pdf', objectKey: 'p-1/extra.pdf' }])
      .mockResolvedValueOnce([]);

    pdfTemplateFindUniqueMock.mockResolvedValueOnce({
      id: 'pdf-tpl-1',
      nodeTree: { page: { size: 'A4', margin: 0 }, nodes: [] },
    });

    fieldMappingFindFirstMock.mockResolvedValueOnce({ mapping: { name: 'name' } });

    const worker = buildSendWorker({
      prisma: prismaMock,
      queue: fakeQueue,
      cryptoService: fakeCrypto,
      sender: fakeSender,
      rateLimiter: fakeRateLimiter,
      engine: fakeEngine,
      auditRepository: fakeAudit,
      storage: fakeStorage,
      pdfRenderer: fakePdfRenderer,
      attachmentStore: fakeAttachmentStore,
    });

    await worker.handleSendEmail({ campaignId: 'c-1', recipientId: 'r-1' });

    expect(fakePdfRenderer.renderPdf).toHaveBeenCalledWith({
      projectId: 'p-1',
      tree: { page: { size: 'A4', margin: 0 }, nodes: [] },
      row: { name: 'Alice' },
    });

    expect(fakeAttachmentStore.storeAttachment).toHaveBeenCalledWith({
      projectId: 'p-1',
      campaignId: 'c-1',
      fileName: 'document-row-1.pdf',
      buffer: Buffer.from('%PDF-1.4 rendered'),
      contentType: 'application/pdf',
      kind: 'generated',
      auditUserId: 'system',
    });

    expect(fakeSender.sendMail).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        from: 'custom-from@test',
        to: 'user@example.com',
        attachments: [
          { filename: 'extra.pdf', content: Buffer.from('attachment bytes'), contentType: 'application/pdf' },
          { filename: 'document-row-1.pdf', content: Buffer.from('%PDF-1.4 rendered'), contentType: 'application/pdf' },
        ],
      }),
    );
  });

  it('quota exceeded marks failed with safe message', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 'r-1',
      campaignId: 'c-1',
      status: 'pending',
      rowIndex: 0,
      email: 'user@example.com',
      campaign: {
        id: 'c-1',
        projectId: 'p-1',
        status: 'sending',
        smtpConnectionId: 'smtp-1',
        emailTemplateId: 'tpl-1',
        pdfTemplateId: 'pdf-tpl-1',
        uploadId: 'up-1',
        emailTemplate: { subject: 'Hi', bodyHtml: '<p>Hi</p>' },
        smtpConnection: { id: 'smtp-1', host: 'smtp.test', port: 587, secure: false, username: 'sender@test', passwordEncrypted: 'enc:pass' },
        upload: { rows: [{ name: 'Alice' }] },
        project: { rateLimitPerMinute: 60 },
      },
    });

    attachmentFindManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    pdfTemplateFindUniqueMock.mockResolvedValueOnce({
      id: 'pdf-tpl-1',
      nodeTree: { page: { size: 'A4', margin: 0 }, nodes: [] },
    });

    fieldMappingFindFirstMock.mockResolvedValueOnce(null);

    const quotaStore = {
      storeAttachment: vi.fn().mockRejectedValue({
        status: 413,
        code: 'STORAGE_QUOTA_EXCEEDED',
        message: 'Storage quota exceeded',
      }),
      removeAttachment: vi.fn(),
    };

    const worker = buildSendWorker({
      prisma: prismaMock,
      queue: fakeQueue,
      cryptoService: fakeCrypto,
      sender: fakeSender,
      rateLimiter: fakeRateLimiter,
      engine: fakeEngine,
      auditRepository: fakeAudit,
      storage: fakeStorage,
      pdfRenderer: fakePdfRenderer,
      attachmentStore: quotaStore,
    });

    await worker.handleSendEmail({ campaignId: 'c-1', recipientId: 'r-1' });

    expect(fakeSender.sendMail).not.toHaveBeenCalled();
    expect(txRecipientUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'failed',
          errorMessage: expect.stringContaining('Storage quota exceeded'),
        }),
      }),
    );
    expect(fakeQueue.publishNotify).toHaveBeenCalledWith({
      type: 'send_failed',
      projectId: 'p-1',
      campaignId: 'c-1',
      message: 'Sending to row 0 failed',
    });
  });

  it('render error marks failed', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 'r-1',
      campaignId: 'c-1',
      status: 'pending',
      rowIndex: 0,
      email: 'user@example.com',
      campaign: {
        id: 'c-1',
        projectId: 'p-1',
        status: 'sending',
        smtpConnectionId: 'smtp-1',
        emailTemplateId: 'tpl-1',
        pdfTemplateId: 'pdf-tpl-1',
        uploadId: 'up-1',
        emailTemplate: { subject: 'Hi', bodyHtml: '<p>Hi</p>' },
        smtpConnection: { id: 'smtp-1', host: 'smtp.test', port: 587, secure: false, username: 'sender@test', passwordEncrypted: 'enc:pass' },
        upload: { rows: [{ name: 'Alice' }] },
        project: { rateLimitPerMinute: 60 },
      },
    });

    attachmentFindManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    pdfTemplateFindUniqueMock.mockResolvedValueOnce({
      id: 'pdf-tpl-1',
      nodeTree: { page: { size: 'A4', margin: 0 }, nodes: [] },
    });

    fieldMappingFindFirstMock.mockResolvedValueOnce(null);

    const failingPdfRenderer = {
      renderPdf: vi.fn().mockRejectedValue(new Error('Unresolved placeholders: missingField')),
    };

    const worker = buildSendWorker({
      prisma: prismaMock,
      queue: fakeQueue,
      cryptoService: fakeCrypto,
      sender: fakeSender,
      rateLimiter: fakeRateLimiter,
      engine: fakeEngine,
      auditRepository: fakeAudit,
      storage: fakeStorage,
      pdfRenderer: failingPdfRenderer,
      attachmentStore: fakeAttachmentStore,
    });

    await worker.handleSendEmail({ campaignId: 'c-1', recipientId: 'r-1' });

    expect(fakeSender.sendMail).not.toHaveBeenCalled();
    expect(txRecipientUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'failed',
          errorMessage: expect.stringContaining('missingField'),
        }),
      }),
    );
  });

  it('retry replaces previous generated attachment instead of adding a second', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 'r-1',
      campaignId: 'c-1',
      status: 'pending',
      rowIndex: 1,
      email: 'user@example.com',
      campaign: {
        id: 'c-1',
        projectId: 'p-1',
        status: 'sending',
        smtpConnectionId: 'smtp-1',
        emailTemplateId: 'tpl-1',
        pdfTemplateId: 'pdf-tpl-1',
        uploadId: 'up-1',
        emailTemplate: { subject: 'Hi', bodyHtml: '<p>Hi</p>' },
        smtpConnection: { id: 'smtp-1', host: 'smtp.test', port: 587, secure: false, username: 'sender@test', passwordEncrypted: 'enc:pass' },
        upload: { rows: [{}, { name: 'Bob' }] },
        project: { rateLimitPerMinute: 60 },
      },
    });

    attachmentFindManyMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'old-gen-1', fileName: 'document-row-2.pdf' }]);

    pdfTemplateFindUniqueMock.mockResolvedValueOnce({
      id: 'pdf-tpl-1',
      nodeTree: { page: { size: 'A4', margin: 0 }, nodes: [] },
    });

    fieldMappingFindFirstMock.mockResolvedValueOnce(null);

    const worker = buildSendWorker({
      prisma: prismaMock,
      queue: fakeQueue,
      cryptoService: fakeCrypto,
      sender: fakeSender,
      rateLimiter: fakeRateLimiter,
      engine: fakeEngine,
      auditRepository: fakeAudit,
      storage: fakeStorage,
      pdfRenderer: fakePdfRenderer,
      attachmentStore: fakeAttachmentStore,
    });

    await worker.handleSendEmail({ campaignId: 'c-1', recipientId: 'r-1' });

    expect(fakeAttachmentStore.removeAttachment).toHaveBeenCalledWith({
      id: 'old-gen-1',
      projectId: 'p-1',
      auditUserId: 'system',
    });
    expect(fakeAttachmentStore.storeAttachment).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: 'document-row-2.pdf' }),
    );
  });

  it('rejects when campaign has pdfTemplateId but pdfRenderer is missing', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 'r-1',
      campaignId: 'c-1',
      status: 'pending',
      rowIndex: 0,
      email: 'user@example.com',
      campaign: {
        id: 'c-1',
        projectId: 'p-1',
        status: 'sending',
        smtpConnectionId: 'smtp-1',
        emailTemplateId: 'tpl-1',
        pdfTemplateId: 'pdf-tpl-1',
        uploadId: 'up-1',
        emailTemplate: { subject: 'Hi', bodyHtml: '<p>Hi</p>' },
        smtpConnection: {
          id: 'smtp-1',
          host: 'smtp.test',
          port: 587,
          secure: false,
          username: 'sender@test',
          passwordEncrypted: 'enc:pass',
          fromAddress: 'sender@test',
        },
        upload: { rows: [{ name: 'Alice' }] },
        project: { rateLimitPerMinute: 60 },
      },
    });

    const workerWithoutPdf = buildSendWorker({
      prisma: prismaMock,
      queue: fakeQueue,
      cryptoService: fakeCrypto,
      sender: fakeSender,
      rateLimiter: fakeRateLimiter,
      engine: fakeEngine,
      auditRepository: fakeAudit,
      storage: fakeStorage,
      // pdfRenderer is omitted
      attachmentStore: fakeAttachmentStore,
    });

    await expect(
      workerWithoutPdf.handleSendEmail({ campaignId: 'c-1', recipientId: 'r-1' }),
    ).rejects.toThrow('PDF rendering is not configured');

    expect(fakeSender.sendMail).not.toHaveBeenCalled();
    expect(txRecipientUpdate).not.toHaveBeenCalled();
  });

  it('records metrics when metrics dependency is passed', async () => {
    findUniqueMock.mockResolvedValueOnce({
      id: 'r-1',
      campaignId: 'c-1',
      status: 'pending',
      rowIndex: 0,
      email: 'user@example.com',
      campaign: {
        id: 'c-1',
        projectId: 'p-1',
        status: 'sending',
        smtpConnectionId: 'smtp-1',
        emailTemplateId: 'tpl-1',
        uploadId: 'up-1',
        emailTemplate: { subject: 'Hi', bodyHtml: '<p>Hi</p>' },
        smtpConnection: { id: 'smtp-1', host: 'smtp.test', port: 587, secure: false, username: 'sender@test', passwordEncrypted: 'enc:pass' },
        upload: { rows: [{ name: 'Alice' }] },
        project: { rateLimitPerMinute: 60 },
      },
    });

    fieldMappingFindFirstMock.mockResolvedValueOnce(null);
    attachmentFindManyMock.mockResolvedValueOnce([]);

    // Rate limiter delays once
    const rateLimiterWithDelay: RateLimiterInterface = {
      tryAcquire: vi
        .fn()
        .mockResolvedValueOnce({ allowed: false, retryAfterMs: 1500 })
        .mockResolvedValueOnce({ allowed: true }),
    };

    const fakeMetrics = {
      recordHttpRequest: vi.fn(),
      recordEmailResult: vi.fn(),
      recordQueueMessage: vi.fn(),
      recordRateLimitWait: vi.fn(),
      recordCampaignFinished: vi.fn(),
      render: vi.fn().mockResolvedValue(''),
      contentType: 'text/plain',
    };

    const sleepMock = vi.fn().mockResolvedValue(undefined);

    const worker = buildSendWorker({
      prisma: prismaMock,
      queue: fakeQueue,
      cryptoService: fakeCrypto,
      sender: fakeSender,
      rateLimiter: rateLimiterWithDelay,
      engine: fakeEngine,
      auditRepository: fakeAudit,
      sleep: sleepMock,
      metrics: fakeMetrics,
    });

    await worker.handleSendEmail({ campaignId: 'c-1', recipientId: 'r-1' });

    expect(fakeMetrics.recordRateLimitWait).toHaveBeenCalledWith(1.5);
    expect(fakeMetrics.recordEmailResult).toHaveBeenCalledWith('sent');
    expect(fakeMetrics.recordCampaignFinished).toHaveBeenCalledTimes(1);
  });

  describe('transient error retry and error reporting', () => {
    const mockPendingRecipient = (recipientId = 'r-1') => ({
      id: recipientId,
      campaignId: 'c-1',
      status: 'pending',
      rowIndex: 0,
      email: 'user@example.com',
      campaign: {
        id: 'c-1',
        projectId: 'p-1',
        status: 'sending',
        smtpConnectionId: 'smtp-1',
        emailTemplateId: 'tpl-1',
        uploadId: 'up-1',
        emailTemplate: { subject: 'Hi', bodyHtml: '<p>Hi</p>' },
        smtpConnection: {
          id: 'smtp-1',
          host: 'smtp.test',
          port: 587,
          secure: false,
          username: 'sender@test',
          passwordEncrypted: 'enc:pass',
          fromAddress: 'sender@test',
        },
        upload: { rows: [{ name: 'Alice' }] },
        project: { rateLimitPerMinute: 60 },
      },
    });

    it('transient retry is published with attempt+1, recipient not failed, and campaign not finished', async () => {
      findUniqueMock.mockResolvedValueOnce(mockPendingRecipient());
      fieldMappingFindFirstMock.mockResolvedValueOnce(null);
      attachmentFindManyMock.mockResolvedValueOnce([]);

      const transientSender: SmtpSenderInterface = {
        verify: vi.fn(),
        sendMail: vi.fn().mockResolvedValue({
          ok: false,
          error: 'SMTP send failed: ECONNREFUSED',
          transient: true,
        }),
      };

      const worker = buildSendWorker({
        prisma: prismaMock,
        queue: fakeQueue,
        cryptoService: fakeCrypto,
        sender: transientSender,
        rateLimiter: fakeRateLimiter,
        engine: fakeEngine,
        auditRepository: fakeAudit,
        maxAttempts: 5,
        retryScheduleMs: [100, 200, 300, 400, 500],
      });

      await worker.handleSendEmail({ campaignId: 'c-1', recipientId: 'r-1', attempt: 1 });

      // Retry published with attempt 2 and delay from schedule (100ms)
      expect(fakeQueue.publishSendEmail).toHaveBeenCalledWith(
        { campaignId: 'c-1', recipientId: 'r-1', attempt: 2 },
        { delayMs: 100 },
      );

      // Recipient not marked failed or sent
      expect(txRecipientUpdate).not.toHaveBeenCalled();
      // Campaign completion not triggered
      expect(fakeQueue.publishNotify).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'campaign_finished' }),
      );
    });

    it('exhausted attempts mark recipient failed with safe message and checks campaign completion', async () => {
      findUniqueMock.mockResolvedValueOnce(mockPendingRecipient());
      fieldMappingFindFirstMock.mockResolvedValueOnce(null);
      attachmentFindManyMock.mockResolvedValueOnce([]);
      recipientCountMock.mockResolvedValueOnce(0); // 0 pending -> triggers completion
      campaignUpdateManyMock.mockResolvedValueOnce({ count: 1 });

      const transientSender: SmtpSenderInterface = {
        verify: vi.fn(),
        sendMail: vi.fn().mockResolvedValue({
          ok: false,
          error: 'SMTP send failed: connect ETIMEDOUT 10.0.0.1:587',
          transient: true,
        }),
      };

      const worker = buildSendWorker({
        prisma: prismaMock,
        queue: fakeQueue,
        cryptoService: fakeCrypto,
        sender: transientSender,
        rateLimiter: fakeRateLimiter,
        engine: fakeEngine,
        auditRepository: fakeAudit,
        maxAttempts: 3,
      });

      // Called with attempt 3 (exhausted)
      await worker.handleSendEmail({ campaignId: 'c-1', recipientId: 'r-1', attempt: 3 });

      // No retry published
      expect(fakeQueue.publishSendEmail).not.toHaveBeenCalled();

      // Recipient marked failed with safe message
      expect(txRecipientUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'r-1' },
          data: {
            status: 'failed',
            errorMessage: 'SMTP server unavailable after 3 attempts',
          },
        }),
      );

      // Notify send_failed and campaign_finished published
      expect(fakeQueue.publishNotify).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'send_failed' }),
      );
      expect(fakeQueue.publishNotify).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'campaign_finished' }),
      );
    });

    it('permanent failure fails immediately without retry', async () => {
      findUniqueMock.mockResolvedValueOnce(mockPendingRecipient());
      fieldMappingFindFirstMock.mockResolvedValueOnce(null);
      attachmentFindManyMock.mockResolvedValueOnce([]);
      recipientCountMock.mockResolvedValueOnce(0);
      campaignUpdateManyMock.mockResolvedValueOnce({ count: 1 });

      const permanentSender: SmtpSenderInterface = {
        verify: vi.fn(),
        sendMail: vi.fn().mockResolvedValue({
          ok: false,
          error: 'SMTP send failed: 550 User not found',
          transient: false,
        }),
      };

      const worker = buildSendWorker({
        prisma: prismaMock,
        queue: fakeQueue,
        cryptoService: fakeCrypto,
        sender: permanentSender,
        rateLimiter: fakeRateLimiter,
        engine: fakeEngine,
        auditRepository: fakeAudit,
        maxAttempts: 5,
      });

      await worker.handleSendEmail({ campaignId: 'c-1', recipientId: 'r-1', attempt: 1 });

      expect(fakeQueue.publishSendEmail).not.toHaveBeenCalled();
      expect(txRecipientUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'r-1' },
          data: {
            status: 'failed',
            errorMessage: 'SMTP send failed: 550 User not found',
          },
        }),
      );
    });

    it('calls errorReporter.capture on failed attempt, and ignores throwing reporter', async () => {
      findUniqueMock.mockResolvedValueOnce(mockPendingRecipient());
      fieldMappingFindFirstMock.mockResolvedValueOnce(null);
      attachmentFindManyMock.mockResolvedValueOnce([]);

      const transientSender: SmtpSenderInterface = {
        verify: vi.fn(),
        sendMail: vi.fn().mockResolvedValue({
          ok: false,
          error: 'SMTP send failed: ECONNRESET',
          transient: true,
        }),
      };

      const throwingReporter = {
        capture: vi.fn().mockImplementation(() => {
          throw new Error('Sentry boom');
        }),
      };

      const worker = buildSendWorker({
        prisma: prismaMock,
        queue: fakeQueue,
        cryptoService: fakeCrypto,
        sender: transientSender,
        rateLimiter: fakeRateLimiter,
        engine: fakeEngine,
        auditRepository: fakeAudit,
        errorReporter: throwingReporter,
      });

      // Should not throw even though errorReporter threw
      await expect(
        worker.handleSendEmail({ campaignId: 'c-1', recipientId: 'r-1', attempt: 1 }),
      ).resolves.toBeUndefined();

      expect(throwingReporter.capture).toHaveBeenCalledWith(
        expect.anything(),
        {
          campaignId: 'c-1',
          recipientId: 'r-1',
          attempt: 1,
          transient: true,
        },
      );
    });
  });
});
