import amqplib, { type ChannelModel, type ConfirmChannel, type ConsumeMessage } from 'amqplib';
import {
  queueNames,
  type NotifyMessage,
  type QueueInterface,
  type SendEmailMessage,
} from '../../domain/queue/interface.js';
import type { MetricsInterface } from '../../domain/metrics/interface.js';
import type { ErrorReporter } from '../../domain/error-reporting/interface.js';
import { logger } from '../../lib/logger.js';
import { noopMetrics } from '../metrics/noop.js';

const DEFAULT_CONNECT_RETRIES = 10;
const DEFAULT_CONNECT_BASE_DELAY_MS = 500;
const MAX_CONNECT_DELAY_MS = 10_000;

type ConsumerRegistration = {
  queue: typeof queueNames.sendEmail | typeof queueNames.notify;
  handler: ((message: SendEmailMessage) => Promise<void>) | ((message: NotifyMessage) => Promise<void>);
  channel: ConfirmChannel | null;
  consumerTag: string | null;
};

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Unknown queue connection error');
}

function safeErrorMessage(error: unknown, connectionUrl: string): string {
  const message = asError(error).message;
  return message
    .replaceAll(connectionUrl, '[redacted connection URL]')
    .replace(/amqps?:\/\/[^\s]+/g, '[redacted connection URL]');
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function retryDelay(baseDelayMs: number, failedAttempt: number): number {
  return Math.min(baseDelayMs * 2 ** Math.max(failedAttempt - 1, 0), MAX_CONNECT_DELAY_MS);
}

export function buildQueue({
  url,
  metrics = noopMetrics,
  connectRetries = DEFAULT_CONNECT_RETRIES,
  connectBaseDelayMs = DEFAULT_CONNECT_BASE_DELAY_MS,
  errorReporter,
}: {
  url: string;
  metrics?: MetricsInterface;
  connectRetries?: number;
  connectBaseDelayMs?: number;
  errorReporter?: ErrorReporter;
}): QueueInterface {
  if (!Number.isInteger(connectRetries) || connectRetries < 1) {
    throw new RangeError('connectRetries must be a positive integer');
  }
  if (!Number.isFinite(connectBaseDelayMs) || connectBaseDelayMs < 0) {
    throw new RangeError('connectBaseDelayMs must be a non-negative number');
  }

  let connection: ChannelModel | null = null;
  let confirmChannel: ConfirmChannel | null = null;
  let isConnected = false;
  let isStarted = false;
  let isStarting = false;
  let isStopping = false;
  let isReconnecting = false;
  let generation = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  const registrations: ConsumerRegistration[] = [];
  const pendingPublishRejectors = new Set<(error: Error) => void>();
  const inFlightHandlers = new Set<Promise<unknown>>();

  const captureFailure = (error: unknown, context: Record<string, unknown>): void => {
    try {
      errorReporter?.capture(error, { component: 'queue', ...context });
    } catch {
      // A reporter failure must not disrupt queue recovery.
    }
  };

  const getConfirmChannel = (): ConfirmChannel => {
    if (!isConnected || !connection || !confirmChannel) {
      throw new Error('Queue is not connected');
    }
    return confirmChannel;
  };

  const rejectPendingPublishes = (message: string): void => {
    const error = new Error(message);
    for (const reject of pendingPublishRejectors) reject(error);
    pendingPublishRejectors.clear();
  };

  const clearRegistrationsForChannel = (channel: ConfirmChannel | null): void => {
    if (!channel) return;
    for (const registration of registrations) {
      if (registration.channel === channel) {
        registration.channel = null;
        registration.consumerTag = null;
      }
    }
  };

  const safeChannelOp = (channel: ConfirmChannel, operation: () => void): void => {
    if (isStopping || confirmChannel !== channel) return;
    try {
      operation();
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('Channel closed')) return;
      throw error;
    }
  };

  const trackHandler = (task: Promise<unknown>): void => {
    inFlightHandlers.add(task);
    void task.finally(() => inFlightHandlers.delete(task));
  };

  const handleSendEmail = async (
    channel: ConfirmChannel,
    rawMessage: ConsumeMessage | null,
    handler: (message: SendEmailMessage) => Promise<void>,
  ): Promise<void> => {
    if (!rawMessage) return;
    try {
      const parsed = JSON.parse(rawMessage.content.toString()) as SendEmailMessage;
      const attemptHeader = rawMessage.properties.headers?.['x-attempt'];
      if (parsed.attempt === undefined && typeof attemptHeader === 'number') parsed.attempt = attemptHeader;
      await handler(parsed);
      metrics.recordQueueMessage({ queue: queueNames.sendEmail, outcome: 'processed' });
      safeChannelOp(channel, () => channel.ack(rawMessage));
    } catch {
      metrics.recordQueueMessage({ queue: queueNames.sendEmail, outcome: 'rejected' });
      safeChannelOp(channel, () => channel.nack(rawMessage, false, false));
    }
  };

  const handleNotify = async (
    channel: ConfirmChannel,
    rawMessage: ConsumeMessage | null,
    handler: (message: NotifyMessage) => Promise<void>,
  ): Promise<void> => {
    if (!rawMessage) return;
    try {
      const parsed = JSON.parse(rawMessage.content.toString()) as NotifyMessage;
      await handler(parsed);
      metrics.recordQueueMessage({ queue: queueNames.notify, outcome: 'processed' });
      safeChannelOp(channel, () => channel.ack(rawMessage));
    } catch {
      metrics.recordQueueMessage({ queue: queueNames.notify, outcome: 'rejected' });
      safeChannelOp(channel, () => channel.nack(rawMessage, false, false));
    }
  };

  const registerConsumer = async (channel: ConfirmChannel, registration: ConsumerRegistration): Promise<void> => {
    if (registration.channel === channel) return;
    await channel.prefetch(1);
    const consume = registration.queue === queueNames.sendEmail
      ? channel.consume(registration.queue, (rawMessage) => {
        const handler = registration.handler as (message: SendEmailMessage) => Promise<void>;
        trackHandler(handleSendEmail(channel, rawMessage, handler));
      })
      : channel.consume(registration.queue, (rawMessage) => {
        const handler = registration.handler as (message: NotifyMessage) => Promise<void>;
        trackHandler(handleNotify(channel, rawMessage, handler));
      });
    const result = await consume;
    if (confirmChannel !== channel) throw new Error('Queue disconnected while registering a consumer');
    registration.channel = channel;
    registration.consumerTag = result.consumerTag;
  };

  const assertQueues = async (channel: ConfirmChannel): Promise<void> => {
    await channel.assertQueue(queueNames.sendEmailDlq, { durable: true });
    await channel.assertQueue(queueNames.notifyDlq, { durable: true });
    await channel.assertQueue(queueNames.sendEmailRetry, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': queueNames.sendEmail,
      },
    });
    await channel.assertQueue(queueNames.sendEmail, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': queueNames.sendEmailDlq,
      },
    });
    await channel.assertQueue(queueNames.notify, {
      durable: true,
      arguments: {
        'x-dead-letter-exchange': '',
        'x-dead-letter-routing-key': queueNames.notifyDlq,
      },
    });
  };

  const scheduleReconnect = (currentGeneration: number): void => {
    if (isReconnecting || isStopping || !isStarted || currentGeneration !== generation) return;
    isReconnecting = true;
    let attempt = 1;

    const scheduleAttempt = (waitMs: number): void => {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void runAttempt();
      }, waitMs);
    };

    const runAttempt = async (): Promise<void> => {
      if (isStopping || !isStarted || currentGeneration !== generation) {
        isReconnecting = false;
        return;
      }
      logger.info(`Queue reconnect attempt ${attempt}`);
      try {
        await connectAndInitialize(currentGeneration);
        if (!isConnected) throw new Error('Queue reconnect completed without an active connection');
        isReconnecting = false;
        logger.info('Queue reconnected successfully');
      } catch (error: unknown) {
        if (isStopping || !isStarted || currentGeneration !== generation) {
          isReconnecting = false;
          return;
        }
        logger.warn(`Queue reconnect attempt ${attempt} failed: ${safeErrorMessage(error, url)}`);
        captureFailure(error, { action: 'reconnect', attempt });
        const waitMs = retryDelay(connectBaseDelayMs, attempt + 1);
        attempt += 1;
        scheduleAttempt(waitMs);
      }
    };

    scheduleAttempt(retryDelay(connectBaseDelayMs, 1));
  };

  const handleUnexpectedDisconnect = (
    sourceConnection: ChannelModel,
    source: 'connection' | 'channel',
    currentGeneration: number,
    error?: Error,
  ): void => {
    if (sourceConnection !== connection || currentGeneration !== generation) return;
    const previousChannel = confirmChannel;
    connection = null;
    confirmChannel = null;
    isConnected = false;
    clearRegistrationsForChannel(previousChannel);
    rejectPendingPublishes('Queue connection lost while publishing');
    if (isStopping || !isStarted || isStarting) return;

    const failure = error ?? new Error(`Queue ${source} closed unexpectedly`);
    logger.warn(`Queue ${source} closed unexpectedly; scheduling reconnect`);
    captureFailure(failure, { action: 'disconnect', source });
    if (source === 'channel') void sourceConnection.close().catch(() => undefined);
    scheduleReconnect(currentGeneration);
  };

  const connectAndInitialize = async (currentGeneration: number): Promise<void> => {
    let candidate: ChannelModel | null = null;
    let candidateChannel: ConfirmChannel | null = null;
    try {
      candidate = await amqplib.connect(url);
      if (isStopping || currentGeneration !== generation) {
        await candidate.close().catch(() => undefined);
        throw new Error('Queue connection attempt cancelled');
      }
      connection = candidate;
      isConnected = false;
      candidate.on('error', (error: Error) => handleUnexpectedDisconnect(candidate!, 'connection', currentGeneration, error));
      candidate.on('close', () => handleUnexpectedDisconnect(candidate!, 'connection', currentGeneration));

      candidateChannel = await candidate.createConfirmChannel();
      if (connection !== candidate || isStopping || currentGeneration !== generation) {
        await candidateChannel.close().catch(() => undefined);
        throw new Error('Queue connection closed during channel creation');
      }
      confirmChannel = candidateChannel;
      candidateChannel.on('error', (error: Error) => handleUnexpectedDisconnect(candidate!, 'channel', currentGeneration, error));
      candidateChannel.on('close', () => handleUnexpectedDisconnect(candidate!, 'channel', currentGeneration));

      await assertQueues(candidateChannel);
      for (const registration of registrations) await registerConsumer(candidateChannel, registration);
      if (connection !== candidate || confirmChannel !== candidateChannel || isStopping || currentGeneration !== generation) {
        throw new Error('Queue connection closed during initialization');
      }
      isConnected = true;
    } catch (error: unknown) {
      if (candidateChannel) {
        clearRegistrationsForChannel(candidateChannel);
        if (confirmChannel === candidateChannel) confirmChannel = null;
        await candidateChannel.close().catch(() => undefined);
      }
      if (candidate) {
        if (connection === candidate) connection = null;
        await candidate.close().catch(() => undefined);
      }
      if (!connection) isConnected = false;
      throw error;
    }
  };

  const publish = (
    channel: ConfirmChannel,
    queue: string,
    content: Buffer,
    options: object,
  ): Promise<void> => new Promise((resolve, reject) => {
    let settled = false;
    const settle = (error?: Error | null): void => {
      if (settled) return;
      settled = true;
      pendingPublishRejectors.delete(rejectIfPending);
      if (error) reject(error);
      else resolve();
    };
    const rejectIfPending = (error: Error): void => settle(error);
    pendingPublishRejectors.add(rejectIfPending);
    try {
      if (!isConnected || channel !== confirmChannel) {
        settle(new Error('Queue is not connected'));
        return;
      }
      channel.sendToQueue(queue, content, options, (error) => settle(error));
    } catch (error: unknown) {
      settle(asError(error));
    }
  });

  return {
    async start(): Promise<void> {
      if (isConnected) return;
      if (isStarting) throw new Error('Queue start is already in progress');
      isStopping = false;
      isStarted = true;
      isStarting = true;
      const currentGeneration = ++generation;
      try {
        for (let attempt = 1; attempt <= connectRetries; attempt += 1) {
          logger.info(`Queue connection attempt ${attempt} of ${connectRetries}`);
          try {
            await connectAndInitialize(currentGeneration);
            return;
          } catch (error: unknown) {
            logger.warn(`Queue connection attempt ${attempt} failed: ${safeErrorMessage(error, url)}`);
            captureFailure(error, { action: 'connect', attempt });
            if (attempt === connectRetries) {
              throw new Error(`Queue failed to connect after ${connectRetries} attempts`, { cause: error });
            }
            await delay(retryDelay(connectBaseDelayMs, attempt));
          }
        }
      } catch (error: unknown) {
        isStarted = false;
        throw error;
      } finally {
        isStarting = false;
      }
    },

    async publishSendEmail(message: SendEmailMessage, options?: { delayMs?: number }): Promise<void> {
      const channel = getConfirmChannel();
      const content = Buffer.from(JSON.stringify(message));
      if (options?.delayMs && options.delayMs > 0) {
        return publish(channel, queueNames.sendEmailRetry, content, {
          persistent: true,
          expiration: options.delayMs,
          headers: { 'x-attempt': message.attempt ?? 1 },
        });
      }
      const headers: Record<string, unknown> = {};
      if (message.attempt !== undefined) headers['x-attempt'] = message.attempt;
      return publish(channel, queueNames.sendEmail, content, {
        persistent: true,
        ...(Object.keys(headers).length > 0 ? { headers } : {}),
      });
    },

    async publishNotify(message: NotifyMessage): Promise<void> {
      const channel = getConfirmChannel();
      return publish(channel, queueNames.notify, Buffer.from(JSON.stringify(message)), { persistent: true });
    },

    async consumeSendEmail(handler: (message: SendEmailMessage) => Promise<void>): Promise<void> {
      const channel = getConfirmChannel();
      const registration: ConsumerRegistration = {
        queue: queueNames.sendEmail,
        handler,
        channel: null,
        consumerTag: null,
      };
      registrations.push(registration);
      await registerConsumer(channel, registration);
    },

    async consumeNotify(handler: (message: NotifyMessage) => Promise<void>): Promise<void> {
      const channel = getConfirmChannel();
      const registration: ConsumerRegistration = {
        queue: queueNames.notify,
        handler,
        channel: null,
        consumerTag: null,
      };
      registrations.push(registration);
      await registerConsumer(channel, registration);
    },

    async stop(): Promise<void> {
      if (isStopping) return;
      isStopping = true;
      isStarted = false;
      isConnected = false;
      generation += 1;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      isReconnecting = false;
      rejectPendingPublishes('Queue stopped while publishing');

      const channel = confirmChannel;
      const activeConnection = connection;
      if (channel) {
        for (const registration of registrations) {
          if (registration.channel !== channel || !registration.consumerTag) continue;
          try {
            await channel.cancel(registration.consumerTag);
          } catch {
            // Ignore consumers already cancelled by a broker disconnect.
          }
        }
      }
      registrations.length = 0;

      if (inFlightHandlers.size > 0) {
        await Promise.race([
          Promise.allSettled([...inFlightHandlers]),
          delay(5000),
        ]);
      }

      if (channel) {
        try {
          await channel.close();
        } catch {
          // Ignore an already closed channel.
        }
      }
      confirmChannel = null;

      if (activeConnection) {
        try {
          await activeConnection.close();
        } catch {
          // Ignore an already closed connection.
        }
      }
      connection = null;
    },
  };
}
