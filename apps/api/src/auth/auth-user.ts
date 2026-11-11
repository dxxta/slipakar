import type { EmbedTheme } from '../domain/embed/dto.js';

export type AuthUser = {
  id: string;
  email: string;
  role: string;
  disabledAt?: Date | null;
  disabledReason?: string | null;
};

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthUser;
    apiKey?: { id: string; projectId: string; scopes: string[]; embed?: boolean; parentOrigin?: string; theme?: EmbedTheme | null };
  }
}
