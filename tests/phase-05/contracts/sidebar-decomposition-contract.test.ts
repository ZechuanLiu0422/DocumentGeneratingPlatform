import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const pagePath = path.resolve(currentDir, '../../../app/generate/page.tsx');
const draftStagePath = path.resolve(currentDir, '../../../app/generate/_components/stages/DraftStage.tsx');
const reviewStagePath = path.resolve(currentDir, '../../../app/generate/_components/stages/ReviewStage.tsx');
const pendingChangeBannerPath = path.resolve(currentDir, '../../../app/generate/_components/PendingChangeBanner.tsx');
const operationStatusBannerPath = path.resolve(currentDir, '../../../app/generate/_components/OperationStatusBanner.tsx');
const knowledgeSidebarPath = path.resolve(currentDir, '../../../app/generate/_components/panels/KnowledgeSidebar.tsx');
const versionHistoryPanelPath = path.resolve(currentDir, '../../../app/generate/_components/panels/VersionHistoryPanel.tsx');

function read(pathname: string) {
  return readFileSync(pathname, 'utf8');
}

test('generate workspace page imports extracted draft, review, banner, and sidebar modules', () => {
  const pageSource = read(pagePath);

  assert.match(pageSource, /DraftStage/);
  assert.match(pageSource, /ReviewStage/);
  assert.match(pageSource, /PendingChangeBanner/);
  assert.match(pageSource, /OperationStatusBanner/);
  assert.match(pageSource, /KnowledgeSidebar/);
  assert.match(pageSource, /VersionHistoryPanel/);
});

test('page no longer keeps inline draft, review, and sidebar section branches', () => {
  const pageSource = read(pagePath);

  assert.doesNotMatch(pageSource, /currentStep === 'draft'/);
  assert.doesNotMatch(pageSource, /currentStep === 'review'/);
  assert.doesNotMatch(pageSource, /<h3 className="font-medium">个人规则库<\/h3>/);
  assert.doesNotMatch(pageSource, /<h3 className="font-medium">参考材料<\/h3>/);
  assert.doesNotMatch(pageSource, /<h2 className="text-lg font-bold">版本历史<\/h2>/);
});

test('extracted draft and review stages stay prop-driven', () => {
  for (const pathname of [draftStagePath, reviewStagePath]) {
    assert.equal(existsSync(pathname), true, `${pathname} should exist`);
    assert.doesNotMatch(read(pathname), /fetch\('\/api\//);
  }
});

test('pending change and operation status components expose action/status props', () => {
  assert.equal(existsSync(pendingChangeBannerPath), true);
  assert.equal(existsSync(operationStatusBannerPath), true);

  assert.match(read(pendingChangeBannerPath), /onAccept/);
  assert.match(read(pendingChangeBannerPath), /onReject/);
  assert.match(read(operationStatusBannerPath), /(operationStatus|status)/);
});

test('knowledge and version panels stay prop-driven', () => {
  for (const pathname of [knowledgeSidebarPath, versionHistoryPanelPath]) {
    assert.equal(existsSync(pathname), true, `${pathname} should exist`);
    assert.doesNotMatch(read(pathname), /fetch\('\/api\//);
  }
});
