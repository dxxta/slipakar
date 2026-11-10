import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  testMatch: '**/*.pw.ts',
  timeout: 180_000,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4300',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      testIgnore: '**/admin/**',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'admin-web',
      testDir: 'tests/e2e/admin',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:4301/console/' },
    },
  ],
  webServer: [
    {
      command: 'npm run start -w @lokaslip/user-web -- --port 4300',
      url: 'http://localhost:4300',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
    {
      command: 'npm run start -w @lokaslip/admin-web -- --port 4301 --configuration e2e --serve-path /console/',
      url: 'http://localhost:4301/console/',
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
    },
  ],
});
