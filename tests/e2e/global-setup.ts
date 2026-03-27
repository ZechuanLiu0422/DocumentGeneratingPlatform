import fs from 'node:fs';
import path from 'node:path';
import { chromium, type FullConfig } from '@playwright/test';

type Phase02Scenario = {
  baseURL: string;
  user: {
    email: string;
    password: string;
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

async function globalSetup(config: FullConfig) {
  const scenario = readScenario();
  const baseURL = config.projects[0]?.use?.baseURL;
  const browser = await chromium.launch();
  const context = await browser.newContext({
    baseURL: typeof baseURL === 'string' ? baseURL : scenario.baseURL,
  });
  const page = await context.newPage();

  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.getByPlaceholder('you@example.com').fill(scenario.user.email);
  await page.getByPlaceholder('请输入密码').fill(scenario.user.password);

  await page.getByRole('button', { name: '登录' }).click();
  await Promise.any([
    page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 30_000 }),
    page.getByRole('button', { name: '退出登录' }).waitFor({ timeout: 30_000 }),
  ]);
  await page.getByRole('button', { name: '退出登录' }).waitFor({ timeout: 30_000 });
  await context.storageState({ path: STORAGE_STATE_PATH });
  await browser.close();
}

export default globalSetup;
