import type { PrismaClient } from '@prisma/client';
import type { ErrorReporter } from '../../domain/error-reporting/interface.js';
import { SYSTEM_DEMO_EMAIL } from './startup-seed.js';

export async function claimSystemDemoProject({
  prisma,
  userId,
  userEmail,
  adminEmails,
  errorReporter,
}: {
  prisma: PrismaClient;
  userId: string;
  userEmail: string;
  adminEmails: string[];
  errorReporter: ErrorReporter;
}): Promise<void> {
  if (!adminEmails.some((email) => email.toLowerCase() === userEmail.toLowerCase())) return;

  try {
    await prisma.$transaction(async (tx) => {
      const systemUser = await tx.user.findUnique({
        where: { email: SYSTEM_DEMO_EMAIL },
        select: { id: true },
      });
      if (!systemUser) return;

      const demoProject = await tx.project.findFirst({
        where: { ownerId: systemUser.id, name: 'Example payroll project' },
        select: { id: true },
      });
      if (!demoProject) return;

      const transfer = await tx.project.updateMany({
        where: { id: demoProject.id, ownerId: systemUser.id },
        data: { ownerId: userId },
      });
      if (transfer.count !== 1) return;

      await tx.auditLog.createMany({
        data: [{
          entity: 'Project',
          entityId: demoProject.id,
          action: 'update',
          fieldName: 'ownership',
          fieldValue: 'demo project assigned',
          userId,
        }],
      });
    });
  } catch (error: unknown) {
    try {
      errorReporter.capture(error, { source: 'demo-project-claim' });
    } catch {
      // The sign-in hook must never fail because of demo ownership bookkeeping.
    }
  }
}
