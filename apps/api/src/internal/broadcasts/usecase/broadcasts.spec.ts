import { describe, expect, it, vi } from 'vitest';
import { BroadcastUseCase } from './broadcasts.js';
import type { BroadcastRepositoryInterface } from '../../../domain/broadcasts/interface.js';
import type { AuditRepositoryInterface } from '../../../domain/audit/interface.js';

describe('BroadcastUseCase', () => {
  const mockRepo: BroadcastRepositoryInterface = {
    create: vi.fn(),
    findById: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    updateStatus: vi.fn(),
    resolveRecipients: vi.fn(),
    createNoticesForBroadcast: vi.fn(),
  };

  const mockAuditRepo: AuditRepositoryInterface = {
    createAuditRepository: vi.fn(),
    findAuditLogsByEntity: vi.fn(),
    findAuditLogsByProject: vi.fn(),
  };

  it('throws 400 when previewing broadcast with corrupt or missing audienceFilter', async () => {
    mockRepo.findById = vi.fn().mockResolvedValue({
      id: 'bc-corrupt',
      subject: 'Bad Filter',
      bodyText: 'Text',
      audience: 'role',
      audienceFilter: {},
      status: 'draft',
      sentAt: null,
      createdBy: 'admin-1',
      counts: { total: 0, sent: 0, failed: 0 },
    });

    const useCase = new BroadcastUseCase(mockRepo, mockAuditRepo);
    await expect(useCase.previewBroadcast('bc-corrupt', 'admin-1')).rejects.toThrow();
  });

  it('masks preview recipients while leaving the signed-in admin email readable', async () => {
    mockRepo.findById = vi.fn().mockResolvedValue({
      id: 'bc-preview',
      subject: 'Update',
      bodyText: 'Hello',
      audience: 'all',
      audienceFilter: null,
      status: 'draft',
      sentAt: null,
      createdBy: 'admin-1',
      counts: { total: 2, sent: 0, failed: 0 },
    });
    mockRepo.resolveRecipients = vi.fn().mockResolvedValue([
      { id: 'admin-1', email: 'admin@example.com', name: 'Admin' },
      { id: 'user-2', email: 'person@example.com', name: 'Person' },
    ]);

    const result = await new BroadcastUseCase(mockRepo, mockAuditRepo).previewBroadcast('bc-preview', 'admin-1');
    expect(result.sampleEmails).toEqual(['admin@example.com', '*****@example.com']);
  });

  it('throws 400 when sending broadcast with corrupt or missing audienceFilter', async () => {
    mockRepo.findById = vi.fn().mockResolvedValue({
      id: 'bc-corrupt-users',
      subject: 'Bad Users',
      bodyText: 'Text',
      audience: 'users',
      audienceFilter: { userIds: [] },
      status: 'draft',
      sentAt: null,
      createdBy: 'admin-1',
      counts: { total: 0, sent: 0, failed: 0 },
    });

    const useCase = new BroadcastUseCase(mockRepo, mockAuditRepo);
    await expect(useCase.sendBroadcast('bc-corrupt-users')).rejects.toThrow();
  });

  it('sends draft broadcast, creates notices and reports emailSkipped if mailer is absent', async () => {
    mockRepo.findById = vi.fn().mockResolvedValue({
      id: 'bc-2',
      subject: 'Draft BC',
      bodyText: 'Hello all',
      audience: 'all',
      channel: 'app_email',
      status: 'draft',
      sentAt: null,
      createdBy: 'admin-1',
      counts: { total: 0, sent: 0, failed: 0 },
    });
    mockRepo.resolveRecipients = vi.fn().mockResolvedValue([
      { id: 'u-1', email: 'alice@example.com', name: 'Alice' },
    ]);
    mockRepo.createNoticesForBroadcast = vi.fn().mockResolvedValue(1);
    mockRepo.updateStatus = vi.fn().mockResolvedValue({
      id: 'bc-2',
      status: 'sent',
      counts: { total: 1, sent: 1, failed: 0, emailSkipped: true },
    });

    const useCase = new BroadcastUseCase(mockRepo, mockAuditRepo);
    const result = await useCase.sendBroadcast('bc-2');

    expect(mockRepo.createNoticesForBroadcast).toHaveBeenCalled();
    expect(mockRepo.updateStatus).toHaveBeenCalledWith(
      'bc-2',
      'sent',
      expect.any(Date),
      expect.objectContaining({ emailSkipped: true }),
    );
    expect(result.status).toBe('sent');
  });

  it('creates in-app notices without email or emailSkipped for the app-only channel', async () => {
    mockRepo.findById = vi.fn().mockResolvedValue({
      id: 'bc-app-only',
      subject: 'In-app only',
      bodyText: 'Hello all',
      audience: 'all',
      audienceFilter: null,
      channel: 'app',
      status: 'draft',
      sentAt: null,
      createdBy: 'admin-1',
      counts: { total: 0, sent: 0, failed: 0 },
    });
    mockRepo.resolveRecipients = vi.fn().mockResolvedValue([
      { id: 'u-1', email: 'alice@example.com', name: 'Alice' },
    ]);
    mockRepo.createNoticesForBroadcast = vi.fn().mockResolvedValue(1);
    mockRepo.updateStatus = vi.fn().mockResolvedValue({
      id: 'bc-app-only',
      status: 'sent',
      channel: 'app',
      counts: { total: 1, sent: 1, failed: 0 },
    });
    const mailer = { sendMail: vi.fn() };

    const useCase = new BroadcastUseCase(mockRepo, mockAuditRepo, mailer as never);
    const result = await useCase.sendBroadcast('bc-app-only');

    expect(mockRepo.createNoticesForBroadcast).toHaveBeenCalledOnce();
    expect(mailer.sendMail).not.toHaveBeenCalled();
    expect(result.counts).not.toHaveProperty('emailSkipped');
    expect(mockRepo.updateStatus).toHaveBeenCalledWith(
      'bc-app-only',
      'sent',
      expect.any(Date),
      { total: 1, sent: 1, failed: 0 },
    );
  });

  it('normalizes audienceFilter to undefined when audience is all on create and update', async () => {
    mockRepo.create = vi.fn().mockImplementation((_adminId, data) => Promise.resolve({
      id: 'bc-new',
      ...data,
      status: 'draft',
      sentAt: null,
      createdBy: 'admin-1',
      counts: { total: 0, sent: 0, failed: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    mockRepo.update = vi.fn().mockImplementation((_id, data) => Promise.resolve({
      id: 'bc-new',
      subject: 'Updated',
      bodyText: 'Text',
      ...data,
      status: 'draft',
      sentAt: null,
      createdBy: 'admin-1',
      counts: { total: 0, sent: 0, failed: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    mockRepo.findById = vi.fn().mockResolvedValue({
      id: 'bc-new',
      subject: 'Subject',
      bodyText: 'Text',
      audience: 'role',
      audienceFilter: { role: 'admin' },
      status: 'draft',
      sentAt: null,
      createdBy: 'admin-1',
      counts: { total: 0, sent: 0, failed: 0 },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const useCase = new BroadcastUseCase(mockRepo, mockAuditRepo);

    await useCase.createBroadcast('admin-1', {
      subject: 'All Users',
      bodyText: 'Announcement',
      audience: 'all',
      audienceFilter: { role: 'admin' },
    });
    expect(mockRepo.create).toHaveBeenCalledWith(
      'admin-1',
      expect.objectContaining({
        audience: 'all',
        audienceFilter: undefined,
      }),
    );

    await useCase.updateBroadcast('bc-new', {
      audience: 'all',
      audienceFilter: { role: 'admin' },
    });
    expect(mockRepo.update).toHaveBeenCalledWith(
      'bc-new',
      expect.objectContaining({
        audience: 'all',
        audienceFilter: undefined,
      }),
    );
  });
});
