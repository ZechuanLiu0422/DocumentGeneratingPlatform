import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertAuthoritativeWorkflowAction,
  getAuthoritativeWorkflowStage,
  type AuthoritativeWorkflowAction,
} from '../../lib/workflow-stage.ts';

const expectedStageByAction: Record<AuthoritativeWorkflowAction, string> = {
  intake_in_progress: 'intake',
  intake_ready: 'planning',
  planning_generated: 'planning',
  outline_generated: 'outline',
  outline_confirmed: 'draft',
  draft_generated: 'review',
  review_applied: 'review',
  revision_applied: 'review',
  export_completed: 'done',
};

const routeExpectations = [
  {
    file: '../../app/api/ai/intake/route.ts',
    requiredSnippets: ['getAuthoritativeWorkflowStage', 'getIntakeWorkflowAction', "workflow_stage: workflowStage"],
    forbiddenSnippets: ["workflow_stage: 'planning'", "workflow_stage: 'intake'"],
  },
  {
    file: '../../app/api/ai/outline-plan/route.ts',
    requiredSnippets: ['getAuthoritativeWorkflowStage', "planning_generated", "workflow_stage: workflowStage"],
    forbiddenSnippets: ["workflow_stage: 'planning'"],
  },
  {
    file: '../../app/api/ai/outline/route.ts',
    requiredSnippets: ['getAuthoritativeWorkflowStage', "outline_generated", "workflow_stage: workflowStage"],
    forbiddenSnippets: ["workflow_stage: 'outline'"],
  },
  {
    file: '../../app/api/ai/outline/confirm/route.ts',
    requiredSnippets: ['getAuthoritativeWorkflowStage', "outline_confirmed", "workflow_stage: workflowStage"],
    forbiddenSnippets: ["workflow_stage: 'draft'"],
  },
  {
    file: '../../app/api/ai/draft/route.ts',
    requiredSnippets: ['getAuthoritativeWorkflowStage', "draft_generated", "workflow_stage: workflowStage"],
    forbiddenSnippets: ["workflow_stage: 'review'"],
  },
  {
    file: '../../app/api/ai/review/route.ts',
    requiredSnippets: ['getAuthoritativeWorkflowStage', "review_applied", "workflow_stage: workflowStage"],
    forbiddenSnippets: ["workflow_stage: 'review'"],
  },
  {
    file: '../../app/api/ai/revise/route.ts',
    requiredSnippets: ['getAuthoritativeWorkflowStage', "revision_applied", "workflow_stage: workflowStage"],
    forbiddenSnippets: ["workflow_stage: 'review'"],
  },
  {
    file: '../../app/api/generate/route.ts',
    requiredSnippets: ['getAuthoritativeWorkflowStage', "export_completed", "workflow_stage: workflowStage"],
    forbiddenSnippets: ["workflow_stage: 'done'"],
  },
] as const;

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);

test('supported workflow actions resolve to authoritative target stages', () => {
  for (const [action, stage] of Object.entries(expectedStageByAction)) {
    assert.equal(getAuthoritativeWorkflowStage(action), stage);
  }
});

test('unsupported workflow actions are rejected', () => {
  assert.throws(() => getAuthoritativeWorkflowStage('review_done'), /Unsupported workflow action/);
  assert.throws(() => assertAuthoritativeWorkflowAction('draft'), /Unsupported workflow action/);
});

test('stage-writing routes adopt the authoritative workflow-stage helper', () => {
  for (const expectation of routeExpectations) {
    const source = readFileSync(path.resolve(currentDir, expectation.file), 'utf8');

    for (const snippet of expectation.requiredSnippets) {
      assert.match(source, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }

    for (const snippet of expectation.forbiddenSnippets) {
      assert.doesNotMatch(source, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  }
});
