import { Client } from 'minio';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { StorageInterface } from '../../domain/storage/interface.js';
import { buildStorage } from '../storage/storage.js';
import { startGarage } from '../../test-support/start-garage.js';
import { buildErrorLogSink } from './sink.js';
import { buildErrorReporter } from './reporter.js';

describe('Error reporting MinIO storage integration', () => {
  let garage: Awaited<ReturnType<typeof startGarage>>;
  let storage: StorageInterface;
  const bucket = 'slipakar-error-logs';

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
    await storage.ensureBucket();
  }, 120_000);

  afterAll(async () => {
    await garage?.stop();
  }, 120_000);

  it('records error with secrets and flushes to MinIO: object exists under logs/errors/, parses as valid JSON, and contains no secret values', async () => {
    const fixedTime = new Date('2026-11-08T15:30:45.000Z');
    let generatedKey = '';

    const sink = buildErrorLogSink({
      storage,
      now: () => fixedTime,
      idFactory: () => 'e2etestid',
    });

    const reporter = buildErrorReporter({
      sink,
      now: () => fixedTime,
    });

    // Capture an error containing secret credentials in message and context
    const secretPassword = 'SUPER_SECRET_PASSWORD_123';
    const secretApiKey = 'API_KEY_SECRET_XYZ';
    const secretToken = 'BEARER_TOKEN_ABCDEF';

    reporter.capture(new Error('Failed database authentication with user root'), {
      password: secretPassword,
      api_key: secretApiKey,
      authorization: `Bearer ${secretToken}`,
      regularContext: 'safe-public-data',
    });

    await sink.flush();

    // Key format: logs/errors/YYYY/MM/DD/HHmmss-id.jsonl
    generatedKey = 'logs/errors/2026/11/08/153045-e2etestid.jsonl';

    // Verify object exists in MinIO
    const exists = await storage.objectExists(generatedKey);
    expect(exists).toBe(true);

    // Retrieve object body and verify
    const buffer = await storage.getObject(generatedKey);
    const content = buffer.toString('utf8');

    // Parse every line as JSON
    const lines = content.trim().split('\n');
    expect(lines.length).toBeGreaterThan(0);

    for (const line of lines) {
      const parsed = JSON.parse(line);
      expect(parsed).toBeDefined();
      expect(parsed.time).toBe('2026-11-08T15:30:45.000Z');
      expect(parsed.fingerprint).toBeDefined();
      expect(parsed.context.regularContext).toBe('safe-public-data');
    }

    // Verify absolutely no secrets exist anywhere in the stored object content
    expect(content).not.toContain(secretPassword);
    expect(content).not.toContain(secretApiKey);
    expect(content).not.toContain(secretToken);
    expect(content).toContain('[redacted]');
  });
});
