import { expect, it, vi } from 'vitest';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { UploadsRepositoryInterface, FileParserInterface, UploadView } from '../../../domain/uploads/interface.js';
import { buildUploadsUseCase } from './uploads.js';

const upload: UploadView = {
  id: 'upload-1', projectId: 'project-1', fileName: 'rows.csv', columns: ['name'], rowCount: 1,
  createdAt: new Date(), updatedAt: new Date(),
};
const prisma = {
  $transaction: async <T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> => fn({} as Prisma.TransactionClient),
} as PrismaClient;

function makeRepository(): UploadsRepositoryInterface {
  return {
    createUploadsRepository: async () => ({ data: upload }),
    findAllUploadsRepository: async () => ({ data: [upload] }),
    findByIdUploadsRepository: async () => ({ data: upload }),
    getRowsUploadsRepository: async () => ({ data: [{ name: 'Ada' }] }),
    deleteUploadsRepository: async () => ({ data: true }),
  };
}

it('rejects oversized files before parsing', async () => {
  const parseDataFile = vi.fn<FileParserInterface['parseDataFile']>();
  const useCase = buildUploadsUseCase({
    repository: makeRepository(), prisma, parser: { parseDataFile },
    settingsLookup: async () => ({ maxUploadBytes: 2, maxRows: 10 }),
    projectLookup: async () => true,
  });

  await expect(useCase.createUploadsUseCase({ projectId: 'project-1', auditUserId: 'user-1', payload: { fileName: 'rows.csv', buffer: Buffer.from('large') } }))
    .rejects.toMatchObject({ status: 413, code: 'FILE_TOO_LARGE' });
  expect(parseDataFile).not.toHaveBeenCalled();
});

it('returns an envelope without file rows on create and list', async () => {
  const useCase = buildUploadsUseCase({
    repository: makeRepository(), prisma,
    parser: { parseDataFile: async () => ({ columns: ['name'], rows: [{ name: 'Ada' }] }) },
    settingsLookup: async () => ({ maxUploadBytes: 100, maxRows: 10 }),
    projectLookup: async () => true,
  });

  const created = await useCase.createUploadsUseCase({ projectId: 'project-1', auditUserId: 'user-1', payload: { fileName: 'rows.csv', buffer: Buffer.from('name\nAda') } });
  expect(created).toEqual({ message: 'Upload created successfully', data: upload, success: true });
  expect(created.data).not.toHaveProperty('rows');
  expect((await useCase.findAllUploadsUseCase({ projectId: 'project-1', auditUserId: 'user-1' })).data[0]).not.toHaveProperty('rows');
});
