import type { FeatureFlagsInterface } from '../../../domain/system-config/interface.js';

export function createApiAccessCheck({ environmentEnabled, flags }: { environmentEnabled: boolean; flags: FeatureFlagsInterface }): () => Promise<boolean> {
  return async (): Promise<boolean> => environmentEnabled && await flags.isEnabled('api_access_enabled');
}
