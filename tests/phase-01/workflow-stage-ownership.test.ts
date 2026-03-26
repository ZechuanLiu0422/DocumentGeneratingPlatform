import test from 'node:test';
import assert from 'node:assert/strict';
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

test('supported workflow actions resolve to authoritative target stages', () => {
  for (const [action, stage] of Object.entries(expectedStageByAction)) {
    assert.equal(getAuthoritativeWorkflowStage(action), stage);
  }
});

test('unsupported workflow actions are rejected', () => {
  assert.throws(() => getAuthoritativeWorkflowStage('review_done'), /Unsupported workflow action/);
  assert.throws(() => assertAuthoritativeWorkflowAction('draft'), /Unsupported workflow action/);
});
