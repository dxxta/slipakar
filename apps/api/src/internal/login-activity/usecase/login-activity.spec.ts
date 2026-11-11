import { describe, expect, it, vi } from 'vitest';
import { LoginActivityUseCase } from './login-activity.js';
import type { LoginActivityRepositoryInterface } from '../../../domain/login-activity/interface.js';

describe('LoginActivityUseCase', () => {
  it('masks other users emails in admin activity but leaves the signed-in admin visible', async () => {
    const mockRepo: LoginActivityRepositoryInterface = {
      create: vi.fn(),
      findMostRecentEvent: vi.fn(),
      updateEventCoordinates: vi.fn(),
      findUserEvents: vi.fn(),
      findAllEvents: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'own', userId: 'admin-1', ip: null, proxy: false, browser: null, os: null,
            deviceType: null, country: null, region: null, city: null, latitude: null,
            longitude: null, createdAt: new Date().toISOString(), userEmail: 'admin@example.com',
          },
          {
            id: 'other', userId: 'user-2', ip: null, proxy: false, browser: null, os: null,
            deviceType: null, country: null, region: null, city: null, latitude: null,
            longitude: null, createdAt: new Date().toISOString(), userEmail: 'person@example.com',
          },
        ],
        total: 2,
      }),
      purgeExpired: vi.fn(),
    };

    const result = await new LoginActivityUseCase(mockRepo).getAdminActivity({}, 'admin-1');
    expect(result.data.map((event) => event.userEmail)).toEqual([
      'admin@example.com',
      '*****@example.com',
    ]);
  });

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
      findMostRecentEvent: vi.fn(),
      updateEventCoordinates: vi.fn(),
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
      findMostRecentEvent: vi.fn(),
      updateEventCoordinates: vi.fn(),
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

  it('rounds browser coordinates and claims a recent event once', async () => {
    const repository: LoginActivityRepositoryInterface = {
      create: vi.fn(),
      findMostRecentEvent: vi.fn().mockResolvedValue({ id: 'event-1' }),
      updateEventCoordinates: vi.fn().mockResolvedValue(true),
      findUserEvents: vi.fn(),
      findAllEvents: vi.fn(),
      purgeExpired: vi.fn(),
    };
    const limiter = { tryAcquire: vi.fn().mockResolvedValue({ allowed: true as const }) };
    const store = { claim: vi.fn().mockResolvedValue(true), release: vi.fn() };
    const useCase = new LoginActivityUseCase(repository, 90, limiter, store);

    await expect(useCase.updateLoginContext('user-1', { latitude: 37.42291, longitude: -122.08411, accuracy: 25 }))
      .resolves.toEqual({ updated: true });
    expect(limiter.tryAcquire).toHaveBeenCalledWith('login-context:user-1', 10);
    expect(repository.updateEventCoordinates).toHaveBeenCalledWith(expect.objectContaining({
      id: 'event-1', userId: 'user-1', latitude: 37.423, longitude: -122.084,
    }));
    expect(store.claim).toHaveBeenCalledWith('user-1', 'event-1');
  });

  it('does nothing when the event was already claimed by a browser update', async () => {
    const repository: LoginActivityRepositoryInterface = {
      create: vi.fn(),
      findMostRecentEvent: vi.fn().mockResolvedValue({ id: 'event-1' }),
      updateEventCoordinates: vi.fn(),
      findUserEvents: vi.fn(),
      findAllEvents: vi.fn(),
      purgeExpired: vi.fn(),
    };
    const limiter = { tryAcquire: vi.fn().mockResolvedValue({ allowed: true as const }) };
    const store = { claim: vi.fn().mockResolvedValue(false), release: vi.fn() };
    const useCase = new LoginActivityUseCase(repository, 90, limiter, store);

    await expect(useCase.updateLoginContext('user-1', { latitude: 1, longitude: 2 })).resolves.toEqual({ updated: false });
    expect(repository.updateEventCoordinates).not.toHaveBeenCalled();
  });

  it('returns updated false when no recent event exists and rate-limits per user', async () => {
    const repository: LoginActivityRepositoryInterface = {
      create: vi.fn(),
      findMostRecentEvent: vi.fn().mockResolvedValue(null),
      updateEventCoordinates: vi.fn(),
      findUserEvents: vi.fn(),
      findAllEvents: vi.fn(),
      purgeExpired: vi.fn(),
    };
    const limiter = { tryAcquire: vi.fn().mockResolvedValueOnce({ allowed: true as const }).mockResolvedValueOnce({ allowed: false as const, retryAfterMs: 6000 }) };
    const store = { claim: vi.fn(), release: vi.fn() };
    const useCase = new LoginActivityUseCase(repository, 90, limiter, store);

    await expect(useCase.updateLoginContext('user-1', { latitude: 1, longitude: 2 })).resolves.toEqual({ updated: false });
    await expect(useCase.updateLoginContext('user-1', { latitude: 1, longitude: 2 })).rejects.toMatchObject({
      status: 429,
      code: 'RATE_LIMITED',
    });
    expect(limiter.tryAcquire).toHaveBeenNthCalledWith(1, 'login-context:user-1', 10);
  });
});
