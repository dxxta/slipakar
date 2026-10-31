export type MetricsInterface = {
  recordHttpRequest(input: {
    method: string;
    route: string;
    status: number;
    durationSeconds: number;
  }): void;
  recordEmailResult(result: 'sent' | 'failed'): void;
  recordQueueMessage(input: {
    queue: string;
    outcome: 'processed' | 'rejected';
  }): void;
  recordRateLimitWait(seconds: number): void;
  recordCampaignFinished(): void;
  render(): Promise<string>;
  contentType: string;
};
