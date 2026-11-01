import type {
  CreateBroadcastDto,
  UpdateBroadcastDto,
  ListBroadcastsQueryDto,
  BroadcastView,
  BroadcastPreview,
  BroadcastCounts,
} from './dto.js';

export interface TargetRecipient {
  id: string;
  email: string;
  name: string;
}

export interface BroadcastRepositoryInterface {
  create(createdBy: string, data: CreateBroadcastDto): Promise<BroadcastView>;
  findById(id: string): Promise<BroadcastView | null>;
  findMany(query: ListBroadcastsQueryDto): Promise<{ data: BroadcastView[]; total: number }>;
  update(id: string, data: UpdateBroadcastDto): Promise<BroadcastView>;
  delete(id: string): Promise<void>;
  updateStatus(
    id: string,
    status: 'draft' | 'sent',
    sentAt: Date | null,
    counts: BroadcastCounts,
  ): Promise<BroadcastView>;
  resolveRecipients(
    audience: string,
    audienceFilter?: Record<string, unknown> | null,
  ): Promise<TargetRecipient[]>;
  createNoticesForBroadcast(
    broadcastId: string,
    recipients: TargetRecipient[],
    title: string,
    message: string,
  ): Promise<number>;
}

export interface BroadcastUseCaseInterface {
  createBroadcast(adminUserId: string, payload: unknown): Promise<BroadcastView>;
  getBroadcast(id: string): Promise<BroadcastView>;
  listBroadcasts(
    query: unknown,
  ): Promise<{ data: BroadcastView[]; metadata: { page: number; limit: number; total: number } }>;
  updateBroadcast(id: string, payload: unknown): Promise<BroadcastView>;
  deleteBroadcast(id: string): Promise<void>;
  previewBroadcast(id: string): Promise<BroadcastPreview>;
  sendBroadcast(id: string): Promise<BroadcastView>;
}
