import { describe, expect, it, vi } from 'vitest';
import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  CampaignDetailView,
  CampaignRecipientView,
  CampaignsRepositoryInterface,
  CampaignView,
} from '../../../domain/campaigns/interface.js';
import type { QueuePublisher } from '../../../domain/queue/interface.js';
import { buildCampaignsUseCase } from './campaigns.js';

const mockCampaign: CampaignView = {
  id: 'c-1',
  projectId: 'proj-1',
  emailTemplateId: 'tpl-1',
  pdfTemplateId: null,
  smtpConnectionId: 'smtp-1',
  uploadId: 'up-1',
  emailColumn: 'email',
  status: 'draft',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRecipientPending: CampaignRecipientView = {
  id: 'r-1',
  campaignId: 'c-1',
  rowIndex: 0,
  email: 'user1@example.com',
  status: 'pending',
  errorMessage: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockRecipientFailed: CampaignRecipientView = {
  id: 'r-2',
  campaignId: 'c-1',
  rowIndex: 1,
  email: 'user2@example.com',
  status: 'failed',
  errorMessage: 'SMTP error',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const fakeTx = {} as unknown as Prisma.TransactionClient;
const fakePrisma = {
  $transaction: async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => fn(fakeTx),
} as PrismaClient;

function makeFakeRepository(overrides: Partial<CampaignsRepositoryInterface> = {}): CampaignsRepositoryInterface {
  return {
    createCampaignsRepository: vi.fn().mockResolvedValue({ data: mockCampaign }),
    findAllCampaignsRepository: vi.fn().mockResolvedValue({ data: [mockCampaign] }),
    findByIdCampaignsRepository: vi.fn().mockResolvedValue({
      data: {
        ...mockCampaign,
        counts: { pending: 1, sent: 0, failed: 0, total: 1 },
      } as CampaignDetailView,
    }),
    findRecipientsCampaignsRepository: vi.fn().mockResolvedValue({
      data: [mockRecipientPending],
      metadata: { total: 1 },
    }),
    findRecipientByIdCampaignsRepository: vi.fn().mockResolvedValue({ data: mockRecipientPending }),
    markSendingCampaignsRepository: vi.fn().mockResolvedValue(1),
    revertToDraftCampaignsRepository: vi.fn().mockResolvedValue(undefined),
    resetRecipientCampaignsRepository: vi.fn().mockResolvedValue(mockRecipientPending),
    setCampaignStatusCampaignsRepository: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeFakeQueue(overrides: Partial<QueuePublisher> = {}): QueuePublisher {
  return {
    publishSendEmail: vi.fn().mockResolvedValue(undefined),
    publishNotify: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('campaigns usecase', () => {
  const validLookups = {
    templateLookup: vi.fn().mockResolvedValue({ subject: 'Hello {{name}}', bodyHtml: '<p>Hi {{name}}</p>' }),
    smtpLookup: vi.fn().mockResolvedValue({ id: 'smtp-1' }),
    uploadLookup: vi.fn().mockResolvedValue({
      columns: ['name', 'email'],
      rows: [
        { name: 'Alice', email: 'alice@example.com' },
        { name: 'Bob', email: 'bob@example.com' },
      ],
    }),
    mappingLookup: vi.fn().mockResolvedValue({ name: 'name' }),
    projectLookup: vi.fn().mockResolvedValue(true),
  };

  it('createCampaignsUseCase creates campaign and pending recipients when mapping and emails are valid', async () => {
    const repository = makeFakeRepository();
    const queue = makeFakeQueue();
    const useCase = buildCampaignsUseCase({
      repository,
      prisma: fakePrisma,
      queue,
      ...validLookups,
    });

    const result = await useCase.createCampaignsUseCase({
      projectId: 'proj-1',
      auditUserId: 'u-1',
      payload: {
        emailTemplateId: 'tpl-1',
        smtpConnectionId: 'smtp-1',
        uploadId: 'up-1',
        emailColumn: 'email',
      },
    });

    expect(result.success).toBe(true);
    expect(repository.createCampaignsRepository).toHaveBeenCalledTimes(1);
    const args = vi.mocked(repository.createCampaignsRepository).mock.calls[0][0];
    expect(args.payload.recipients).toHaveLength(2);
    expect(args.payload.recipients[0]).toEqual({ email: 'alice@example.com', rowIndex: 0 });
    expect(args.payload.recipients[1]).toEqual({ email: 'bob@example.com', rowIndex: 1 });
  });

  it('createCampaignsUseCase validates union of placeholders and sets pdfTemplateId when provided', async () => {
    const repository = makeFakeRepository();
    const queue = makeFakeQueue();
    const pdfTemplateLookup = vi.fn().mockImplementation(async (_pId, id) =>
      id === 'pdf-1' ? { placeholders: ['tax_id'] } : null,
    );

    const useCase = buildCampaignsUseCase({
      repository,
      prisma: fakePrisma,
      queue,
      ...validLookups,
      uploadLookup: vi.fn().mockResolvedValue({
        columns: ['name', 'email', 'tax_number'],
        rows: [{ name: 'Alice', email: 'alice@example.com', tax_number: 'TX1' }],
      }),
      mappingLookup: vi.fn().mockResolvedValue({ name: 'name' }), // missing tax_id
      pdfTemplateLookup,
    });

    // 1. Rejects when mapping missing tax_id from PDF template
    await expect(
      useCase.createCampaignsUseCase({
        projectId: 'proj-1',
        auditUserId: 'u-1',
        payload: {
          emailTemplateId: 'tpl-1',
          pdfTemplateId: 'pdf-1',
          smtpConnectionId: 'smtp-1',
          uploadId: 'up-1',
          emailColumn: 'email',
        },
      }),
    ).rejects.toMatchObject({ status: 400, code: 'MAPPING_INVALID' });

    // 2. Rejects 404 when pdfTemplateId not found
    await expect(
      useCase.createCampaignsUseCase({
        projectId: 'proj-1',
        auditUserId: 'u-1',
        payload: {
          emailTemplateId: 'tpl-1',
          pdfTemplateId: 'pdf-unknown',
          smtpConnectionId: 'smtp-1',
          uploadId: 'up-1',
          emailColumn: 'email',
        },
      }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });

    // 3. Success when mapping covers name and tax_id
    const useCaseSuccess = buildCampaignsUseCase({
      repository,
      prisma: fakePrisma,
      queue,
      ...validLookups,
      uploadLookup: vi.fn().mockResolvedValue({
        columns: ['name', 'email', 'tax_number'],
        rows: [{ name: 'Alice', email: 'alice@example.com', tax_number: 'TX1' }],
      }),
      mappingLookup: vi.fn().mockResolvedValue({ name: 'name', tax_id: 'tax_number' }),
      pdfTemplateLookup,
    });

    const result = await useCaseSuccess.createCampaignsUseCase({
      projectId: 'proj-1',
      auditUserId: 'u-1',
      payload: {
        emailTemplateId: 'tpl-1',
        pdfTemplateId: 'pdf-1',
        smtpConnectionId: 'smtp-1',
        uploadId: 'up-1',
        emailColumn: 'email',
      },
    });

    expect(result.success).toBe(true);
    const args = vi.mocked(repository.createCampaignsRepository).mock.calls[0][0];
    expect(args.payload.pdfTemplateId).toBe('pdf-1');
  });

  it('createCampaignsUseCase rejects when projectLookup returns false (404)', async () => {
    const repository = makeFakeRepository();
    const queue = makeFakeQueue();
    const useCase = buildCampaignsUseCase({
      repository,
      prisma: fakePrisma,
      queue,
      ...validLookups,
      projectLookup: vi.fn().mockResolvedValue(false),
    });

    await expect(
      useCase.createCampaignsUseCase({
        projectId: 'proj-1',
        auditUserId: 'u-1',
        payload: {
          emailTemplateId: 'tpl-1',
          smtpConnectionId: 'smtp-1',
          uploadId: 'up-1',
          emailColumn: 'email',
        },
      }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('createCampaignsUseCase rejects when template, smtp or upload is missing (404)', async () => {
    const repository = makeFakeRepository();
    const queue = makeFakeQueue();
    const useCaseMissingTpl = buildCampaignsUseCase({
      repository,
      prisma: fakePrisma,
      queue,
      ...validLookups,
      templateLookup: vi.fn().mockResolvedValue(null),
    });

    await expect(
      useCaseMissingTpl.createCampaignsUseCase({
        projectId: 'proj-1',
        auditUserId: 'u-1',
        payload: { emailTemplateId: 'tpl-1', smtpConnectionId: 'smtp-1', uploadId: 'up-1', emailColumn: 'email' },
      }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
  });

  it('createCampaignsUseCase rejects when emailColumn is not in upload columns (400 INVALID_EMAIL_COLUMN)', async () => {
    const repository = makeFakeRepository();
    const queue = makeFakeQueue();
    const useCase = buildCampaignsUseCase({
      repository,
      prisma: fakePrisma,
      queue,
      ...validLookups,
    });

    await expect(
      useCase.createCampaignsUseCase({
        projectId: 'proj-1',
        auditUserId: 'u-1',
        payload: {
          emailTemplateId: 'tpl-1',
          smtpConnectionId: 'smtp-1',
          uploadId: 'up-1',
          emailColumn: 'non_existent_column',
        },
      }),
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_EMAIL_COLUMN' });
  });

  it('createCampaignsUseCase rejects when mapping is missing (400 MAPPING_MISSING) or invalid (400 MAPPING_INVALID)', async () => {
    const repository = makeFakeRepository();
    const queue = makeFakeQueue();
    const useCaseNoMapping = buildCampaignsUseCase({
      repository,
      prisma: fakePrisma,
      queue,
      ...validLookups,
      mappingLookup: vi.fn().mockResolvedValue(null),
    });

    await expect(
      useCaseNoMapping.createCampaignsUseCase({
        projectId: 'proj-1',
        auditUserId: 'u-1',
        payload: { emailTemplateId: 'tpl-1', smtpConnectionId: 'smtp-1', uploadId: 'up-1', emailColumn: 'email' },
      }),
    ).rejects.toMatchObject({ status: 400, code: 'MAPPING_MISSING' });

    // Invalid mapping (mapping points to unknown column)
    const useCaseBadMapping = buildCampaignsUseCase({
      repository,
      prisma: fakePrisma,
      queue,
      ...validLookups,
      mappingLookup: vi.fn().mockResolvedValue({ name: 'unknown_col' }),
    });

    await expect(
      useCaseBadMapping.createCampaignsUseCase({
        projectId: 'proj-1',
        auditUserId: 'u-1',
        payload: { emailTemplateId: 'tpl-1', smtpConnectionId: 'smtp-1', uploadId: 'up-1', emailColumn: 'email' },
      }),
    ).rejects.toMatchObject({ status: 400, code: 'MAPPING_INVALID' });
  });

  it('createCampaignsUseCase rejects when row emails are invalid without leaking addresses in error details', async () => {
    const repository = makeFakeRepository();
    const queue = makeFakeQueue();
    const useCase = buildCampaignsUseCase({
      repository,
      prisma: fakePrisma,
      queue,
      ...validLookups,
      uploadLookup: vi.fn().mockResolvedValue({
        columns: ['name', 'email'],
        rows: [
          { name: 'Valid', email: 'valid@example.com' },
          { name: 'Invalid', email: 'not-an-email-at-all' },
        ],
      }),
    });

    try {
      await useCase.createCampaignsUseCase({
        projectId: 'proj-1',
        auditUserId: 'u-1',
        payload: { emailTemplateId: 'tpl-1', smtpConnectionId: 'smtp-1', uploadId: 'up-1', emailColumn: 'email' },
      });
      expect.unreachable('Should have thrown AppError');
    } catch (err: unknown) {
      const error = err as { status: number; code: string; details?: unknown };
      expect(error.status).toBe(400);
      expect(error.code).toBe('INVALID_RECIPIENT_EMAIL');
      expect(JSON.stringify(error)).not.toContain('not-an-email-at-all');
      expect(error.details).toEqual({ invalidRows: [1] });
    }
  });

  it('sendCampaignsUseCase publishes messages AFTER status change, returns 202, and rejects if already sending', async () => {
    const callOrder: string[] = [];
    const repository = makeFakeRepository({
      markSendingCampaignsRepository: vi.fn().mockImplementation(async () => {
        callOrder.push('markSending');
        return 1;
      }),
      findRecipientsCampaignsRepository: vi.fn().mockResolvedValue({
        data: [mockRecipientPending],
        metadata: { total: 1 },
      }),
    });
    const queue = makeFakeQueue({
      publishSendEmail: vi.fn().mockImplementation(async () => {
        callOrder.push('publishSendEmail');
      }),
    });

    const useCase = buildCampaignsUseCase({
      repository,
      prisma: fakePrisma,
      queue,
      ...validLookups,
    });

    const result = await useCase.sendCampaignsUseCase({ projectId: 'proj-1', id: 'c-1', auditUserId: 'u-1' });
    expect(callOrder).toEqual(['markSending', 'publishSendEmail']);
    expect(result.data.enqueuedCount).toBe(1);
    expect(queue.publishSendEmail).toHaveBeenCalledWith({ campaignId: 'c-1', recipientId: 'r-1' });

    // Second call: markSending returns 0 -> 409 CAMPAIGN_ALREADY_SENT
    repository.markSendingCampaignsRepository = vi.fn().mockResolvedValue(0);
    await expect(
      useCase.sendCampaignsUseCase({ projectId: 'proj-1', id: 'c-1', auditUserId: 'u-1' }),
    ).rejects.toMatchObject({ status: 409, code: 'CAMPAIGN_ALREADY_SENT' });
  });

  it('sendCampaignsUseCase reverts to draft if publishing throws', async () => {
    const repository = makeFakeRepository({
      markSendingCampaignsRepository: vi.fn().mockResolvedValue(1),
      findRecipientsCampaignsRepository: vi.fn().mockResolvedValue({
        data: [mockRecipientPending],
        metadata: { total: 1 },
      }),
      revertToDraftCampaignsRepository: vi.fn().mockResolvedValue(undefined),
    });
    const queue = makeFakeQueue({
      publishSendEmail: vi.fn().mockRejectedValue(new Error('Broker unreachable')),
    });

    const useCase = buildCampaignsUseCase({
      repository,
      prisma: fakePrisma,
      queue,
      ...validLookups,
    });

    await expect(
      useCase.sendCampaignsUseCase({ projectId: 'proj-1', id: 'c-1', auditUserId: 'u-1' }),
    ).rejects.toThrow('Broker unreachable');

    expect(repository.revertToDraftCampaignsRepository).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c-1', auditUserId: 'u-1' }),
    );
  });

  it('retryRecipientCampaignsUseCase only retries a failed recipient, sets campaign to sending and publishes message', async () => {
    const repository = makeFakeRepository({
      findRecipientByIdCampaignsRepository: vi.fn().mockResolvedValue({ data: mockRecipientFailed }),
      resetRecipientCampaignsRepository: vi.fn().mockResolvedValue(mockRecipientPending),
      setCampaignStatusCampaignsRepository: vi.fn().mockResolvedValue(undefined),
    });
    const queue = makeFakeQueue();
    const useCase = buildCampaignsUseCase({
      repository,
      prisma: fakePrisma,
      queue,
      ...validLookups,
    });

    const result = await useCase.retryRecipientCampaignsUseCase({
      projectId: 'proj-1',
      campaignId: 'c-1',
      recipientId: 'r-2',
      auditUserId: 'u-1',
    });

    expect(result.success).toBe(true);
    expect(repository.resetRecipientCampaignsRepository).toHaveBeenCalledWith(
      expect.objectContaining({ filter: { campaignId: 'c-1', id: 'r-2' }, auditUserId: 'u-1' }),
    );
    expect(repository.setCampaignStatusCampaignsRepository).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'c-1', status: 'sending', auditUserId: 'u-1' }),
    );
    expect(queue.publishSendEmail).toHaveBeenCalledWith({ campaignId: 'c-1', recipientId: 'r-2' });

    // When recipient is pending (not failed), rejects with 409 NOT_RETRYABLE
    repository.findRecipientByIdCampaignsRepository = vi.fn().mockResolvedValue({ data: mockRecipientPending });
    await expect(
      useCase.retryRecipientCampaignsUseCase({
        projectId: 'proj-1',
        campaignId: 'c-1',
        recipientId: 'r-1',
        auditUserId: 'u-1',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'NOT_RETRYABLE' });
  });
});
