import type { PrismaClient } from '@prisma/client';
import type { AuditRepositoryInterface } from '../../domain/audit/interface.js';
import type { QueuePublisher, SendEmailMessage } from '../../domain/queue/interface.js';
import type { SendWorkerInterface } from '../../domain/sending/interface.js';
import type { SmtpSenderInterface } from '../../domain/smtp/interface.js';
import type { CryptoServiceInterface } from '../../services/crypto.js';
import type { RateLimiterInterface } from './rate-limiter.js';
import type { StorageInterface } from '../../domain/storage/interface.js';
import type { PdfRendererInterface } from '../../domain/pdf/interface.js';
import type { AttachmentStoreInterface } from '../attachments/attachment-store.js';
import type { PdfNodeTree } from '../../domain/pdf-templates/interface.js';
import type { MetricsInterface } from '../../domain/metrics/interface.js';
import { noopMetrics } from '../metrics/noop.js';
import { inTransaction } from '../../lib/in-transaction.js';

import type { ErrorReporter } from '../../domain/error-reporting/interface.js';

const DEFAULT_RETRY_SCHEDULE_MS = [
  30 * 1000,
  2 * 60 * 1000,
  10 * 60 * 1000,
  30 * 60 * 1000,
  60 * 60 * 1000,
];

export function buildSendWorker({
  prisma,
  queue,
  cryptoService,
  sender,
  rateLimiter,
  engine,
  sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
  auditRepository,
  pdfRenderer,
  attachmentStore,
  storage,
  metrics = noopMetrics,
  maxAttempts = 5,
  retryScheduleMs = DEFAULT_RETRY_SCHEDULE_MS,
  errorReporter,
}: {
  prisma: PrismaClient;
  queue: QueuePublisher;
  cryptoService: CryptoServiceInterface;
  sender: SmtpSenderInterface;
  rateLimiter: RateLimiterInterface;
  engine: { renderTemplate: (template: { subject: string; bodyHtml: string }, row: Record<string, string>) => { subject: string; body: string } };
  sleep?: (ms: number) => Promise<void>;
  auditRepository: AuditRepositoryInterface;
  pdfRenderer?: PdfRendererInterface;
  attachmentStore?: AttachmentStoreInterface;
  storage?: StorageInterface;
  metrics?: MetricsInterface;
  maxAttempts?: number;
  retryScheduleMs?: number[];
  errorReporter?: ErrorReporter;
}): SendWorkerInterface {
  return {
    async handleSendEmail(message: SendEmailMessage): Promise<void> {
      const attempt = message.attempt ?? 1;

      // (1) Load recipient and its associated campaign relations
      const recipient = await prisma.campaignRecipient.findUnique({
        where: { id: message.recipientId },
        include: {
          campaign: {
            include: {
              emailTemplate: true,
              smtpConnection: true,
              upload: true,
              project: true,
            },
          },
        },
      });

      if (!recipient || recipient.status !== 'pending' || recipient.campaign.status !== 'sending') {
        return;
      }

      const { campaign } = recipient;
      const { smtpConnection, upload, project, emailTemplate } = campaign;
      const rateLimitPerMinute = project.rateLimitPerMinute;

      // (2) Rate limiter wait loop
      let totalWaitMs = 0;
      while (true) {
        const rateResult = await rateLimiter.tryAcquire(`smtp:${smtpConnection.id}`, rateLimitPerMinute);
        if (rateResult.allowed) {
          break;
        }
        totalWaitMs += rateResult.retryAfterMs;
        await sleep(rateResult.retryAfterMs);
      }
      if (totalWaitMs > 0) {
        metrics.recordRateLimitWait(totalWaitMs / 1000);
      }

      // (3) Build row data object & render template
      const uploadRows = Array.isArray(upload.rows) ? (upload.rows as Record<string, string>[]) : [];
      const rawRow = uploadRows[recipient.rowIndex] ?? {};

      const fieldMapping = await prisma.fieldMapping.findFirst({
        where: { templateId: campaign.emailTemplateId, uploadId: campaign.uploadId },
      });

      const mappingObject: Record<string, string> =
        fieldMapping && typeof fieldMapping.mapping === 'object' && fieldMapping.mapping !== null
          ? (fieldMapping.mapping as Record<string, string>)
          : {};

      const rowData: Record<string, string> = {};
      for (const [placeholderName, mappedColumn] of Object.entries(mappingObject)) {
        if (typeof mappedColumn === 'string' && Object.hasOwn(rawRow, mappedColumn)) {
          rowData[placeholderName] = String(rawRow[mappedColumn] ?? '');
        }
      }

      let rendered: { subject: string; body: string };
      try {
        rendered = engine.renderTemplate(
          { subject: emailTemplate.subject, bodyHtml: emailTemplate.bodyHtml },
          rowData,
        );
      } catch (err) {
        const errMessage = err instanceof Error ? err.message : String(err);
        const placeholderNamesMatch = errMessage.match(/Unresolved placeholders: (.+)/);
        const safeError = placeholderNamesMatch ? `Unresolved placeholders: ${placeholderNamesMatch[1]}` : 'Template rendering failed';

        await markRecipientFailed(prisma, recipient.id, safeError, auditRepository);
        await queue.publishNotify({
          type: 'send_failed',
          projectId: campaign.projectId,
          campaignId: campaign.id,
          message: `Sending to row ${recipient.rowIndex} failed`,
        });

        await checkCampaignCompletion(prisma, campaign.id, campaign.projectId, queue, auditRepository);
        return;
      }

      // Step E attachments handling
      const mailAttachments: { filename: string; content: Buffer; contentType: string }[] = [];

      // 1. Shared campaign attachments (Attachment rows with campaignId = campaign.id and kind extra)
      if (storage) {
        const sharedAttachments = await prisma.attachment.findMany({
          where: { campaignId: campaign.id, kind: 'extra' },
        });

        for (const shared of sharedAttachments) {
          const content = await storage.getObject(shared.objectKey);
          mailAttachments.push({
            filename: shared.fileName,
            content,
            contentType: 'application/pdf',
          });
        }
      }

      // 2. Generated PDF attachment when campaign.pdfTemplateId is set
      if (campaign.pdfTemplateId) {
        if (!pdfRenderer || !attachmentStore) {
          throw new Error('PDF rendering is not configured');
        }

        const pdfTemplate = await prisma.pdfTemplate.findUnique({
          where: { id: campaign.pdfTemplateId },
        });

        if (pdfTemplate) {
          const tree = pdfTemplate.nodeTree as unknown as PdfNodeTree;
          let pdfBuffer: Buffer;
          try {
            pdfBuffer = await pdfRenderer.renderPdf({
              projectId: campaign.projectId,
              tree,
              row: rowData,
            });
          } catch (renderErr) {
            const errMessage = renderErr instanceof Error ? renderErr.message : String(renderErr);
            const placeholderNamesMatch = errMessage.match(/Unresolved placeholders: (.+)/);
            const safeError = placeholderNamesMatch ? `Unresolved placeholders: ${placeholderNamesMatch[1]}` : 'PDF rendering failed';

            metrics.recordEmailResult('failed');
            await markRecipientFailed(prisma, recipient.id, safeError, auditRepository);
            await queue.publishNotify({
              type: 'send_failed',
              projectId: campaign.projectId,
              campaignId: campaign.id,
              message: `Sending to row ${recipient.rowIndex} failed`,
            });
            await checkCampaignCompletion(prisma, campaign.id, campaign.projectId, queue, auditRepository, metrics);
            return;
          }

          const generatedFileName = `document-row-${recipient.rowIndex + 1}.pdf`;

          // Remove any previous generated attachment for this recipient
          const existingGenerated = await prisma.attachment.findMany({
            where: {
              campaignId: campaign.id,
              kind: 'generated',
              fileName: generatedFileName,
            },
          });
          for (const prev of existingGenerated) {
            await attachmentStore.removeAttachment({
              id: prev.id,
              projectId: campaign.projectId,
              auditUserId: 'system',
            });
          }

          // Store new generated PDF attachment
          try {
            await attachmentStore.storeAttachment({
              projectId: campaign.projectId,
              campaignId: campaign.id,
              fileName: generatedFileName,
              buffer: pdfBuffer,
              contentType: 'application/pdf',
              kind: 'generated',
              auditUserId: 'system',
            });
          } catch (storeErr: unknown) {
            const safeMessage = storeErr instanceof Error ? storeErr.message : 'Storage quota exceeded';
            metrics.recordEmailResult('failed');
            await markRecipientFailed(prisma, recipient.id, safeMessage, auditRepository);
            await queue.publishNotify({
              type: 'send_failed',
              projectId: campaign.projectId,
              campaignId: campaign.id,
              message: `Sending to row ${recipient.rowIndex} failed`,
            });
            await checkCampaignCompletion(prisma, campaign.id, campaign.projectId, queue, auditRepository, metrics);
            return;
          }

          mailAttachments.push({
            filename: generatedFileName,
            content: pdfBuffer,
            contentType: 'application/pdf',
          });
        }
      }

      // (4) Decrypt password and send
      const password = cryptoService.decrypt(smtpConnection.passwordEncrypted);
      // from uses smtpConnection.fromAddress when set, otherwise the username
      const from = smtpConnection.fromAddress ?? smtpConnection.username;
      const to = recipient.email;

      const sendResult = await sender.sendMail(
        {
          host: smtpConnection.host,
          port: smtpConnection.port,
          secure: smtpConnection.secure,
          username: smtpConnection.username,
          password,
          fromAddress: smtpConnection.fromAddress ?? smtpConnection.username,
        },
        {
          from,
          to,
          subject: rendered.subject,
          html: rendered.body,
          attachments: mailAttachments.length > 0 ? mailAttachments : undefined,
        },
      );

      // (5) On success/failure update recipient
      if (sendResult.ok) {
        metrics.recordEmailResult('sent');
        await inTransaction(prisma, async (tx) => {
          await tx.campaignRecipient.update({
            where: { id: recipient.id },
            data: { status: 'sent', errorMessage: null },
          });
          await auditRepository.createAuditRepository({
            entity: 'CampaignRecipient',
            entityId: recipient.id,
            action: 'update',
            auditUserId: 'system',
            changes: [{ fieldName: 'status', fieldValue: 'sent' }],
            tx,
          });
        });
      } else {
        // Safe error reporting on any failed attempt
        if (errorReporter) {
          try {
            errorReporter.capture(new Error(sendResult.error), {
              campaignId: campaign.id,
              recipientId: recipient.id,
              attempt,
              transient: sendResult.transient,
            });
          } catch {
            // A throwing reporter must never break sending
          }
        }

        // Check if transient error can be retried
        if (sendResult.transient && attempt < maxAttempts) {
          const delayIndex = Math.min(attempt - 1, retryScheduleMs.length - 1);
          const delayMs = retryScheduleMs[delayIndex] ?? 30000;
          await queue.publishSendEmail(
            {
              campaignId: campaign.id,
              recipientId: recipient.id,
              attempt: attempt + 1,
            },
            { delayMs },
          );
          // Do NOT mark failed, leave in non-final state, do NOT check campaign completion
          return;
        }

        // Exhausted transient attempts or permanent error
        metrics.recordEmailResult('failed');
        let sanitizedError: string;
        if (sendResult.transient && attempt >= maxAttempts) {
          sanitizedError = `SMTP server unavailable after ${maxAttempts} attempts`;
        } else {
          sanitizedError = (sendResult.error || 'SMTP send failed').slice(0, 500);
        }

        await markRecipientFailed(prisma, recipient.id, sanitizedError, auditRepository);

        // (6) Publish send_failed
        await queue.publishNotify({
          type: 'send_failed',
          projectId: campaign.projectId,
          campaignId: campaign.id,
          message: `Sending to row ${recipient.rowIndex} failed`,
        });
      }

      // (7) Finish check
      await checkCampaignCompletion(prisma, campaign.id, campaign.projectId, queue, auditRepository, metrics);
    },
  };
}

async function markRecipientFailed(
  prisma: PrismaClient,
  recipientId: string,
  errorMessage: string,
  auditRepository: AuditRepositoryInterface,
): Promise<void> {
  await inTransaction(prisma, async (tx) => {
    await tx.campaignRecipient.update({
      where: { id: recipientId },
      data: { status: 'failed', errorMessage: errorMessage.slice(0, 500) },
    });
    await auditRepository.createAuditRepository({
      entity: 'CampaignRecipient',
      entityId: recipientId,
      action: 'update',
      auditUserId: 'system',
      changes: [{ fieldName: 'status', fieldValue: 'failed' }],
      tx,
    });
  });
}

async function checkCampaignCompletion(
  prisma: PrismaClient,
  campaignId: string,
  projectId: string,
  queue: QueuePublisher,
  auditRepository: AuditRepositoryInterface,
  metrics?: MetricsInterface,
): Promise<void> {
  const pendingCount = await prisma.campaignRecipient.count({
    where: { campaignId, status: 'pending' },
  });

  if (pendingCount > 0) {
    return;
  }

  // Inside transaction check pending count and conditionally update campaign
  const updateResult = await inTransaction(prisma, async (tx) => {
    const txPending = await tx.campaignRecipient.count({
      where: { campaignId, status: 'pending' },
    });
    if (txPending > 0) {
      return null;
    }

    const failedCount = await tx.campaignRecipient.count({
      where: { campaignId, status: 'failed' },
    });
    const sentCount = await tx.campaignRecipient.count({
      where: { campaignId, status: 'sent' },
    });

    const targetStatus = failedCount > 0 ? 'completed_with_errors' : 'completed';

    const updated = await tx.campaign.updateMany({
      where: { id: campaignId, status: 'sending' },
      data: { status: targetStatus },
    });

    if (updated.count > 0) {
      await auditRepository.createAuditRepository({
        entity: 'Campaign',
        entityId: campaignId,
        action: 'update',
        auditUserId: 'system',
        changes: [{ fieldName: 'status', fieldValue: targetStatus }],
        tx,
      });
      return { sentCount, failedCount, targetStatus };
    }
    return null;
  });

  if (updateResult) {
    metrics?.recordCampaignFinished();
    await queue.publishNotify({
      type: 'campaign_finished',
      projectId,
      campaignId,
      message: `Campaign finished: ${updateResult.sentCount} sent, ${updateResult.failedCount} failed`,
    });
  }
}
