import type { Notification, Prisma } from '@prisma/client';
import type {
  RepositoryResponse,
  ResponseTypeWithoutMetadata,
  ResponseTypeWithMetadata,
} from '../../lib/types.js';
import type { NotifyMessage } from '../queue/interface.js';
import type { ListNotificationsSortBy } from './dto.js';

export type NotificationView = Omit<Notification, 'createdAt' | 'readAt'> & {
  createdAt: string;
  readAt: string | null;
};

export type CreateNotificationPayload = {
  projectId: string;
  campaignId?: string | null;
  type: string;
  message: string;
};

export type NotificationFilter = {
  projectId: string;
  unread?: boolean;
  q?: string;
};

export interface NotificationsRepositoryInterface {
  createNotificationsRepository(args: {
    payload: CreateNotificationPayload;
    auditUserId: string;
    tx?: Prisma.TransactionClient;
  }): Promise<RepositoryResponse<Notification>>;

  findAllNotificationsRepository(args: {
    filter: NotificationFilter;
    page: number;
    limit: number;
    sortBy: ListNotificationsSortBy;
    sortDir: 'asc' | 'desc';
  }): Promise<RepositoryResponse<Notification[]>>;

  markReadNotificationsRepository(args: {
    filter: { projectId: string; id: string };
    readAt: Date;
    auditUserId: string;
    tx?: Prisma.TransactionClient;
  }): Promise<RepositoryResponse<Notification | null>>;

  markAllReadNotificationsRepository(args: {
    filter: { projectId: string };
    readAt: Date;
    auditUserId: string;
    tx?: Prisma.TransactionClient;
  }): Promise<RepositoryResponse<number>>;

  countUnreadNotificationsRepository(args: {
    filter: { userId: string };
  }): Promise<RepositoryResponse<number>>;
}

export interface NotificationsUseCaseInterface {
  handleNotify(message: NotifyMessage): Promise<void>;
  listNotificationsUseCase(args: {
    projectId: string;
    query: unknown;
    auditUserId: string;
  }): Promise<ResponseTypeWithMetadata<NotificationView[]>>;
  markReadNotificationUseCase(args: {
    projectId: string;
    id: string;
    auditUserId: string;
  }): Promise<ResponseTypeWithoutMetadata<NotificationView>>;
  markAllNotificationsReadUseCase(args: {
    projectId: string;
    auditUserId: string;
  }): Promise<ResponseTypeWithoutMetadata<{ count: number }>>;
  getUnreadNotificationsCountUseCase(args: {
    auditUserId: string;
  }): Promise<ResponseTypeWithoutMetadata<{ count: number }>>;
}
