import { describe, expect, it, vi } from 'vitest';
import { LoginActivityUseCase } from './login-activity.js';
import type { LoginActivityRepositoryInterface } from '../../../domain/login-activity/interface.js';

describe('LoginActivityUseCase', () => {
  it('records login event with parsed ua, proxy and geoip info', async () => {
    const mockRepo: LoginActivityRepositoryInterface = {
      create: vi.fn().mockImplementation((data) =>
        Promise.resolve({
          id: 'event-1',
          ...data,
          ip: data.ipAddress,
          createdAt: new Date(),
        }),
      ),
      findUserEvents: vi.fn(),
      findAllEvents: vi.fn(),
      purgeExpired: vi.fn(),
    };

    const useCase = new LoginActivityUseCase(mockRepo, 90);
    const result = await useCase.recordLogin({
      userId: 'user-1',
      ipAddress: '8.8.8.8',
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    });

    expect(result.userId).toBe('user-1');
    expect(result.browser).toBe('Chrome');
    expect(result.os).toBe('macOS');
    expect(result.deviceType).toBe('desktop');
    expect(result.country).toBe('US');
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        browser: 'Chrome',
        country: 'US',
      }),
    );
  });

  it('marks proxy as false and country as null for private IP', async () => {
    const mockRepo: LoginActivityRepositoryInterface = {
      create: vi.fn().mockImplementation((data) =>
        Promise.resolve({
          id: 'event-1',
          ...data,
          ip: data.ipAddress,
          createdAt: new Date(),
        }),
      ),
      findUserEvents: vi.fn(),
      findAllEvents: vi.fn(),
      purgeExpired: vi.fn(),
    };

    const useCase = new LoginActivityUseCase(mockRepo, 90);
    const result = await useCase.recordLogin({
      userId: 'user-1',
      ipAddress: '127.0.0.1',
    });

    expect(result.proxy).toBe(false);
    expect(result.country).toBeNull();
  });
});
