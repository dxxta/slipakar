export type ErrorLogLevel = 'error' | 'warn';

export type ErrorLogEntry = {
  time: string; // ISO string
  level: ErrorLogLevel;
  message: string;
  name?: string;
  stack?: string;
  context?: Record<string, unknown>;
  fingerprint: string;
  count?: number;
};

export type ErrorReporter = {
  capture(error: unknown, context?: Record<string, unknown>): void;
};

export type ErrorLogSink = {
  record(entry: ErrorLogEntry): void;
  flush(): Promise<void>;
  start(): void;
  stop(): Promise<void>;
};

export type SentryClient = {
  capture(entry: ErrorLogEntry): Promise<void>;
};
