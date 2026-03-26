import { type z } from 'zod';
import { workflowStageSchema } from './validation.ts';

const AUTHORITATIVE_WORKFLOW_STAGE_BY_ACTION = {
  intake_in_progress: 'intake',
  intake_ready: 'planning',
  planning_generated: 'planning',
  outline_generated: 'outline',
  outline_confirmed: 'draft',
  draft_generated: 'review',
  review_applied: 'review',
  revision_applied: 'review',
  export_completed: 'done',
} as const satisfies Record<string, z.infer<typeof workflowStageSchema>>;

export type AuthoritativeWorkflowAction = keyof typeof AUTHORITATIVE_WORKFLOW_STAGE_BY_ACTION;
export type AuthoritativeWorkflowStage = (typeof AUTHORITATIVE_WORKFLOW_STAGE_BY_ACTION)[AuthoritativeWorkflowAction];

export function assertAuthoritativeWorkflowAction(action: string): asserts action is AuthoritativeWorkflowAction {
  if (!(action in AUTHORITATIVE_WORKFLOW_STAGE_BY_ACTION)) {
    throw new Error(`Unsupported workflow action: ${action}`);
  }
}

export function getAuthoritativeWorkflowStage(action: string): AuthoritativeWorkflowStage {
  assertAuthoritativeWorkflowAction(action);
  return AUTHORITATIVE_WORKFLOW_STAGE_BY_ACTION[action];
}

export function getIntakeWorkflowAction(readiness: 'needs_more' | 'ready'): AuthoritativeWorkflowAction {
  return readiness === 'ready' ? 'intake_ready' : 'intake_in_progress';
}

export function getAuthoritativeWorkflowStageMap() {
  return { ...AUTHORITATIVE_WORKFLOW_STAGE_BY_ACTION };
}
