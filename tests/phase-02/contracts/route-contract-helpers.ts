import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import type { TestContext } from 'node:test';
import { NextRequest } from 'next/server.js';

type ModuleExports = Record<string, unknown>;

const helperDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(helperDir, '../../..');
const routeMockRegistry = Symbol.for('phase-02.route-mocks');

const nextServerUrl = pathToFileURL(path.join(projectRoot, 'node_modules/next/server.js')).href;
const validationUrl = pathToFileURL(path.join(projectRoot, 'lib/validation.ts')).href;

function getRouteMockStore() {
  const globalStore = globalThis as typeof globalThis & {
    [routeMockRegistry]?: Record<string, ModuleExports>;
  };

  if (!globalStore[routeMockRegistry]) {
    globalStore[routeMockRegistry] = {};
  }

  return globalStore[routeMockRegistry] as Record<string, ModuleExports>;
}

function createMockModuleUrl(key: string, namedExports: ModuleExports) {
  const store = getRouteMockStore();
  store[key] = namedExports;

  const exportLines = Object.keys(namedExports)
    .map((name) => `export const ${name} = globalThis[Symbol.for('phase-02.route-mocks')][${JSON.stringify(key)}][${JSON.stringify(name)}];`)
    .join('\n');

  return `data:text/javascript;base64,${Buffer.from(exportLines).toString('base64')}`;
}

function rewriteImportSpecifiers(
  source: string,
  overrides: Record<string, ModuleExports>,
  tempDir: string,
  tempModuleCache: Map<string, string>
) {
  return source.replace(/from\s+['"]([^'"]+)['"]/g, (_match, specifier: string) => {
    if (overrides[specifier]) {
      return `from '${createMockModuleUrl(specifier, overrides[specifier])}'`;
    }

    if (specifier === 'next/server') {
      return `from '${nextServerUrl}'`;
    }

    if (specifier === '@/lib/validation') {
      return `from '${validationUrl}'`;
    }

    if (specifier === '@/lib/api') {
      if (!tempModuleCache.has(specifier)) {
        const apiSource = readFileSync(path.join(projectRoot, 'lib/api.ts'), 'utf8').replaceAll(
          "from 'next/server'",
          `from '${nextServerUrl}'`
        );
        const tempFile = path.join(tempDir, 'lib-api.ts');
        writeFileSync(tempFile, apiSource, 'utf8');
        tempModuleCache.set(specifier, pathToFileURL(tempFile).href);
      }

      return `from '${tempModuleCache.get(specifier)}'`;
    }

    return `from '${specifier}'`;
  });
}

function buildRouteImportUrl(relativeRoutePath: string, overrides: Record<string, ModuleExports>) {
  const routeUrl = new URL(relativeRoutePath, import.meta.url);
  const source = readFileSync(fileURLToPath(routeUrl), 'utf8');
  const tempRoot = path.join(projectRoot, '.tmp');
  mkdirSync(tempRoot, { recursive: true });
  const tempDir = mkdtempSync(path.join(tempRoot, 'phase-02-route-'));
  const tempModuleCache = new Map<string, string>();
  const rewrittenSource = rewriteImportSpecifiers(source, overrides, tempDir, tempModuleCache);
  const tempFile = path.join(tempDir, `${path.basename(fileURLToPath(routeUrl), '.ts')}.ts`);
  writeFileSync(tempFile, rewrittenSource, 'utf8');

  return {
    importUrl: pathToFileURL(tempFile).href,
    cleanup: () => rmSync(tempDir, { recursive: true, force: true }),
  };
}

function toLocalUrl(route: string) {
  return route.startsWith('http') ? route : `http://localhost${route}`;
}

export function createJsonRequest(route: string, body: unknown, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (!headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }

  return new NextRequest(toLocalUrl(route), {
    ...init,
    method: init.method || 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

export async function withRouteModuleMocks(
  t: TestContext,
  relativeRoutePath: string,
  overrides: Record<string, ModuleExports> = {}
) {
  const { importUrl, cleanup } = buildRouteImportUrl(relativeRoutePath, overrides);

  t.after(() => {
    const store = getRouteMockStore();
    for (const key of Object.keys(overrides)) {
      delete store[key];
    }
    cleanup();
  });

  return import(`${importUrl}?phase02=${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

export function resolveProjectPath(...segments: string[]) {
  return path.join(projectRoot, ...segments);
}
