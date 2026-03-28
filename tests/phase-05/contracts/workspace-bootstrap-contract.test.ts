import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const pageSource = readFileSync(path.resolve(currentDir, '../../../app/generate/page.tsx'), 'utf8');

test('generate workspace page delegates bootstrap and shell responsibilities to Phase 5 boundaries', () => {
  assert.match(pageSource, /useGenerateWorkspaceBootstrap/);
  assert.match(pageSource, /GenerateWorkspaceShell/);
});

test('generate workspace page no longer blocks on the legacy six-request bootstrap promise', () => {
  assert.doesNotMatch(
    pageSource,
    /Promise\.all\(\[\s*fetch\('\/api\/settings'\),\s*fetch\('\/api\/common-phrases'\),\s*fetch\('\/api\/contacts'\),\s*fetch\('\/api\/drafts'\),\s*fetch\('\/api\/writing-rules'\),\s*fetch\('\/api\/reference-assets'\),/s
  );
});
