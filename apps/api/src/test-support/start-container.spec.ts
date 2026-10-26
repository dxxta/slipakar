import { describe, expect, it, vi } from 'vitest';
import { startContainer } from './start-container.js';

describe('startContainer', () => {
  it('returns the container when startup succeeds immediately', async () => {
    const start = vi.fn().mockResolvedValue('container');

    await expect(startContainer(start)).resolves.toBe('container');
    expect(start).toHaveBeenCalledOnce();
  });

  it('retries a port binding timeout and then succeeds', async () => {
    const start = vi.fn()
      .mockRejectedValueOnce(new Error('Timed out after 30000ms while waiting for container ports to be bound to the host'))
      .mockResolvedValueOnce('container');

    await expect(startContainer(start)).resolves.toBe('container');
    expect(start).toHaveBeenCalledTimes(2);
  });

  it('does not retry a non-retryable error', async () => {
    const start = vi.fn().mockRejectedValue(new Error('database migration failed'));

    await expect(startContainer(start)).rejects.toThrow('database migration failed');
    expect(start).toHaveBeenCalledOnce();
  });

  it('throws the last retryable error after attempts are exhausted', async () => {
    const start = vi.fn()
      .mockRejectedValueOnce(new Error('Timed out after 30000ms while waiting for container ports to be bound'))
      .mockRejectedValueOnce(new Error('Timed out after 30000ms while waiting for container ports to be bound'));
    const finalError = new Error('Timed out after 30000ms while waiting for container ports to be bound');
    start.mockRejectedValueOnce(finalError);

    await expect(startContainer(start, { attempts: 3 })).rejects.toBe(finalError);
    expect(start).toHaveBeenCalledTimes(3);
  });
});
