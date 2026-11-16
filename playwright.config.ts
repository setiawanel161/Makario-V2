import { randomBytes } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/workspace_db?schema=public';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run start -- --hostname localhost --port 3000',
    url: 'http://localhost:3000/api/health',
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: databaseUrl,
      AUTH_SECRET: process.env.AUTH_SECRET ?? randomBytes(32).toString('base64url'),
      AUTH_DEMO_ENABLED: 'true',
      AUTH_TRUST_HOST: 'true',
      AUTH_URL: 'http://localhost:3000',
      PLAYWRIGHT_E2E: 'true',
      HOSTNAME: 'localhost',
      PORT: '3000',
    },
  },
});
