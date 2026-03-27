import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '../../..');

test('Phase 4 harness exposes scripts, fixtures, and helper wrappers', async () => {
  const packageJson = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));

  assert.equal(
    typeof packageJson.scripts['test:phase-04:contracts'],
    'string',
    'package.json should expose a Phase 4 contract suite command'
  );
  assert.equal(
    typeof packageJson.scripts['test:phase-04:contracts:harness'],
    'string',
    'package.json should expose a Phase 4 harness smoke command'
  );
  assert.equal(
    typeof packageJson.scripts['test:phase-04:contracts:foundation'],
    'string',
    'package.json should expose a Phase 4 foundation contract command'
  );

  const fixturePath = path.join(__dirname, 'shared-fixtures.ts');
  assert.equal(existsSync(fixturePath), true, 'Phase 4 shared fixtures should exist');

  if (existsSync(fixturePath)) {
    const fixtures = (await import(`${pathToFileURL(fixturePath).href}?phase04=${Date.now()}`)) as Record<string, unknown>;
    assert.equal(typeof fixtures.buildQueuedOperationFixture, 'function');
    assert.equal(typeof fixtures.buildRunningOperationFixture, 'function');
    assert.equal(typeof fixtures.buildSucceededOperationFixture, 'function');
    assert.equal(typeof fixtures.buildFailedOperationFixture, 'function');
    assert.equal(typeof fixtures.buildExportOperationPayload, 'function');
  }

  const helperPath = path.join(__dirname, 'route-contract-helpers.ts');
  assert.equal(existsSync(helperPath), true, 'Phase 4 helper wrapper should exist');

  if (existsSync(helperPath)) {
    const helpers = (await import(`${pathToFileURL(helperPath).href}?phase04=${Date.now()}`)) as Record<string, unknown>;
    assert.equal(typeof helpers.createOperationJsonRequest, 'function');
    assert.equal(typeof helpers.withOperationRouteModuleMocks, 'function');
    assert.equal(typeof helpers.importOperationProjectModule, 'function');
    assert.equal(typeof helpers.resolveOperationProjectPath, 'function');
  }
});
