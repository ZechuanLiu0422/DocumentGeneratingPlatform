import type { TestContext } from 'node:test';
import {
  createJsonRequest,
  importProjectModule,
  resolveProjectPath,
  withRouteModuleMocks,
} from '../../phase-02/contracts/route-contract-helpers.ts';

export function createTrustJsonRequest(route: string, body: unknown, init: RequestInit = {}) {
  return createJsonRequest(route, body, init);
}

export function withTrustRouteModuleMocks(
  t: TestContext,
  relativeRoutePath: string,
  overrides: Record<string, Record<string, unknown>> = {}
) {
  return withRouteModuleMocks(t, relativeRoutePath, overrides);
}

export function importTrustProjectModule(
  t: TestContext,
  relativeModulePath: string,
  overrides: Record<string, Record<string, unknown>> = {}
) {
  return importProjectModule(t, relativeModulePath, overrides);
}

export function resolveTrustProjectPath(...segments: string[]) {
  return resolveProjectPath(...segments);
}
