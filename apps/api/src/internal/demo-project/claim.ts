import type { PrismaClient } from '@prisma/client';
import type { ErrorReporter } from '../../domain/error-reporting/interface.js';
import type { DataVaultInterface } from '../../services/data-vault.js';
import { SYSTEM_DEMO_EMAIL } from './startup-seed.js';

export async function claimSystemDemoProject({
  prisma,
  userId,
  userEmail,
  adminEmails,
  errorReporter,
  dataVault,
}: {
  prisma: PrismaClient;
  userId: string;
  userEmail: string;
  adminEmails: string[];
  errorReporter: ErrorReporter;
  dataVault?: DataVaultInterface;
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

      // The project data is encrypted with its owner's key, so hand it over to the new owner's key.
      // If this fails the whole transfer rolls back and the project stays with the system owner.
      if (dataVault) {
        const from = await dataVault.forUser(systemUser.id);
        const to = await dataVault.forUser(userId);
        const uploads = await tx.dataUpload.findMany({ where: { projectId: demoProject.id }, select: { id: true, fileName: true, columns: true, rows: true } });
        for (const upload of uploads) {
          await tx.dataUpload.update({
            where: { id: upload.id },
            data: {
              fileName: to.encryptText(from.decryptText(upload.fileName)),
              columns: to.encryptJson(from.decryptJson(upload.columns)),
              rows: to.encryptJson(from.decryptJson(upload.rows)),
            },
          });
        }
        const mappings = await tx.fieldMapping.findMany({ where: { upload: { projectId: demoProject.id } }, select: { id: true, mapping: true } });
        for (const mapping of mappings) {
          await tx.fieldMapping.update({ where: { id: mapping.id }, data: { mapping: to.encryptJson(from.decryptJson(mapping.mapping)) } });
        }
        const smtpConnections = await tx.smtpConnection.findMany({ where: { projectId: demoProject.id }, select: { id: true, passwordEncrypted: true } });
        for (const smtp of smtpConnections) {
          await tx.smtpConnection.update({ where: { id: smtp.id }, data: { passwordEncrypted: to.encryptText(from.decryptText(smtp.passwordEncrypted)) } });
        }
      }

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
