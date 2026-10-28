import type { Client } from 'minio';
import type { StorageInterface } from '../../domain/storage/interface.js';
import { AppError } from '../../lib/app-error.js';

export function buildStorage({ client, bucket }: { client: Client; bucket: string }): StorageInterface {
  return {
    async ensureBucket(): Promise<void> {
      const exists = await client.bucketExists(bucket);
      if (!exists) {
        await client.makeBucket(bucket);
      }
    },
    async putObject({ key, body, contentType }: { key: string; body: Buffer; contentType: string }): Promise<void> {
      await client.putObject(bucket, key, body, body.length, {
        'Content-Type': contentType,
      });
    },
    async getObject(key: string): Promise<Buffer> {
      try {
        const stream = await client.getObject(bucket, key);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        }
        return Buffer.concat(chunks);
      } catch (error: unknown) {
        const err = error as { code?: string };
        if (err.code === 'NotFound' || err.code === 'NoSuchKey') {
          throw new AppError(404, 'OBJECT_NOT_FOUND', 'Stored file not found');
        }
        throw error;
      }
    },
    async deleteObject(key: string): Promise<void> {
      try {
        await client.removeObject(bucket, key);
      } catch (error: unknown) {
        const err = error as { code?: string };
        if (err.code === 'NotFound' || err.code === 'NoSuchKey') {
          return;
        }
        throw error;
      }
    },
    async objectExists(key: string): Promise<boolean> {
      try {
        await client.statObject(bucket, key);
        return true;
      } catch (error: unknown) {
        const err = error as { code?: string };
        if (err.code === 'NotFound' || err.code === 'NoSuchKey') {
          return false;
        }
        throw error;
      }
    },
  };
}
