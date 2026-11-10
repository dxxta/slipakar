import type { PrismaClient } from '@prisma/client';
import type { DemoProjectUseCaseInterface } from '../../domain/demo-project/interface.js';
import type { ErrorReporter } from '../../domain/error-reporting/interface.js';

export const SYSTEM_DEMO_EMAIL = 'demo-owner@system.invalid';

export async function seedSystemDemoProject({
  prisma,
  demoProjectUseCase,
  errorReporter,
}: {
  prisma: PrismaClient;
  demoProjectUseCase: DemoProjectUseCaseInterface;
  errorReporter: ErrorReporter;
}): Promise<void> {
  try {
    const existingSystemUser = await prisma.user.findUnique({
      where: { email: SYSTEM_DEMO_EMAIL },
      select: { id: true },
    });
    if (existingSystemUser) return;

    const systemUser = await prisma.user.create({
      data: {
        email: SYSTEM_DEMO_EMAIL,
        name: 'Slipakar Demo',
        role: 'system',
        emailVerified: true,
        disabledAt: new Date(),
        disabledReason: 'System account',
      },
      select: { id: true },
    });

    await demoProjectUseCase.seedDemoProjectUseCase({ userId: systemUser.id });
    console.info('Startup demo workspace seeded.');
  } catch (error: unknown) {
    try {
      errorReporter.capture(error, { source: 'startup-demo-seed' });
    } catch {
      // Startup seeding is best effort and must not prevent the API from serving.
    }
  }
}
