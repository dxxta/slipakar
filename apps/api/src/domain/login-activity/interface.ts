import type {
  ListLoginActivityQueryDto,
  ListAdminLoginActivityQueryDto,
  LoginEventView,
} from './dto.js';

export interface CreateLoginEventData {
  userId: string;
  ipAddress?: string | null;
  proxy: boolean;
  browser?: string | null;
  os?: string | null;
  deviceType?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface LoginActivityRepositoryInterface {
  create(data: CreateLoginEventData): Promise<LoginEventView>;
  findMostRecentEvent(userId: string, createdAfter: Date): Promise<{ id: string } | null>;
  updateEventCoordinates(args: {
    id: string;
    userId: string;
    createdAfter: Date;
    latitude: number;
    longitude: number;
  }): Promise<boolean>;
  findUserEvents(
    userId: string,
    query: ListLoginActivityQueryDto,
  ): Promise<{ data: LoginEventView[]; total: number }>;
  findAllEvents(
    query: ListAdminLoginActivityQueryDto,
  ): Promise<{ data: LoginEventView[]; total: number }>;
  purgeExpired(retentionDays: number): Promise<number>;
}

export type LoginContextRateLimiterInterface = {
  tryAcquire(key: string, limitPerMinute: number): Promise<{ allowed: true } | { allowed: false; retryAfterMs: number }>;
};

export type LoginContextUpdateStoreInterface = {
  claim(userId: string, loginEventId: string): Promise<boolean>;
  release(userId: string, loginEventId: string): Promise<void>;
};

export interface LoginActivityUseCaseInterface {
  getUserActivity(
    userId: string,
    query: unknown,
  ): Promise<{ data: LoginEventView[]; metadata: { page: number; limit: number; total: number } }>;
  getAdminActivity(
    query: unknown,
    adminUserId: string,
  ): Promise<{ data: LoginEventView[]; metadata: { page: number; limit: number; total: number } }>;
  recordLogin(data: {
    userId: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    forwardedFor?: string | string[] | null;
  }): Promise<LoginEventView>;
  updateLoginContext(userId: string, payload: unknown): Promise<{ updated: boolean }>;
  purgeExpired(): Promise<number>;
}
