import type { SystemConfigKey } from '../../../domain/system-config/dto.js';
import type {
  FeatureFlagsInterface,
  RedisPubSubClient,
  SystemConfigRepositoryInterface,
} from '../../../domain/system-config/interface.js';

const CHANNEL = 'system-config:invalidate';

interface CacheEntry {
  value: boolean;
  expiresAt: number;
}

export function buildFeatureFlags({
  repository,
  publisher,
  subscriber,
  ttlMs = 30_000,
  now = Date.now,
}: {
  repository: SystemConfigRepositoryInterface;
  publisher: RedisPubSubClient;
  subscriber: RedisPubSubClient;
  ttlMs?: number;
  now?: () => number;
}): FeatureFlagsInterface {
  const cache = new Map<string, CacheEntry>();

  const onMessage = (channel: string, message: string): void => {
    if (channel === CHANNEL) {
      cache.delete(message);
    }
  };

  subscriber.on('message', onMessage);

  return {
    async isEnabled(key: SystemConfigKey): Promise<boolean> {
      const currentTime = now();
      const cached = cache.get(key);
      if (cached && cached.expiresAt > currentTime) {
        return cached.value;
      }

      const { data } = await repository.getSystemConfigRepository({ filter: { key } });
      const value = typeof data?.value === 'boolean' ? data.value : true;

      cache.set(key, {
        value,
        expiresAt: currentTime + ttlMs,
      });

      return value;
    },

    async notifyChanged(key: SystemConfigKey): Promise<void> {
      cache.delete(key);
      await publisher.publish(CHANNEL, key);
    },

    async start(): Promise<void> {
      await subscriber.subscribe(CHANNEL);
    },

    async stop(): Promise<void> {
      await subscriber.unsubscribe(CHANNEL);
    },
  };
}
