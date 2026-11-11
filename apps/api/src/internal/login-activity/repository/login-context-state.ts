import type { Redis } from 'ioredis';
import type { LoginContextUpdateStoreInterface } from '../../../domain/login-activity/interface.js';

export class LoginContextStateRepository implements LoginContextUpdateStoreInterface {
  constructor(private readonly redis: Redis) {}

  async claim(userId: string, loginEventId: string): Promise<boolean> {
    const result = await this.redis.set(this.key(userId, loginEventId), '1', 'EX', 600, 'NX');
    return result === 'OK';
  }

  async release(userId: string, loginEventId: string): Promise<void> {
    await this.redis.del(this.key(userId, loginEventId));
  }

  private key(userId: string, loginEventId: string): string {
    return `login-context:updated:${userId}:${loginEventId}`;
  }
}
