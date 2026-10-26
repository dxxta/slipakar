import { Client } from 'minio';
import { afterAll, describe, expect, it } from 'vitest';
import { startGarage } from './start-garage.js';

describe('startGarage', () => {
  let garage: Awaited<ReturnType<typeof startGarage>> | undefined;

  afterAll(async () => {
    await garage?.stop();
  }, 120_000);

  it('bootstraps a usable S3 service and stops its container', async () => {
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

    expect(await client.bucketExists(garage.bucket)).toBe(true);

    const body = Buffer.from('garage integration bytes');
    await client.putObject(garage.bucket, 'round-trip.txt', body, body.length);
    const stream = await client.getObject(garage.bucket, 'round-trip.txt');
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    expect(Buffer.concat(chunks)).toEqual(body);

    await client.makeBucket('second-bucket', garage.region);
    expect(await client.bucketExists('second-bucket')).toBe(true);

    await expect(client.getObject(garage.bucket, 'missing.txt')).rejects.toMatchObject({ code: 'NoSuchKey' });

    await expect(garage.stop()).resolves.toBeUndefined();
    garage = undefined;
  }, 120_000);
});
