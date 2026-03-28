import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const pagePath = path.resolve(currentDir, '../../../app/generate/page.tsx');
const stageNavigationPath = path.resolve(currentDir, '../../../app/generate/_components/StageNavigation.tsx');
const intakeStagePath = path.resolve(currentDir, '../../../app/generate/_components/stages/IntakeStage.tsx');
const planningStagePath = path.resolve(currentDir, '../../../app/generate/_components/stages/PlanningStage.tsx');
const outlineStagePath = path.resolve(currentDir, '../../../app/generate/_components/stages/OutlineStage.tsx');

function read(pathname: string) {
  return readFileSync(pathname, 'utf8');
}

test('generate workspace page imports extracted stage modules', () => {
  const pageSource = read(pagePath);

  assert.match(pageSource, /StageNavigation/);
  assert.match(pageSource, /IntakeStage/);
  assert.match(pageSource, /PlanningStage/);
  assert.match(pageSource, /OutlineStage/);
  assert.doesNotMatch(pageSource, /function StageTabs\(/);
});

test('stage navigation exists as a dedicated module with all workflow step ids', () => {
  assert.equal(existsSync(stageNavigationPath), true);
  const source = read(stageNavigationPath);

  assert.match(source, /intake/);
  assert.match(source, /planning/);
  assert.match(source, /outline/);
  assert.match(source, /draft/);
  assert.match(source, /review/);
});

test('intake, planning, and outline stage modules stay prop-driven', () => {
  for (const pathname of [intakeStagePath, planningStagePath, outlineStagePath]) {
    assert.equal(existsSync(pathname), true, `${pathname} should exist`);
    assert.doesNotMatch(read(pathname), /fetch\('\/api\//);
  }
});
