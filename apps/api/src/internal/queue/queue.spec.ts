import { EventEmitter } from 'node:events';
import type { ChannelModel, ConsumeMessage } from 'amqplib';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../lib/logger.js';

const { connectMock } = vi.hoisted(() => ({ connectMock: vi.fn() }));

vi.mock('amqplib', () => ({ default: { connect: connectMock } }));

const { buildQueue } = await import('./queue.js');

class FakeChannel extends EventEmitter {
  readonly consumers: Array<{ queue: string; handler: (message: ConsumeMessage | null) => void }> = [];
  readonly assertQueue = vi.fn(async () => ({ queue: 'test', messageCount: 0, consumerCount: 0 }));
  readonly prefetch = vi.fn(async () => undefined);
  readonly consume = vi.fn(async (queue: string, handler: (message: ConsumeMessage | null) => void) => {
    this.consumers.push({ queue, handler });
    return { consumerTag: `tag-${this.consumers.length}` };
  });
  readonly cancel = vi.fn(async () => undefined);
  readonly ack = vi.fn();
  readonly nack = vi.fn();
  readonly close = vi.fn(async () => { this.emit('close'); });
  readonly sendToQueue = vi.fn((_queue: string, _content: Buffer, _options: object, callback?: (error: Error | null) => void) => {
    callback?.(null);
    return true;
  });
}

class FakeConnection extends EventEmitter {
  readonly channel = new FakeChannel();
  readonly createConfirmChannel = vi.fn(async () => this.channel);
  readonly close = vi.fn(async () => { this.emit('close'); });
}

function connectionModel(connection: FakeConnection): ChannelModel {
  return connection as unknown as ChannelModel;
}

function flushMicrotasks(): Promise<void> {
  return Promise.resolve().then(() => undefined).then(() => undefined).then(() => undefined);
}

describe('buildQueue connection lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    connectMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retries startup with exponential backoff and initializes once connected', async () => {
    const connection = new FakeConnection();
    connectMock
      .mockRejectedValueOnce(new Error('broker unavailable'))
      .mockRejectedValueOnce(new Error('broker still unavailable'))
      .mockResolvedValueOnce(connectionModel(connection));
    const queue = buildQueue({ url: 'amqp://secret-user:secret-password@broker:5672', connectRetries: 3, connectBaseDelayMs: 5 });

    const starting = queue.start();
    await flushMicrotasks();
    expect(connectMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5);
    expect(connectMock).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10);
    await expect(starting).resolves.toBeUndefined();
    expect(connectMock).toHaveBeenCalledTimes(3);
    expect(connection.createConfirmChannel).toHaveBeenCalledTimes(1);
    await queue.stop();
  });

  it('fails clearly after the configured number of connection attempts', async () => {
    connectMock.mockRejectedValue(new Error('connection refused'));
    const queue = buildQueue({ url: 'amqp://secret-user:secret-password@broker:5672', connectRetries: 2, connectBaseDelayMs: 3 });

    const starting = queue.start();
    const startError = expect(starting).rejects.toThrow('after 2 attempts');
    await flushMicrotasks();
    await vi.advanceTimersByTimeAsync(3);
    await startError;
    expect(connectMock).toHaveBeenCalledTimes(2);
  });

  it('re-registers each consumer once after an unexpected connection close', async () => {
    const firstConnection = new FakeConnection();
    const secondConnection = new FakeConnection();
    connectMock.mockResolvedValueOnce(connectionModel(firstConnection)).mockResolvedValueOnce(connectionModel(secondConnection));
    const queue = buildQueue({ url: 'amqp://broker:5672', connectRetries: 2, connectBaseDelayMs: 4 });
    const sendHandler = vi.fn(async () => undefined);
    const notifyHandler = vi.fn(async () => undefined);
    await queue.start();
    await queue.consumeSendEmail(sendHandler);
    await queue.consumeNotify(notifyHandler);

    firstConnection.emit('close');
    await vi.advanceTimersByTimeAsync(4);
    await flushMicrotasks();

    expect(connectMock).toHaveBeenCalledTimes(2);
    expect(secondConnection.channel.consume).toHaveBeenCalledTimes(2);
    expect(secondConnection.channel.consumers.map(({ queue: queueName }) => queueName)).toEqual(['send.email', 'notify']);
    await queue.stop();
  });

  it('fails publishing fast while disconnected and publishes after recovery', async () => {
    const firstConnection = new FakeConnection();
    const secondConnection = new FakeConnection();
    connectMock.mockResolvedValueOnce(connectionModel(firstConnection)).mockResolvedValueOnce(connectionModel(secondConnection));
    const queue = buildQueue({ url: 'amqp://broker:5672', connectRetries: 2, connectBaseDelayMs: 5 });
    await queue.start();
    firstConnection.emit('error', new Error('socket closed'));

    await expect(queue.publishSendEmail({ campaignId: 'c1', recipientId: 'r1' })).rejects.toThrow('not connected');
    await vi.advanceTimersByTimeAsync(5);
    await flushMicrotasks();
    await expect(queue.publishSendEmail({ campaignId: 'c1', recipientId: 'r1' })).resolves.toBeUndefined();
    expect(secondConnection.channel.sendToQueue).toHaveBeenCalledTimes(1);
    await queue.stop();
  });

  it('does not reconnect after stop and safely handles a throwing error reporter', async () => {
    const connection = new FakeConnection();
    connectMock.mockResolvedValueOnce(connectionModel(connection));
    const errorReporter = { capture: vi.fn(() => { throw new Error('reporter unavailable'); }) };
    const queue = buildQueue({ url: 'amqp://broker:5672', connectRetries: 2, connectBaseDelayMs: 5, errorReporter });
    await queue.start();
    connection.emit('error', new Error('unexpected broker error'));
    expect(errorReporter.capture).toHaveBeenCalledTimes(1);
    await queue.stop();
    connection.emit('error', new Error('late close'));
    connection.emit('close');
    await vi.advanceTimersByTimeAsync(20);
    expect(connectMock).toHaveBeenCalledTimes(1);
    expect(errorReporter.capture).toHaveBeenCalledTimes(1);
  });

  it('never logs the connection URL when retrying a failed connection', async () => {
    connectMock.mockRejectedValue(new Error('connection refused'));
    const infoSpy = vi.spyOn(logger, 'info');
    const warnSpy = vi.spyOn(logger, 'warn');
    const queue = buildQueue({ url: 'amqp://secret-user:secret-password@broker:5672', connectRetries: 1 });

    await expect(queue.start()).rejects.toThrow('after 1 attempts');
    const logged = JSON.stringify([...infoSpy.mock.calls, ...warnSpy.mock.calls]);
    expect(logged).not.toContain('secret-user');
    expect(logged).not.toContain('secret-password');
    infoSpy.mockRestore();
    warnSpy.mockRestore();
  });
});
