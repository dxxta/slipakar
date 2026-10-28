import type { PrismaClient } from '@prisma/client';
import { SYSTEM_CONFIG_KEYS, systemConfigKeySchema, updateSystemConfigDto, type SystemConfigKey } from '../../../domain/system-config/dto.js';
import type {
  FeatureFlagsInterface,
  SystemConfigItem,
  SystemConfigRepositoryInterface,
  SystemConfigUseCaseInterface,
} from '../../../domain/system-config/interface.js';
import { inTransaction } from '../../../lib/in-transaction.js';
import { validateAndThrow } from '../../../lib/validate-and-throw.js';

export function buildSystemConfigUseCase(deps: {
  repository: SystemConfigRepositoryInterface;
  prisma: PrismaClient;
  flags?: FeatureFlagsInterface;
  notifyChanged: (key: SystemConfigKey) => Promise<void>;
}): SystemConfigUseCaseInterface {
  const { repository, prisma, notifyChanged } = deps;
  void deps.flags;
  return {
    async getSystemConfigUseCase(args) {
      void args.auditUserId;
      const { data } = await repository.listSystemConfigRepository();
      const map = new Map<string, boolean>();
      for (const row of data) {
        if (typeof row.value === 'boolean') {
          map.set(row.key, row.value);
        }
      }

      const items: SystemConfigItem[] = SYSTEM_CONFIG_KEYS.map((k) => ({
        key: k,
        value: map.has(k) ? (map.get(k) as boolean) : true,
      }));

      return {
        message: 'System config retrieved successfully',
        data: items,
        success: true,
      };
    },

    async updateSystemConfigUseCase({ key, payload, auditUserId }) {
      const validatedKey = validateAndThrow({ schema: systemConfigKeySchema, data: key });
      const body = validateAndThrow({ schema: updateSystemConfigDto, data: payload });

      await inTransaction(prisma, (tx) =>
        repository.upsertSystemConfigRepository({
          payload: { key: validatedKey, value: body.value },
          auditUserId,
          tx,
        }),
      );

      // notifyChanged is called AFTER the database transaction commits so that any reader
      // fetching from the database on cache-invalidation will see the committed updated state.
      await notifyChanged(validatedKey);

      return {
        message: 'System config updated successfully',
        data: { key: validatedKey, value: body.value },
        success: true,
      };
    },
  };
}
