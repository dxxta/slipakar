import { startContainer } from '../../test-support/start-container.js';
import { createServer } from 'node:net';
import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { queueNames, type SendEmailMessage } from '../../domain/queue/interface.js';
import { buildQueue } from './queue.js';

async function getAvailablePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not determine an available port');
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  return address.port;
}

describe('RabbitMQ queue integration with testcontainers', () => {
  let container: StartedTestContainer;
  let amqpUrl: string;

  beforeAll(async () => {
    const hostPort = await getAvailablePort();
    container = await startContainer(() => new GenericContainer('rabbitmq:3.13-management-alpine')
      .withExposedPorts({ container: 5672, host: hostPort })
      .withWaitStrategy(Wait.forLogMessage(/Server startup complete/))
      .start());

    const host = container.getHost();
    const port = container.getMappedPort(5672);
    amqpUrl = `amqp://${host}:${port}`;
  }, 120_000);

  afterAll(async () => {
    await container?.stop();
  }, 120_000);

  it('publish then consume receives the same message', async () => {
    const queue = buildQueue({ url: amqpUrl });
    await queue.start();

    const testMsg: SendEmailMessage = { campaignId: 'c-1', recipientId: 'r-1' };
    const received: SendEmailMessage[] = [];

    await queue.consumeSendEmail(async (msg) => {
      received.push(msg);
    });

    await queue.publishSendEmail(testMsg);

    // Wait until message is processed
    await vi.waitFor(() => {
      expect(received).toHaveLength(1);
    }, { timeout: 5000 });

    expect(received[0]).toEqual(testMsg);
    await queue.stop();
  });

  it('reconnects after RabbitMQ restarts and preserves the registered consumer', async () => {
    const queue = buildQueue({ url: amqpUrl });
    await queue.start();
    const received: SendEmailMessage[] = [];
    await queue.consumeSendEmail(async (message) => {
      received.push(message);
    });

    const firstMessage = { campaignId: 'c-reconnect-1', recipientId: 'r-1' };
    await queue.publishSendEmail(firstMessage);
    await vi.waitFor(() => expect(received).toEqual([firstMessage]), { timeout: 5000 });

    const originalPort = container.getMappedPort(5672);
    await container.restart();
    expect(container.getMappedPort(5672)).toBe(originalPort);

    const secondMessage = { campaignId: 'c-reconnect-2', recipientId: 'r-2' };
    await vi.waitFor(async () => {
      await queue.publishSendEmail(secondMessage);
    }, { timeout: 75_000, interval: 100 });
    await vi.waitFor(() => expect(received).toContainEqual(secondMessage), { timeout: 5000 });
    await queue.stop();
  }, 100_000);

  it('a handler that rejects sends the message to the DLQ', async () => {
    const queue = buildQueue({ url: amqpUrl });
    await queue.start();

    const testMsg: SendEmailMessage = { campaignId: 'c-dlq', recipientId: 'r-dlq' };
    const dlqMessages: SendEmailMessage[] = [];

    // Main queue consumer rejects
    await queue.consumeSendEmail(async () => {
      throw new Error('Simulated processing failure');
    });

    // DLQ consumer using amqplib directly or custom consumer on dlq queue
    // We connect to inspect DLQ
    const amqplib = await import('amqplib');
    const conn = await amqplib.connect(amqpUrl);
    const ch = await conn.createChannel();
    await ch.consume(queueNames.sendEmailDlq, (msg) => {
      if (msg) {
        dlqMessages.push(JSON.parse(msg.content.toString()) as SendEmailMessage);
        ch.ack(msg);
      }
    });

    await queue.publishSendEmail(testMsg);

    await vi.waitFor(() => {
      expect(dlqMessages).toHaveLength(1);
    }, { timeout: 5000 });

    expect(dlqMessages[0]).toEqual(testMsg);

    await ch.close();
    await conn.close();
    await queue.stop();
  });

  it('consumer processes messages one at a time (prefetch 1)', async () => {
    const queue = buildQueue({ url: amqpUrl });
    await queue.start();

    let concurrent = 0;
    let maxConcurrent = 0;

    await queue.consumeSendEmail(async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((resolve) => setTimeout(resolve, 50));
      concurrent--;
    });

    await queue.publishSendEmail({ campaignId: 'c-seq-1', recipientId: 'r-1' });
    await queue.publishSendEmail({ campaignId: 'c-seq-2', recipientId: 'r-2' });
    await queue.publishSendEmail({ campaignId: 'c-seq-3', recipientId: 'r-3' });

    await vi.waitFor(() => {
      expect(maxConcurrent).toBe(1);
      expect(concurrent).toBe(0);
    }, { timeout: 5000 });

    await queue.stop();
  });

  it('records queue metrics on processed and rejected outcomes', async () => {
    const fakeMetrics = {
      recordHttpRequest: vi.fn(),
      recordEmailResult: vi.fn(),
      recordQueueMessage: vi.fn(),
      recordRateLimitWait: vi.fn(),
      recordCampaignFinished: vi.fn(),
      render: vi.fn().mockResolvedValue(''),
      contentType: 'text/plain',
    };

    const queue = buildQueue({ url: amqpUrl, metrics: fakeMetrics });
    await queue.start();

    let shouldFail = true;
    await queue.consumeSendEmail(async () => {
      if (shouldFail) {
        throw new Error('boom');
      }
    });

    await queue.publishSendEmail({ campaignId: 'c-fail', recipientId: 'r-fail' });

    await vi.waitFor(() => {
      expect(fakeMetrics.recordQueueMessage).toHaveBeenCalledWith({
        queue: queueNames.sendEmail,
        outcome: 'rejected',
      });
    }, { timeout: 5000 });

    shouldFail = false;
    await queue.publishSendEmail({ campaignId: 'c-ok', recipientId: 'r-ok' });

    await vi.waitFor(() => {
      expect(fakeMetrics.recordQueueMessage).toHaveBeenCalledWith({
        queue: queueNames.sendEmail,
        outcome: 'processed',
      });
    }, { timeout: 5000 });

    await queue.stop();
  });

  it('stop() gracefully waits for in-flight handlers and does not cause unhandled rejection on channel operations', async () => {
    const queue = buildQueue({ url: amqpUrl });
    await queue.start();

    let handlerStarted = false;
    let handlerFinished = false;

    await queue.consumeSendEmail(async () => {
      handlerStarted = true;
      // Simulate work taking 200ms
      await new Promise((resolve) => setTimeout(resolve, 200));
      handlerFinished = true;
      throw new Error('Simulated post-work failure triggering nack');
    });

    await queue.publishSendEmail({ campaignId: 'c-stop', recipientId: 'r-stop' });

    // Wait until handler is actively running
    await vi.waitFor(() => {
      expect(handlerStarted).toBe(true);
    }, { timeout: 5000 });

    // Now call stop() while the handler is still executing and will subsequently nack
    await queue.stop();

    expect(handlerFinished).toBe(true);
  });
});
