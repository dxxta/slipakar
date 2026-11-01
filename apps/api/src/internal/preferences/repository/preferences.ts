import type { PrismaClient } from '@prisma/client';
import type { ThemePreferencesView, UpdateThemePreferencesDto } from '../../../domain/preferences/dto.js';
import type { PreferencesRepositoryInterface } from '../../../domain/preferences/interface.js';
import type { AuditRepositoryInterface } from '../../../domain/audit/interface.js';

export class PreferencesRepository implements PreferencesRepositoryInterface {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly auditRepository: AuditRepositoryInterface,
  ) {}

  async findByUserId(userId: string): Promise<ThemePreferencesView | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        themeMode: true,
        themeAccent: true,
      },
    });

    if (!user) return null;

    return {
      themeMode: user.themeMode as ThemePreferencesView['themeMode'],
      themeAccent: user.themeAccent as ThemePreferencesView['themeAccent'],
    };
  }

  async updateByUserId(
    userId: string,
    data: UpdateThemePreferencesDto,
  ): Promise<ThemePreferencesView> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(data.themeMode !== undefined && { themeMode: data.themeMode }),
        ...(data.themeAccent !== undefined && { themeAccent: data.themeAccent }),
      },
      select: {
        themeMode: true,
        themeAccent: true,
      },
    });

    if (data.themeMode !== undefined) {
      await this.auditRepository.createAuditRepository({
        entity: 'User',
        entityId: userId,
        action: 'update',
        changes: [{ fieldName: 'themeMode', fieldValue: data.themeMode }],
        auditUserId: userId,
      });
    }

    if (data.themeAccent !== undefined) {
      await this.auditRepository.createAuditRepository({
        entity: 'User',
        entityId: userId,
        action: 'update',
        changes: [{ fieldName: 'themeAccent', fieldValue: data.themeAccent }],
        auditUserId: userId,
      });
    }

    return {
      themeMode: updated.themeMode as ThemePreferencesView['themeMode'],
      themeAccent: updated.themeAccent as ThemePreferencesView['themeAccent'],
    };
  }
}
