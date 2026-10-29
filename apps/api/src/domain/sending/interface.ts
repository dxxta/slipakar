import type { SendEmailMessage } from '../queue/interface.js';

export interface SendWorkerInterface {
  handleSendEmail(message: SendEmailMessage): Promise<void>;
}
