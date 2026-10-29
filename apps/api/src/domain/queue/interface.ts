export const queueNames = {
  sendEmail: 'send.email',
  sendEmailRetry: 'send.email.retry',
  sendEmailDlq: 'send.email.dlq',
  notify: 'notify',
  notifyDlq: 'notify.dlq',
} as const;

export type QueueName = (typeof queueNames)[keyof typeof queueNames];

export type SendEmailMessage = {
  campaignId: string;
  recipientId: string;
  attempt?: number;
};

export type NotifyMessage = {
  type: 'campaign_finished' | 'send_failed';
  projectId: string;
  campaignId: string;
  message: string;
};

export type QueuePublisher = {
  publishSendEmail(message: SendEmailMessage, options?: { delayMs?: number }): Promise<void>;
  publishNotify(message: NotifyMessage): Promise<void>;
};

export type QueueConsumer = {
  consumeSendEmail(handler: (message: SendEmailMessage) => Promise<void>): Promise<void>;
  consumeNotify(handler: (message: NotifyMessage) => Promise<void>): Promise<void>;
  stop(): Promise<void>;
};

export type QueueInterface = QueuePublisher & QueueConsumer & {
  start(): Promise<void>;
};
