import fs from 'node:fs';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

type Phase02Scenario = {
  baseURL: string;
  supabase: {
    url: string;
    anonKey: string;
  };
};

const STORAGE_STATE_PATH = path.join(process.cwd(), '.tmp', 'phase-02-storage-state.json');
const SCENARIO_PATH = path.join(process.cwd(), '.tmp', 'phase-02-e2e.json');

function readScenario(): Phase02Scenario {
  if (!fs.existsSync(SCENARIO_PATH)) {
    throw new Error(`Missing ${SCENARIO_PATH}. Run "npm run test:phase-02:e2e:seed" first.`);
  }

  return JSON.parse(fs.readFileSync(SCENARIO_PATH, 'utf8')) as Phase02Scenario;
}

const scenario = readScenario();
const testBaseURL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:32123';
const testBasePort = new URL(testBaseURL).port || '32123';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /generate-smoke\.spec\.ts/,
  outputDir: path.join(process.cwd(), '.tmp', 'playwright-results'),
  fullyParallel: false,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  reporter: 'list',
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: testBaseURL,
    storageState: STORAGE_STATE_PATH,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  globalSetup: './tests/e2e/global-setup.ts',
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  webServer: {
    command: `npm run start -- --hostname 127.0.0.1 --port ${testBasePort}`,
    url: testBaseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: scenario.supabase.url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: scenario.supabase.anonKey,
    },
  },
});
