import type { Redis } from 'ioredis';

export type RateLimiterResult = { allowed: true } | { allowed: false; retryAfterMs: number };

export interface RateLimiterInterface {
  tryAcquire(key: string, limitPerMinute: number): Promise<RateLimiterResult>;
}

const LUA_TOKEN_BUCKET = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local limitPerMinute = tonumber(ARGV[2])

local timeRes = redis.call('TIME')
local nowMs = tonumber(timeRes[1]) * 1000 + math.floor(tonumber(timeRes[2]) / 1000)

local data = redis.call('HMGET', key, 'tokens', 'lastUpdated')
local tokens = tonumber(data[1])
local lastUpdated = tonumber(data[2])

if tokens == nil then
  tokens = capacity
  lastUpdated = nowMs
else
  local elapsed = nowMs - lastUpdated
  if elapsed > 0 then
    local refill = elapsed * (limitPerMinute / 60000.0)
    tokens = math.min(capacity, tokens + refill)
    lastUpdated = nowMs
  end
end

if tokens >= 1.0 then
  tokens = tokens - 1.0
  redis.call('HMSET', key, 'tokens', tostring(tokens), 'lastUpdated', tostring(lastUpdated))
  redis.call('PEXPIRE', key, 120000)
  return { 1, 0 }
else
  redis.call('HMSET', key, 'tokens', tostring(tokens), 'lastUpdated', tostring(lastUpdated))
  redis.call('PEXPIRE', key, 120000)
  local needed = 1.0 - tokens
  local retryAfterMs = math.ceil(needed * (60000.0 / limitPerMinute))
  if retryAfterMs < 1 then
    retryAfterMs = 1
  end
  return { 0, retryAfterMs }
end
`;

export function buildRateLimiter({ redis }: { redis: Redis }): RateLimiterInterface {
  return {
    async tryAcquire(key: string, limitPerMinute: number): Promise<RateLimiterResult> {
      const redisKey = `ratelimit:${key}`;
      const res = (await redis.eval(
        LUA_TOKEN_BUCKET,
        1,
        redisKey,
        limitPerMinute,
        limitPerMinute,
      )) as [number, number];

      const allowed = res[0] === 1;
      if (allowed) {
        return { allowed: true };
      }
      return { allowed: false, retryAfterMs: res[1] };
    },
  };
}
