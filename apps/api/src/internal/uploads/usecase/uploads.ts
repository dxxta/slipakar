import type { PrismaClient } from '@prisma/client';
import { createUploadsDto } from '../../../domain/uploads/dto.js';
import type { FileParserInterface, UploadsRepositoryInterface, UploadsUseCaseInterface, UploadView } from '../../../domain/uploads/interface.js';
import { AppError } from '../../../lib/app-error.js';
import { inTransaction } from '../../../lib/in-transaction.js';
import { validateAndThrow } from '../../../lib/validate-and-throw.js';

type SettingsLookup = (projectId: string, userId: string) => Promise<{ maxUploadBytes: number; maxRows: number } | null>;
type ProjectLookup = (projectId: string, userId: string) => Promise<boolean>;

export function buildUploadsUseCase({ repository, prisma, parser, settingsLookup, projectLookup }: {
  repository: UploadsRepositoryInterface;
  prisma: PrismaClient;
  parser: FileParserInterface;
  settingsLookup: SettingsLookup;
  projectLookup: ProjectLookup;
}): UploadsUseCaseInterface {
  const toView = (record: UploadView): UploadView => ({ ...record, columns: [...record.columns] });
  const assertProject = async (projectId: string, auditUserId: string): Promise<void> => {
    if (!(await projectLookup(projectId, auditUserId))) throw new AppError(404, 'NOT_FOUND', 'Project not found');
  };
  return {
    async assertProjectUploadsUseCase({ projectId, auditUserId }): Promise<void> {
      await assertProject(projectId, auditUserId);
    },
    async createUploadsUseCase({ projectId, payload, auditUserId }): Promise<{ message: string; data: UploadView; success: true }> {
      const body = validateAndThrow({ schema: createUploadsDto, data: payload });
      await assertProject(projectId, auditUserId);
      const settings = await settingsLookup(projectId, auditUserId);
      if (!settings) throw new AppError(404, 'NOT_FOUND', 'Project not found');
      if (body.buffer.length > settings.maxUploadBytes) throw new AppError(413, 'FILE_TOO_LARGE', 'File exceeds project upload limit');
      const parsed = await parser.parseDataFile({ ...body, maxRows: settings.maxRows });
      const { data } = await inTransaction(prisma, (tx) => repository.createUploadsRepository({
        payload: { projectId, fileName: body.fileName, columns: parsed.columns, rows: parsed.rows }, auditUserId, tx,
      }));
      return { message: 'Upload created successfully', data: toView(data), success: true };
    },
    async findAllUploadsUseCase({ projectId, auditUserId }) {
      await assertProject(projectId, auditUserId);
      const { data } = await repository.findAllUploadsRepository({ filter: { projectId } });
      return { message: 'Uploads retrieved successfully', data: data.map(toView), success: true };
    },
    async findByIdUploadsUseCase({ projectId, id, auditUserId }) {
      await assertProject(projectId, auditUserId);
      const { data } = await repository.findByIdUploadsRepository({ filter: { projectId, id } });
      if (!data) throw new AppError(404, 'NOT_FOUND', 'Upload not found');
      const { data: rows } = await repository.getRowsUploadsRepository({ filter: { projectId, id } });
      return { message: 'Upload retrieved successfully', data: { ...toView(data), preview: (rows ?? []).slice(0, 5) }, success: true };
    },
    async deleteUploadsUseCase({ projectId, id, auditUserId }) {
      await assertProject(projectId, auditUserId);
      const { data } = await inTransaction(prisma, (tx) => repository.deleteUploadsRepository({ payload: { projectId, id }, auditUserId, tx }));
      if (!data) throw new AppError(404, 'NOT_FOUND', 'Upload not found');
      return { message: 'Upload deleted successfully', data: null, success: true };
    },
  };
}
