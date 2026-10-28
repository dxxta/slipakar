import type { PrismaClient, SmtpConnection } from '@prisma/client';
import { createSmtpDto, listSmtpQueryDto, updateSmtpDto } from '../../../domain/smtp/dto.js';
import type { SmtpRepositoryInterface, SmtpSenderInterface, SmtpUseCaseInterface, SmtpView } from '../../../domain/smtp/interface.js';
import { AppError } from '../../../lib/app-error.js';
import { inTransaction } from '../../../lib/in-transaction.js';
import { validateAndThrow } from '../../../lib/validate-and-throw.js';
import type { CryptoServiceInterface } from '../../../services/crypto.js';

const toView = (record: SmtpConnection): SmtpView => {
  const { passwordEncrypted: _passwordEncrypted, ...view } = record;
  void _passwordEncrypted;
  return view;
};

export function buildSmtpUseCase({ repository, prisma, cryptoService, sender, projectLookup }: {
  repository: SmtpRepositoryInterface;
  prisma: PrismaClient;
  cryptoService: CryptoServiceInterface;
  sender: SmtpSenderInterface;
  projectLookup: (projectId: string, userId: string) => Promise<boolean>;
}): SmtpUseCaseInterface {
  const assertOwner = async (projectId: string, userId: string): Promise<void> => {
    if (!(await projectLookup(projectId, userId))) throw new AppError(404, 'NOT_FOUND', 'Project not found');
  };
  const getRecord = async (projectId: string, id: string): Promise<SmtpConnection> => {
    const { data } = await repository.getSmtpRepository({ filter: { projectId, id } });
    if (!data) throw new AppError(404, 'NOT_FOUND', 'SMTP connection not found');
    return data;
  };
  return {
    async createSmtpUseCase({ projectId, payload, auditUserId }) {
      const body = validateAndThrow({ schema: createSmtpDto, data: payload });
      await assertOwner(projectId, auditUserId);
      const { password, ...fields } = body;
      const { data } = await inTransaction(prisma, (tx) => repository.createSmtpRepository({
        projectId, payload: { ...fields, passwordEncrypted: cryptoService.encrypt(password) }, auditUserId, tx,
      }));
      return { message: 'SMTP connection created successfully', data: toView(data), success: true };
    },
    async listSmtpUseCase({ projectId, query, auditUserId }) {
      await assertOwner(projectId, auditUserId);
      const params = validateAndThrow({ schema: listSmtpQueryDto, data: query ?? {} });
      const { data, metadata } = await repository.listSmtpRepository({
        filter: { projectId, ...(params.q ? { q: params.q } : {}) },
        page: params.page,
        limit: params.limit,
        sortBy: params.sortBy,
        sortDir: params.sortDir,
      });
      return {
        message: 'SMTP connections retrieved successfully',
        data: data.map(toView),
        metadata: metadata ?? { page: params.page, limit: params.limit, total: data.length },
        success: true,
      };
    },
    async getSmtpUseCase({ projectId, id, auditUserId }) {
      await assertOwner(projectId, auditUserId);
      return { message: 'SMTP connection retrieved successfully', data: toView(await getRecord(projectId, id)), success: true };
    },
    async updateSmtpUseCase({ projectId, id, payload, auditUserId }) {
      const body = validateAndThrow({ schema: updateSmtpDto, data: payload });
      await assertOwner(projectId, auditUserId);
      const { password, ...fields } = body;
      const { data } = await inTransaction(prisma, (tx) => repository.updateSmtpRepository({
        filter: { projectId, id }, payload: { ...fields, ...(password === undefined ? {} : { passwordEncrypted: cryptoService.encrypt(password) }) }, auditUserId, tx,
      }));
      if (!data) throw new AppError(404, 'NOT_FOUND', 'SMTP connection not found');
      return { message: 'SMTP connection updated successfully', data: toView(data), success: true };
    },
    async deleteSmtpUseCase({ projectId, id, auditUserId }) {
      await assertOwner(projectId, auditUserId);
      const { data } = await inTransaction(prisma, (tx) => repository.deleteSmtpRepository({ filter: { projectId, id }, auditUserId, tx }));
      if (!data) throw new AppError(404, 'NOT_FOUND', 'SMTP connection not found');
      return { message: 'SMTP connection deleted successfully', data: null, success: true };
    },
    async testSmtpUseCase({ projectId, id, auditUserId }) {
      await assertOwner(projectId, auditUserId);
      const record = await getRecord(projectId, id);
      const data = await sender.verify({
        host: record.host, port: record.port, username: record.username,
        password: cryptoService.decrypt(record.passwordEncrypted), secure: record.secure,
        fromAddress: record.fromAddress ?? record.username,
      });
      return { message: 'SMTP connection test completed', data, success: true };
    },
  };
}
