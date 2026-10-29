import { startContainer } from '../../test-support/start-container.js';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';
import { Redis } from 'ioredis';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildRateLimiter } from './rate-limiter.js';

describe('rate-limiter', () => {
  let redisContainer: StartedRedisContainer;
  let redis: Redis;

  beforeAll(async () => {
    redisContainer = await startContainer(() => new RedisContainer('redis:7').start());
    redis = new Redis(redisContainer.getConnectionUrl());
  }, 120_000);

  afterAll(async () => {
    redis?.disconnect();
    await redisContainer?.stop();
  }, 120_000);

  it('limit 5 allows 5 immediate acquisitions and denies the 6th with retryAfterMs between 1 and 12000', async () => {
    const limiter = buildRateLimiter({ redis });
    const key = 'test-limit-5';

    for (let i = 0; i < 5; i++) {
      const res = await limiter.tryAcquire(key, 5);
      expect(res).toEqual({ allowed: true });
    }

    const denied = await limiter.tryAcquire(key, 5);
    expect(denied.allowed).toBe(false);
    if (!denied.allowed) {
      expect(denied.retryAfterMs).toBeGreaterThanOrEqual(1);
      expect(denied.retryAfterMs).toBeLessThanOrEqual(12_000);
    }
  });

  it('two different keys do not share tokens', async () => {
    const limiter = buildRateLimiter({ redis });
    const keyA = 'key-A';
    const keyB = 'key-B';

    for (let i = 0; i < 3; i++) {
      const res = await limiter.tryAcquire(keyA, 3);
      expect(res).toEqual({ allowed: true });
    }

    // keyA is exhausted
    const resA = await limiter.tryAcquire(keyA, 3);
    expect(resA.allowed).toBe(false);

    // keyB should still be allowed
    const resB = await limiter.tryAcquire(keyB, 3);
    expect(resB).toEqual({ allowed: true });
  });

  it('two parallel clients on the same key together get at most 5 allowed', async () => {
    const redis2 = new Redis(redisContainer.getConnectionUrl());
    const limiter1 = buildRateLimiter({ redis });
    const limiter2 = buildRateLimiter({ redis: redis2 });
    const key = 'parallel-key';

    // 10 concurrent requests across 2 clients with limit 5
    const promises = Array.from({ length: 10 }, (_, i) => {
      const limiter = i % 2 === 0 ? limiter1 : limiter2;
      return limiter.tryAcquire(key, 5);
    });

    const results = await Promise.all(promises);
    redis2.disconnect();

    const allowedCount = results.filter((r) => r.allowed).length;
    const deniedCount = results.filter((r) => !r.allowed).length;

    expect(allowedCount).toBe(5);
    expect(deniedCount).toBe(5);
  });
});
