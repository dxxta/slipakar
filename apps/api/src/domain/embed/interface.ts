import type { EmbedScope, EmbedTheme } from './dto.js';
import type { ResponseTypeWithoutMetadata } from '../../lib/types.js';

export type EmbedSessionView = {
  projectId: string;
  scopes: EmbedScope[];
  theme: EmbedTheme | null;
  expiresAt: string;
  parentOrigin: string;
};

export type MintedEmbedTokenView = {
  token: string;
  url: string;
  expiresAt: string;
};

export type EmbedUseCaseInterface = {
  mint(input: { projectId: string; keyId: string; keyScopes: string[]; payload: unknown }): Promise<ResponseTypeWithoutMetadata<MintedEmbedTokenView>>;
  exchange(input: { payload: unknown; ip: string }): Promise<ResponseTypeWithoutMetadata<{ token: string } & EmbedSessionView>>;
};
