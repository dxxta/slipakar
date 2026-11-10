import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import type { DemoProjectUseCaseInterface } from '../../domain/demo-project/interface.js';
import type { ErrorReporter } from '../../domain/error-reporting/interface.js';
import { seedSystemDemoProject } from './startup-seed.js';

describe('seedSystemDemoProject', () => {
  it('creates one disabled system owner and seeds the demo project', async () => {
    const systemUser = { id: 'system-1' };
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(systemUser),
      },
    } as unknown as PrismaClient;
    const demoProjectUseCase: DemoProjectUseCaseInterface = {
      seedDemoProjectUseCase: vi.fn().mockResolvedValue({ success: true, message: 'created', data: { projectId: 'project-1', created: true } }),
    };
    const errorReporter: ErrorReporter = { capture: vi.fn() };

    await seedSystemDemoProject({ prisma, demoProjectUseCase, errorReporter });

    expect(prisma.user.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      email: 'demo-owner@system.invalid', name: 'Slipakar Demo', role: 'system', emailVerified: true,
      disabledReason: 'System account', disabledAt: expect.any(Date),
    }), select: { id: true } });
    expect(demoProjectUseCase.seedDemoProjectUseCase).toHaveBeenCalledWith({ userId: 'system-1' });
  });

  it('uses the system user as an idempotency marker, even if the project was deleted', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ id: 'system-1' }),
        create: vi.fn(),
      },
    } as unknown as PrismaClient;
    const demoProjectUseCase: DemoProjectUseCaseInterface = { seedDemoProjectUseCase: vi.fn() };

    await seedSystemDemoProject({
      prisma,
      demoProjectUseCase,
      errorReporter: { capture: vi.fn() },
    });

    expect(prisma.user.create).not.toHaveBeenCalled();
    expect(demoProjectUseCase.seedDemoProjectUseCase).not.toHaveBeenCalled();
  });

  it('reports seed failures without throwing from startup', async () => {
    const error = new Error('seed unavailable');
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'system-1' }),
      },
    } as unknown as PrismaClient;
    const demoProjectUseCase: DemoProjectUseCaseInterface = {
      seedDemoProjectUseCase: vi.fn().mockRejectedValue(error),
    };
    const errorReporter: ErrorReporter = { capture: vi.fn() };

    await expect(seedSystemDemoProject({ prisma, demoProjectUseCase, errorReporter })).resolves.toBeUndefined();
    expect(errorReporter.capture).toHaveBeenCalledWith(error, { source: 'startup-demo-seed' });
  });
});
