import type { ResponseTypeWithoutMetadata } from '../../lib/types.js';

export interface DemoProjectUseCaseInterface {
  seedDemoProjectUseCase(args: {
    userId: string;
  }): Promise<ResponseTypeWithoutMetadata<{ projectId: string; created: boolean }>>;
}
