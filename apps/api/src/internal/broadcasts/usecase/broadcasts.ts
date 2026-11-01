import { AppError } from '../../../lib/app-error.js';
import { validateAndThrow } from '../../../lib/validate-and-throw.js';
import {
  createBroadcastDto,
  updateBroadcastDto,
  listBroadcastsQueryDto,
  maskEmail,
  type BroadcastView,
  type BroadcastPreview,
} from '../../../domain/broadcasts/dto.js';
import type {
  BroadcastRepositoryInterface,
  BroadcastUseCaseInterface,
} from '../../../domain/broadcasts/interface.js';
import type { AuthEmailSenderInterface } from '../../../domain/auth/sender.js';
import type { AuditRepositoryInterface } from '../../../domain/audit/interface.js';

export function validateAudienceFilter(
  audience: string,
  audienceFilter?: Record<string, unknown> | null,
): void {
  if (audience === 'role') {
    const role = audienceFilter?.role;
    if (typeof role !== 'string' || role.trim().length === 0) {
      throw new AppError(400, 'VALIDATION', "audienceFilter.role must be a non-empty string when audience is 'role'");
    }
  } else if (audience === 'users') {
    const userIds = audienceFilter?.userIds;
    if (
      !Array.isArray(userIds) ||
      userIds.length === 0 ||
      userIds.length > 1000 ||
      !userIds.every((id) => typeof id === 'string' && id.trim().length > 0)
    ) {
      throw new AppError(400, 'VALIDATION', "audienceFilter.userIds must be a non-empty array of strings (max 1000) when audience is 'users'");
    }
  }
}

export class BroadcastUseCase implements BroadcastUseCaseInterface {
  constructor(
    private readonly repository: BroadcastRepositoryInterface,
    private readonly auditRepository: AuditRepositoryInterface,
    private readonly platformMailer?: AuthEmailSenderInterface,
  ) {}

  async createBroadcast(adminUserId: string, payload: unknown): Promise<BroadcastView> {
    const validated = validateAndThrow({
      schema: createBroadcastDto,
      data: payload,
    });
    if (validated.audience === 'all') {
      validated.audienceFilter = undefined;
    }
    return this.repository.create(adminUserId, validated);
  }

  async getBroadcast(id: string): Promise<BroadcastView> {
    const broadcast = await this.repository.findById(id);
    if (!broadcast) {
      throw new AppError(404, 'NOT_FOUND', 'Broadcast not found');
    }
    return broadcast;
  }

  async listBroadcasts(
    query: unknown,
  ): Promise<{ data: BroadcastView[]; metadata: { page: number; limit: number; total: number } }> {
    const validated = validateAndThrow({
      schema: listBroadcastsQueryDto,
      data: query ?? {},
    });
    const result = await this.repository.findMany(validated);
    return {
      data: result.data,
      metadata: {
        page: validated.page,
        limit: validated.limit,
        total: result.total,
      },
    };
  }

  async updateBroadcast(id: string, payload: unknown): Promise<BroadcastView> {
    const existing = await this.getBroadcast(id);
    if (existing.status !== 'draft') {
      throw new AppError(400, 'BROADCAST_ALREADY_SENT', 'Cannot edit a broadcast that has already been sent');
    }

    const validated = validateAndThrow({
      schema: updateBroadcastDto,
      data: payload,
    });
    if (validated.audience === 'all') {
      validated.audienceFilter = undefined;
    }

    return this.repository.update(id, validated);
  }

  async deleteBroadcast(id: string): Promise<void> {
    const existing = await this.getBroadcast(id);
    if (existing.status !== 'draft') {
      throw new AppError(400, 'BROADCAST_ALREADY_SENT', 'Cannot delete a broadcast that has already been sent');
    }

    await this.repository.delete(id);
  }

  async previewBroadcast(id: string): Promise<BroadcastPreview> {
    const broadcast = await this.getBroadcast(id);
    validateAudienceFilter(broadcast.audience, broadcast.audienceFilter);

    const recipients = await this.repository.resolveRecipients(
      broadcast.audience,
      broadcast.audienceFilter,
    );

    const sampleEmails = recipients.slice(0, 5).map((r) => maskEmail(r.email));

    return {
      recipientCount: recipients.length,
      sampleEmails,
      renderedSubject: broadcast.subject,
      renderedBodyText: broadcast.bodyText,
    };
  }

  async sendBroadcast(id: string): Promise<BroadcastView> {
    const broadcast = await this.getBroadcast(id);
    if (broadcast.status === 'sent') {
      throw new AppError(409, 'BROADCAST_ALREADY_SENT', 'Broadcast has already been sent');
    }

    validateAudienceFilter(broadcast.audience, broadcast.audienceFilter);

    const recipients = await this.repository.resolveRecipients(
      broadcast.audience,
      broadcast.audienceFilter,
    );

    // 1. Create in-app UserNotices for every recipient
    await this.repository.createNoticesForBroadcast(
      broadcast.id,
      recipients,
      broadcast.subject,
      broadcast.bodyText,
    );

    let sent = 0;
    let failed = 0;
    const emailSkipped = !this.platformMailer;

    // 2. If platform mailer is configured, send email with bounded concurrency (concurrency = 5)
    if (this.platformMailer) {
      const concurrency = 5;
      for (let i = 0; i < recipients.length; i += concurrency) {
        const chunk = recipients.slice(i, i + concurrency);
        await Promise.all(
          chunk.map(async (r) => {
            try {
              // Escape any HTML chars in bodyText for safety
              const escapedBody = broadcast.bodyText
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;')
                .replace(/\n/g, '<br/>');

              const html = `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                  <h2>${broadcast.subject}</h2>
                  <div style="margin: 20px 0; line-height: 1.6; color: #374151;">
                    ${escapedBody}
                  </div>
                  <p style="color: #9ca3af; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 12px;">
                    This is an administrative announcement from LokaSlip.
                  </p>
                </div>
              `;

              const res = await this.platformMailer!.sendMail({
                to: r.email,
                subject: broadcast.subject,
                text: broadcast.bodyText,
                html,
              });

              if (res.ok) {
                sent++;
              } else {
                failed++;
              }
            } catch {
              failed++;
            }
          }),
        );
      }
    } else {
      sent = recipients.length;
    }

    const counts = {
      total: recipients.length,
      sent,
      failed,
      ...(emailSkipped && { emailSkipped: true }),
    };

    const updated = await this.repository.updateStatus(broadcast.id, 'sent', new Date(), counts);

    await this.auditRepository.createAuditRepository({
      entity: 'Broadcast',
      entityId: broadcast.id,
      action: 'update',
      changes: [{ fieldName: 'status', fieldValue: { status: 'sent', counts } }],
      auditUserId: broadcast.createdBy,
    });

    return updated;
  }
}
