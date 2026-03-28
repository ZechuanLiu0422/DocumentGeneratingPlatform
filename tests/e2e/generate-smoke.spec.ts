import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';

type Phase02Scenario = {
  draft: {
    generatePath: string;
    previewTitle: string;
    sectionHeading: string;
    bodyExcerpt: string;
    currentSecondBody: string;
    restoredSecondBody: string;
    versionSummary: string;
    candidateSummary: string;
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
  await page.getByRole('button', { name: '5. 定稿检查' }).click();
  await expect(page.getByRole('heading', { name: '定稿检查' })).toBeVisible();
  await expect(page.getByRole('button', { name: '下载 Word 定稿' })).toBeEnabled();
  await expect(page.getByRole('heading', { name: '版本历史' })).toBeVisible();
  await expect(page.getByText(scenario.draft.versionSummary, { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: '实时预览' })).toBeVisible();
  await expect(page.getByText(scenario.draft.previewTitle, { exact: true })).toBeVisible();
  await expect(page.getByText(scenario.draft.sectionHeading, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(scenario.draft.bodyExcerpt, { exact: true }).first()).toBeVisible();
});

test('TRUST-04 seeded restore candidate can be rejected from the compare panel', async ({ page }) => {
  const scenario = readScenario();

  await page.goto(scenario.draft.generatePath, { waitUntil: 'networkidle' });

  const pendingChangePanel = page.getByTestId('pending-change-panel');

  await expect(pendingChangePanel.getByText('待确认候选变更', { exact: true })).toBeVisible();
  await expect(pendingChangePanel.getByText(scenario.draft.candidateSummary, { exact: true })).toBeVisible();
  await expect(pendingChangePanel.getByText(scenario.draft.currentSecondBody, { exact: true })).toBeVisible();
  await expect(pendingChangePanel.getByText(scenario.draft.restoredSecondBody, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '拒绝候选变更' }).click();

  await expect(page.getByTestId('pending-change-panel')).toHaveCount(0);
  await expect(page.getByText(scenario.draft.sectionHeading, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(scenario.draft.currentSecondBody, { exact: true }).first()).toBeVisible();
});

test('TRUST-04 seeded restore candidate can be recreated and accepted', async ({ page }) => {
  const scenario = readScenario();

  await page.goto(scenario.draft.generatePath, { waitUntil: 'networkidle' });
  await page
    .getByText(scenario.draft.versionSummary, { exact: true })
    .locator('..')
    .getByRole('button', { name: '恢复到此版本' })
    .click();

  const pendingChangePanel = page.getByTestId('pending-change-panel');

  await expect(pendingChangePanel.getByText('待确认候选变更', { exact: true })).toBeVisible();
  await expect(pendingChangePanel.getByText(scenario.draft.restoredSecondBody, { exact: true })).toBeVisible();

  await page.getByRole('button', { name: '接受候选变更' }).click();

  await expect(page.getByTestId('pending-change-panel')).toHaveCount(0);
  await expect(page.getByText(scenario.draft.restoredSecondBody, { exact: true }).first()).toBeVisible();
});

test('OPS-01 seeded export uses operation polling and binary download delivery', async ({ page }) => {
  const scenario = readScenario();

  await page.goto(scenario.draft.generatePath, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: '5. 定稿检查' }).click();
  await expect(page.getByRole('heading', { name: '定稿检查' })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: '下载 Word 定稿' }).click();

  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.docx$/i);
});
