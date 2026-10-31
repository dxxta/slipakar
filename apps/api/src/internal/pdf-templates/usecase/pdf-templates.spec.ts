import { describe, expect, it, vi } from 'vitest';
import type { Prisma, PrismaClient } from '@prisma/client';
import type {
  PdfNodeTree,
  PdfTemplatesRepositoryInterface,
  PdfTemplateView,
} from '../../../domain/pdf-templates/interface.js';
import { buildPdfTemplatesUseCase } from './pdf-templates.js';

const mockTree: PdfNodeTree = {
  page: { size: 'A4', margin: 10 },
  nodes: [
    {
      id: 'n1',
      type: 'text',
      x: 10,
      y: 10,
      width: 100,
      height: 20,
      content: 'Hello',
      style: { fontSize: 12, bold: false, align: 'left', color: '#000000' },
    },
  ],
};

const mockPdfTemplate: PdfTemplateView = {
  id: 'pt-1',
  projectId: 'proj-1',
  name: 'Standard Template',
  nodeTree: mockTree,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const fakeTx = {} as unknown as Prisma.TransactionClient;
const fakePrisma = {
  $transaction: async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => fn(fakeTx),
} as PrismaClient;

function makeFakeRepository(overrides: Partial<PdfTemplatesRepositoryInterface> = {}): PdfTemplatesRepositoryInterface {
  return {
    createPdfTemplatesRepository: vi.fn().mockResolvedValue({ data: mockPdfTemplate }),
    listPdfTemplatesRepository: vi.fn().mockResolvedValue({ data: [mockPdfTemplate] }),
    getPdfTemplatesRepository: vi.fn().mockResolvedValue({ data: mockPdfTemplate }),
    updatePdfTemplatesRepository: vi.fn().mockResolvedValue({ data: mockPdfTemplate }),
    deletePdfTemplatesRepository: vi.fn().mockResolvedValue({ data: true }),
    countCampaignsUsingTemplateRepository: vi.fn().mockResolvedValue(0),
    ...overrides,
  };
}

describe('pdf-templates usecase', () => {
  it('creates PDF template when attachmentLookup resolves true for image node', async () => {
    const repository = makeFakeRepository();
    const projectLookup = vi.fn().mockResolvedValue(true);
    const attachmentLookup = vi.fn().mockResolvedValue(true);

    const useCase = buildPdfTemplatesUseCase({
      repository,
      prisma: fakePrisma,
      projectLookup,
      attachmentLookup,
    });

    const treeWithImage: PdfNodeTree = {
      page: { size: 'A4', margin: 10 },
      nodes: [
        {
          id: 'img-1',
          type: 'image',
          x: 10,
          y: 10,
          width: 100,
          height: 100,
          attachmentId: 'att-123',
        },
      ],
    };

    const res = await useCase.createPdfTemplatesUseCase({
      projectId: 'proj-1',
      auditUserId: 'u-1',
      payload: { name: 'With Image', nodeTree: treeWithImage },
    });

    expect(res.success).toBe(true);
    expect(attachmentLookup).toHaveBeenCalledWith('proj-1', 'att-123');
    expect(repository.createPdfTemplatesRepository).toHaveBeenCalledTimes(1);
  });

  it('rejects with 400 INVALID_IMAGE_ATTACHMENT when image attachment does not exist in project', async () => {
    const repository = makeFakeRepository();
    const projectLookup = vi.fn().mockResolvedValue(true);
    const attachmentLookup = vi.fn().mockResolvedValue(false);

    const useCase = buildPdfTemplatesUseCase({
      repository,
      prisma: fakePrisma,
      projectLookup,
      attachmentLookup,
    });

    const treeWithImage: PdfNodeTree = {
      page: { size: 'A4', margin: 10 },
      nodes: [
        {
          id: 'img-1',
          type: 'image',
          x: 10,
          y: 10,
          width: 100,
          height: 100,
          attachmentId: 'missing-att',
        },
      ],
    };

    await expect(
      useCase.createPdfTemplatesUseCase({
        projectId: 'proj-1',
        auditUserId: 'u-1',
        payload: { name: 'With Missing Image', nodeTree: treeWithImage },
      }),
    ).rejects.toMatchObject({ status: 400, code: 'INVALID_IMAGE_ATTACHMENT' });

    expect(repository.createPdfTemplatesRepository).not.toHaveBeenCalled();
  });

  it('refuses deletion with 409 TEMPLATE_IN_USE when template is used by a campaign', async () => {
    const repository = makeFakeRepository({
      countCampaignsUsingTemplateRepository: vi.fn().mockResolvedValue(2),
    });
    const projectLookup = vi.fn().mockResolvedValue(true);
    const attachmentLookup = vi.fn().mockResolvedValue(true);

    const useCase = buildPdfTemplatesUseCase({
      repository,
      prisma: fakePrisma,
      projectLookup,
      attachmentLookup,
    });

    await expect(
      useCase.deletePdfTemplatesUseCase({
        projectId: 'proj-1',
        id: 'pt-1',
        auditUserId: 'u-1',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'TEMPLATE_IN_USE' });

    expect(repository.deletePdfTemplatesRepository).not.toHaveBeenCalled();
  });

  it('rejects with 404 NOT_FOUND when projectLookup returns false', async () => {
    const repository = makeFakeRepository();
    const projectLookup = vi.fn().mockResolvedValue(false);
    const attachmentLookup = vi.fn().mockResolvedValue(true);

    const useCase = buildPdfTemplatesUseCase({
      repository,
      prisma: fakePrisma,
      projectLookup,
      attachmentLookup,
    });

    await expect(
      useCase.listPdfTemplatesUseCase({ projectId: 'proj-1', auditUserId: 'u-1' }),
    ).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });

    expect(repository.listPdfTemplatesRepository).not.toHaveBeenCalled();
  });
});
