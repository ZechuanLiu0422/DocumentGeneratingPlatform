import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

type Phase02Scenario = {
  draft: {
    generatePath: string;
    previewTitle: string;
    sectionHeading: string;
    bodyExcerpt: string;
    versionSummary: string;
  };
};

const SCENARIO_PATH = path.join(process.cwd(), '.tmp', 'phase-02-e2e.json');

function readScenario(): Phase02Scenario {
  if (!fs.existsSync(SCENARIO_PATH)) {
    throw new Error(`Missing ${SCENARIO_PATH}. Run "npm run test:phase-02:e2e:seed" first.`);
  }

  return JSON.parse(fs.readFileSync(SCENARIO_PATH, 'utf8')) as Phase02Scenario;
}

test('SAFE-03 seeded generate workspace reaches review/export readiness', async ({ page }) => {
  const scenario = readScenario();

  await page.goto(scenario.draft.generatePath, { waitUntil: 'networkidle' });

  await expect(page.getByRole('heading', { name: 'AI 协作式公文工作台' })).toBeVisible();
  await expect(page.getByRole('button', { name: '5. 定稿检查' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '定稿检查' })).toBeVisible();
  await expect(page.getByRole('button', { name: '下载 Word 定稿' })).toBeEnabled();
  await expect(page.getByRole('heading', { name: '版本历史' })).toBeVisible();
  await expect(page.getByText(scenario.draft.versionSummary, { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '实时预览' })).toBeVisible();
  await expect(page.getByText(scenario.draft.previewTitle, { exact: true })).toBeVisible();
  await expect(page.getByText(scenario.draft.sectionHeading, { exact: true })).toBeVisible();
  await expect(page.getByText(scenario.draft.bodyExcerpt, { exact: true })).toBeVisible();
});
