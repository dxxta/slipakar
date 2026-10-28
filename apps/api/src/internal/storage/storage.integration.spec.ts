import { Client } from 'minio';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { StorageInterface } from '../../../domain/storage/interface.js';
import { startGarage } from '../../test-support/start-garage.js';
import { buildStorage } from './storage.js';

describe('storage integration with real MinIO', () => {
  let garage: Awaited<ReturnType<typeof startGarage>>;
  let storage: StorageInterface;
  const bucket = 'test-bucket';

  beforeAll(async () => {
    garage = await startGarage();
    const client = new Client({
      endPoint: garage.endpoint,
      port: garage.port,
      useSSL: false,
      accessKey: garage.accessKey,
      secretKey: garage.secretKey,
      region: garage.region,
      pathStyle: garage.pathStyle,
    });
    storage = buildStorage({ client, bucket });
  }, 120_000);

  afterAll(async () => {
    await garage?.stop();
  }, 120_000);

  it('ensureBucket twice is fine', async () => {
    await expect(storage.ensureBucket()).resolves.toBeUndefined();
    await expect(storage.ensureBucket()).resolves.toBeUndefined();
  });

  it('put then get returns the same bytes', async () => {
    const key = 'test-folder/test-file.txt';
    const body = Buffer.from('hello world minio');
    await storage.putObject({ key, body, contentType: 'text/plain' });

    const downloaded = await storage.getObject(key);
    expect(downloaded.equals(body)).toBe(true);
  });

  it('put then objectExists true', async () => {
    const key = 'test-folder/exists.txt';
    await storage.putObject({ key, body: Buffer.from('check exists'), contentType: 'text/plain' });
    expect(await storage.objectExists(key)).toBe(true);
  });

  it('delete then objectExists false', async () => {
    const key = 'test-folder/to-delete.txt';
    await storage.putObject({ key, body: Buffer.from('delete me'), contentType: 'text/plain' });
    expect(await storage.objectExists(key)).toBe(true);

    await storage.deleteObject(key);
    expect(await storage.objectExists(key)).toBe(false);
  });

  it('get of a missing key throws OBJECT_NOT_FOUND', async () => {
    const key = 'non-existent-key.bin';
    await expect(storage.getObject(key)).rejects.toMatchObject({
      status: 404,
      code: 'OBJECT_NOT_FOUND',
      message: 'Stored file not found',
    });
  });

  it('delete of a missing key does not throw', async () => {
    const key = 'another-missing-key.bin';
    await expect(storage.deleteObject(key)).resolves.toBeUndefined();
  });
});
