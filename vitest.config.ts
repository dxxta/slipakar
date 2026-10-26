import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', 'apps/admin-web/**', 'apps/user-web/**'],
    // Integration specs start Postgres, Redis and MinIO containers; starting many
    // at once made suite setup fail intermittently, so run test files one at a time.
    maxWorkers: 1,
    hookTimeout: 180_000,
    testTimeout: 60_000,
  },
});
