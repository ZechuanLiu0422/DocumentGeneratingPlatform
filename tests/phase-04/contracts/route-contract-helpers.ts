import type { TestContext } from 'node:test';
import {
  createJsonRequest,
  importProjectModule,
  resolveProjectPath,
  withRouteModuleMocks,
} from '../../phase-02/contracts/route-contract-helpers.ts';

export function createOperationJsonRequest(route: string, body: unknown, init: RequestInit = {}) {
  return createJsonRequest(route, body, init);
}

export function withOperationRouteModuleMocks(
  t: TestContext,
  relativeRoutePath: string,
  overrides: Record<string, Record<string, unknown>> = {}
) {
  return withRouteModuleMocks(t, relativeRoutePath, overrides);
}

export function importOperationProjectModule(
  t: TestContext,
  relativeModulePath: string,
  overrides: Record<string, Record<string, unknown>> = {}
) {
  return importProjectModule(t, relativeModulePath, overrides);
}

export function resolveOperationProjectPath(...segments: string[]) {
  return resolveProjectPath(...segments);
}
