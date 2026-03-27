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
  const cacheKey = `${key}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
  store[cacheKey] = namedExports;

  const exportLines = Object.keys(namedExports)
    .map((name) => `export const ${name} = globalThis[Symbol.for('phase-02.route-mocks')][${JSON.stringify(cacheKey)}][${JSON.stringify(name)}];`)
    .join('\n');

  return `data:text/javascript;base64,${Buffer.from(exportLines).toString('base64')}`;
}

function createMergedMockModuleUrl(key: string, baseImportUrl: string | null, namedExports: ModuleExports) {
  const store = getRouteMockStore();
  const cacheKey = `${key}:${Date.now()}:${Math.random().toString(16).slice(2)}`;
  store[cacheKey] = namedExports;

  const lines = [
    baseImportUrl ? `export * from '${baseImportUrl}';` : '',
    ...Object.keys(namedExports).map(
      (name) =>
        `export const ${name} = globalThis[Symbol.for('phase-02.route-mocks')][${JSON.stringify(cacheKey)}][${JSON.stringify(name)}];`
    ),
  ].filter(Boolean);

  return `data:text/javascript;base64,${Buffer.from(lines.join('\n')).toString('base64')}`;
}

function resolveModulePath(basePath: string) {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.js`,
    path.join(basePath, 'index.ts'),
    path.join(basePath, 'index.js'),
  ];

  for (const candidate of candidates) {
    try {
      return readFileSync(candidate, 'utf8') && candidate;
    } catch {}
  }

  throw new Error(`Unable to resolve module path for ${basePath}`);
}

function createTempModuleFromPath(
  sourcePath: string,
  overrides: Record<string, ModuleExports>,
  tempDir: string,
  tempModuleCache: Map<string, string>
) {
  if (tempModuleCache.has(sourcePath)) {
    return tempModuleCache.get(sourcePath)!;
  }

  const source = readFileSync(sourcePath, 'utf8');
  const tempFile = path.join(
    tempDir,
    `${tempModuleCache.size}-${path.basename(sourcePath).replace(/\.[^.]+$/, '')}.ts`
  );

  tempModuleCache.set(sourcePath, pathToFileURL(tempFile).href);

  const rewrittenSource = rewriteImportSpecifiers(
    source,
    overrides,
    tempDir,
    tempModuleCache,
    sourcePath
  );

  writeFileSync(tempFile, rewrittenSource, 'utf8');
  return tempModuleCache.get(sourcePath)!;
}

function resolveImportUrl(
  specifier: string,
  sourcePath: string,
  overrides: Record<string, ModuleExports>,
  tempDir: string,
  tempModuleCache: Map<string, string>,
  allowOverride: boolean
) {
  if (allowOverride && overrides[specifier]) {
    return createMockModuleUrl(specifier, overrides[specifier]);
  }

  if (specifier === 'next/server' || specifier === 'next/server.js') {
    return nextServerUrl;
  }

  if (specifier.startsWith('@/')) {
    const modulePath = resolveModulePath(path.join(projectRoot, specifier.slice(2)));
    return createTempModuleFromPath(modulePath, overrides, tempDir, tempModuleCache);
  }

  if (specifier.startsWith('./') || specifier.startsWith('../')) {
    const modulePath = resolveModulePath(path.resolve(path.dirname(sourcePath), specifier));
    return createTempModuleFromPath(modulePath, overrides, tempDir, tempModuleCache);
  }

  return specifier;
}

function rewriteImportSpecifiers(
  source: string,
  overrides: Record<string, ModuleExports>,
  tempDir: string,
  tempModuleCache: Map<string, string>,
  sourcePath: string
) {
  return source.replace(/from\s+['"]([^'"]+)['"]/g, (_match, specifier: string) => {
    return `from '${resolveImportUrl(specifier, sourcePath, overrides, tempDir, tempModuleCache, true)}'`;
  });
}

function buildProjectImportUrl(relativeModulePath: string, overrides: Record<string, ModuleExports>) {
  const moduleUrl = new URL(relativeModulePath, import.meta.url);
  const tempRoot = path.join(projectRoot, '.tmp');
  mkdirSync(tempRoot, { recursive: true });
  const tempDir = mkdtempSync(path.join(tempRoot, 'phase-02-route-'));
  const tempModuleCache = new Map<string, string>();
  const importUrl = createTempModuleFromPath(fileURLToPath(moduleUrl), overrides, tempDir, tempModuleCache);

  return {
    importUrl,
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
  const { importUrl, cleanup } = buildProjectImportUrl(relativeRoutePath, overrides);

  t.after(() => {
    const store = getRouteMockStore();
    for (const key of Object.keys(overrides)) {
      delete store[key];
    }
    cleanup();
  });

  return import(`${importUrl}?phase02=${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

export async function importProjectModule(
  t: TestContext,
  relativeModulePath: string,
  overrides: Record<string, ModuleExports> = {}
) {
  const { importUrl, cleanup } = buildProjectImportUrl(relativeModulePath, overrides);

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
