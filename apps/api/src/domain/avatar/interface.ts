import type { ResponseTypeWithoutMetadata } from '../../lib/types.js';

export interface AvatarUseCaseInterface {
  uploadAvatar(args: {
    userId: string;
    fileBuffer?: Buffer;
  }): Promise<ResponseTypeWithoutMetadata<{ url: string }>>;

  getAvatar(args: {
    userId: string;
  }): Promise<{ buffer: Buffer; contentType: string; etag: string }>;

  deleteAvatar(args: {
    userId: string;
  }): Promise<ResponseTypeWithoutMetadata<null>>;
}
