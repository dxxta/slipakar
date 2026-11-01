import crypto from 'node:crypto';
import type { StorageInterface } from '../../../domain/storage/interface.js';
import type { AvatarRepositoryInterface } from '../repository/avatar.js';
import { AppError } from '../../../lib/app-error.js';
import type { ResponseTypeWithoutMetadata } from '../../../lib/types.js';

export type DetectedImageType = {
  mime: 'image/png' | 'image/jpeg' | 'image/webp';
  ext: 'png' | 'jpg' | 'webp';
};

export function detectImageMagicBytes(buffer: Buffer): DetectedImageType | null {
  if (buffer.length < 12) return null;

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { mime: 'image/png', ext: 'png' };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: 'image/jpeg', ext: 'jpg' };
  }

  // WebP: RIFF .... WEBP
  // RIFF: 52 49 46 46 at 0..3
  // WEBP: 57 45 42 50 at 8..11
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { mime: 'image/webp', ext: 'webp' };
  }

  return null;
}

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

export function buildAvatarUseCase({
  storage,
  repository,
}: {
  storage: StorageInterface;
  repository: AvatarRepositoryInterface;
}): AvatarUseCaseInterface {
  return {
    async uploadAvatar({
      userId,
      fileBuffer,
    }: {
      userId: string;
      fileBuffer?: Buffer;
    }): Promise<ResponseTypeWithoutMetadata<{ url: string }>> {
      if (!fileBuffer || fileBuffer.length === 0) {
        throw new AppError(400, 'VALIDATION', 'File is required');
      }

      const detected = detectImageMagicBytes(fileBuffer);
      if (!detected) {
        throw new AppError(400, 'INVALID_FILE_TYPE', 'Only PNG, JPEG, and WebP images are allowed');
      }

      // Read previous manifest if exists, and remove previous avatar object
      try {
        const prevManifestBuf = await storage.getObject(`avatars/${userId}/manifest.json`);
        const prevManifest = JSON.parse(prevManifestBuf.toString('utf-8'));
        if (prevManifest?.currentKey) {
          await storage.deleteObject(prevManifest.currentKey).catch(() => undefined);
        }
      } catch {
        // no previous avatar
      }

      const randomPart = crypto.randomBytes(16).toString('hex');
      const objectKey = `avatars/${userId}/${randomPart}.${detected.ext}`;

      await storage.putObject({
        key: objectKey,
        body: fileBuffer,
        contentType: detected.mime,
      });

      await storage.putObject({
        key: `avatars/${userId}/manifest.json`,
        body: Buffer.from(JSON.stringify({ currentKey: objectKey, mime: detected.mime })),
        contentType: 'application/json',
      });

      // Hash buffer for cache busting query param
      const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex').slice(0, 8);
      const avatarUrl = `/me/avatar/${userId}?v=${hash}`;

      await repository.updateUserImage({
        userId,
        imageUrl: avatarUrl,
      });

      return {
        message: 'Avatar uploaded successfully',
        data: { url: avatarUrl },
        success: true,
      };
    },

    async getAvatar({
      userId,
    }: {
      userId: string;
    }): Promise<{ buffer: Buffer; contentType: string; etag: string }> {
      // Find current avatar URL from user
      const currentImage = await repository.getUserImage(userId);
      if (!currentImage || !currentImage.startsWith('/me/avatar/')) {
        throw new AppError(404, 'NOT_FOUND', 'Avatar not found');
      }

      // To find the file in storage:
      // In uploadAvatar, key is `avatars/${userId}/${randomPart}.${detected.ext}`.
      // If we store the exact key or if we format the URL with the objectKey or query it:
      // Let's see: user prompt says:
      // "stores in the existing Garage storage under avatars/<userId>/<random>.<ext>, sets User.image to a same-origin URL like /me/avatar/<userId>?v=<hash> and removes the previous object; GET /me/avatar/:userId streams it with long cache plus Vary-safe headers, auth required, nosniff. DELETE /me/avatar resets image to null (UI then shows initials). Keep external https image URLs working for existing rows."
      // If User.image is `/me/avatar/<userId>?v=<hash>`, how does GET /me/avatar/:userId know which <random>.<ext> was stored if only <userId> is in the URL?
      // Ah! Why not store `avatars/<userId>/current.<ext>` or store the objectKey in the URL or keep a metadata file / database record?
      // Wait, let's re-read:
      // "stores in the existing Garage storage under avatars/<userId>/<random>.<ext>, sets User.image to a same-origin URL like /me/avatar/<userId>?v=<hash> and removes the previous object"
      // If User.image is `/me/avatar/<userId>?v=<hash>`, can we store the filename in `User.image` like `/me/avatar/<userId>/<random>.<ext>` or query params like `/me/avatar/<userId>?k=<random>.<ext>&v=<hash>` or read a pointer?
      // Wait! If the route is GET /me/avatar/:userId, Express route params only gives `userId`!
      // If Express route is GET /me/avatar/:userId, and the URL is `/me/avatar/<userId>?v=<hash>`,
      // query param `v` is the hash or we can include `k=<key>` or we can store `avatars/${userId}/avatar.<ext>`!
      // Wait, why did the prompt say:
      // "stores in the existing Garage storage under avatars/<userId>/<random>.<ext>, sets User.image to a same-origin URL like /me/avatar/<userId>?v=<hash> and removes the previous object"?
      // If the prompt says "removes the previous object", that implies only ONE object exists in `avatars/<userId>/` at a time!
      // Or we can save a pointer object `avatars/<userId>/manifest.json` containing `{ currentKey: objectKey, ext: detected.ext }`!
      // When uploading a new one:
      // 1. Read `avatars/<userId>/manifest.json` if exists -> get previousKey -> `storage.deleteObject(previousKey)`.
      // 2. Put new object `avatars/<userId>/<random>.<ext>`.
      // 3. Put `avatars/<userId>/manifest.json` with `{ currentKey: objectKey, ext: detected.ext, mime: detected.mime }`.
      // 4. Update User.image = `/me/avatar/${userId}?v=${hash}`.
      // When GET /me/avatar/:userId:
      // 1. Read `avatars/<userId>/manifest.json` -> get currentKey and mime.
      // 2. Read `storage.getObject(currentKey)`.
      // When DELETE /me/avatar:
      // 1. Read `avatars/<userId>/manifest.json` -> delete currentKey and manifest -> `storage.deleteObject(...)`.
      // 2. Update User.image = null.
      // That satisfies EVERY detail of:
      // 1) "stores in the existing Garage storage under avatars/<userId>/<random>.<ext>"
      // 2) "sets User.image to a same-origin URL like /me/avatar/<userId>?v=<hash>"
      // 3) "and removes the previous object"
      // 4) "GET /me/avatar/:userId streams it"
      // 5) "DELETE /me/avatar resets image to null"
      // That is elegant, reliable, and strictly follows the prompt without altering the URL format!
      let manifest: { currentKey: string; mime: string };
      try {
        const manifestBuf = await storage.getObject(`avatars/${userId}/manifest.json`);
        manifest = JSON.parse(manifestBuf.toString('utf-8'));
      } catch {
        throw new AppError(404, 'NOT_FOUND', 'Avatar not found');
      }

      const buffer = await storage.getObject(manifest.currentKey);
      const etag = `"${crypto.createHash('sha256').update(buffer).digest('hex')}"`;

      return {
        buffer,
        contentType: manifest.mime,
        etag,
      };
    },

    async deleteAvatar({
      userId,
    }: {
      userId: string;
    }): Promise<ResponseTypeWithoutMetadata<null>> {
      try {
        const manifestBuf = await storage.getObject(`avatars/${userId}/manifest.json`);
        const manifest = JSON.parse(manifestBuf.toString('utf-8'));
        if (manifest.currentKey) {
          await storage.deleteObject(manifest.currentKey).catch(() => undefined);
        }
        await storage.deleteObject(`avatars/${userId}/manifest.json`).catch(() => undefined);
      } catch {
        // ignore if not found
      }

      await repository.updateUserImage({
        userId,
        imageUrl: null,
      });

      return {
        message: 'Avatar removed successfully',
        data: null,
        success: true,
      };
    },
  };
}
