import { describe, expect, it, vi } from 'vitest';
import type { RedisPubSubClient, SystemConfigRepositoryInterface } from '../../../domain/system-config/interface.js';
import { buildFeatureFlags } from './feature-flags.js';

describe('feature-flags service', () => {
  it('missing row is true', async () => {
    const repository = {
      getSystemConfigRepository: vi.fn().mockResolvedValue({ data: null }),
    } as unknown as SystemConfigRepositoryInterface;
    const publisher = { publish: vi.fn() } as unknown as RedisPubSubClient;
    const subscriber = { subscribe: vi.fn(), unsubscribe: vi.fn(), on: vi.fn() } as unknown as RedisPubSubClient;

    const flags = buildFeatureFlags({ repository, publisher, subscriber });
    const enabled = await flags.isEnabled('scalar_docs');

    expect(enabled).toBe(true);
    expect(repository.getSystemConfigRepository).toHaveBeenCalledWith({ filter: { key: 'scalar_docs' } });
  });

  it('defaults API access to disabled when no runtime row exists', async () => {
    const repository = { getSystemConfigRepository: vi.fn().mockResolvedValue({ data: null }) } as unknown as SystemConfigRepositoryInterface;
    const publisher = { publish: vi.fn() } as unknown as RedisPubSubClient;
    const subscriber = { subscribe: vi.fn(), unsubscribe: vi.fn(), on: vi.fn() } as unknown as RedisPubSubClient;
    const flags = buildFeatureFlags({ repository, publisher, subscriber });
    expect(await flags.isEnabled('api_access_enabled')).toBe(false);
    expect(await flags.isEnabled('embed_enabled')).toBe(false);
  });

  it('ttl expiry re-reads the repository (inject now)', async () => {
    let mockNow = 1000;
    const getSystemConfigRepository = vi
      .fn()
      .mockResolvedValueOnce({ data: { key: 'scalar_docs', value: false } })
      .mockResolvedValueOnce({ data: { key: 'scalar_docs', value: true } });

    const repository = { getSystemConfigRepository } as unknown as SystemConfigRepositoryInterface;
    const publisher = { publish: vi.fn() } as unknown as RedisPubSubClient;
    const subscriber = { subscribe: vi.fn(), unsubscribe: vi.fn(), on: vi.fn() } as unknown as RedisPubSubClient;

    const flags = buildFeatureFlags({
      repository,
      publisher,
      subscriber,
      ttlMs: 5000,
      now: () => mockNow,
    });

    const first = await flags.isEnabled('scalar_docs');
    expect(first).toBe(false);
    expect(getSystemConfigRepository).toHaveBeenCalledTimes(1);

    // Call before expiry - should hit cache
    mockNow += 4000;
    const second = await flags.isEnabled('scalar_docs');
    expect(second).toBe(false);
    expect(getSystemConfigRepository).toHaveBeenCalledTimes(1);

    // Advance beyond TTL - should re-read repository
    mockNow += 2000;
    const third = await flags.isEnabled('scalar_docs');
    expect(third).toBe(true);
    expect(getSystemConfigRepository).toHaveBeenCalledTimes(2);
  });

  it('notifyChanged clears local cache and publishes on Redis channel', async () => {
    const getSystemConfigRepository = vi
      .fn()
      .mockResolvedValueOnce({ data: { key: 'pdf_builder', value: true } })
      .mockResolvedValueOnce({ data: { key: 'pdf_builder', value: false } });

    const repository = { getSystemConfigRepository } as unknown as SystemConfigRepositoryInterface;
    const publisher = { publish: vi.fn().mockResolvedValue(1) } as unknown as RedisPubSubClient;
    const subscriber = { subscribe: vi.fn(), unsubscribe: vi.fn(), on: vi.fn() } as unknown as RedisPubSubClient;

    const flags = buildFeatureFlags({ repository, publisher, subscriber });

    expect(await flags.isEnabled('pdf_builder')).toBe(true);
    expect(getSystemConfigRepository).toHaveBeenCalledTimes(1);

    await flags.notifyChanged('pdf_builder');

    expect(publisher.publish).toHaveBeenCalledWith('system-config:invalidate', 'pdf_builder');

    // Next isEnabled should read from repository again
    expect(await flags.isEnabled('pdf_builder')).toBe(false);
    expect(getSystemConfigRepository).toHaveBeenCalledTimes(2);
  });

  it('a message on the channel clears the cache', async () => {
    let messageHandler: ((channel: string, message: string) => void) | undefined;
    const repository = {
      getSystemConfigRepository: vi
        .fn()
        .mockResolvedValueOnce({ data: { key: 'self_signup', value: true } })
        .mockResolvedValueOnce({ data: { key: 'self_signup', value: false } }),
    } as unknown as SystemConfigRepositoryInterface;
    const publisher = { publish: vi.fn() } as unknown as RedisPubSubClient;
    const subscriber = {
      subscribe: vi.fn().mockResolvedValue(undefined),
      unsubscribe: vi.fn().mockResolvedValue(undefined),
      on: vi.fn().mockImplementation((event: string, listener: (channel: string, message: string) => void) => {
        if (event === 'message') messageHandler = listener;
      }),
    } as unknown as RedisPubSubClient;

    const flags = buildFeatureFlags({ repository, publisher, subscriber });
    await flags.start();

    expect(subscriber.subscribe).toHaveBeenCalledWith('system-config:invalidate');
    expect(messageHandler).toBeDefined();

    expect(await flags.isEnabled('self_signup')).toBe(true);
    expect(repository.getSystemConfigRepository).toHaveBeenCalledTimes(1);

    // Simulate incoming pubsub message
    messageHandler?.('system-config:invalidate', 'self_signup');

    expect(await flags.isEnabled('self_signup')).toBe(false);
    expect(repository.getSystemConfigRepository).toHaveBeenCalledTimes(2);

    await flags.stop();
    expect(subscriber.unsubscribe).toHaveBeenCalledWith('system-config:invalidate');
  });
});
