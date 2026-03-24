import fs from 'fs/promises';
import { constants as fsConstants } from 'fs';
import { spawn } from 'child_process';
import path from 'path';

const projectRoot = process.cwd();
const nextDir = path.join(projectRoot, '.next');
const runtimePath = path.join(projectRoot, '.next', 'server', 'webpack-runtime.js');
const nextBin = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');
const forwardedArgs = process.argv.slice(2);
const resolvedHost = process.env.HOST || '127.0.0.1';

const TARGET_SNIPPET = 'return "" + chunkId + ".js";';
const PATCH_SNIPPET =
  'return (/^[0-9]+$/.test(String(chunkId)) ? "chunks/" + chunkId + ".js" : "" + chunkId + ".js");';

async function patchWebpackRuntime() {
  try {
    await fs.access(runtimePath, fsConstants.F_OK);
  } catch {
    return false;
  }

  const original = await fs.readFile(runtimePath, 'utf8');
  if (original.includes(PATCH_SNIPPET)) {
    return false;
  }

  if (!original.includes(TARGET_SNIPPET)) {
    return false;
  }

  const patched = original.replace(TARGET_SNIPPET, PATCH_SNIPPET);
  await fs.writeFile(runtimePath, patched, 'utf8');
  process.stdout.write('[dev-runtime-fix] patched .next/server/webpack-runtime.js\n');
  return true;
}

function buildStaleNextDirName() {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');

  return path.join(projectRoot, `.next_stale_${stamp}`);
}

async function isolateExistingNextDir() {
  try {
    await fs.access(nextDir, fsConstants.F_OK);
  } catch {
    return false;
  }

  const entries = await fs.readdir(nextDir);
  if (entries.length === 0) {
    return false;
  }

  let staleDir = buildStaleNextDirName();
  let suffix = 1;

  while (true) {
    try {
      await fs.access(staleDir, fsConstants.F_OK);
      staleDir = `${buildStaleNextDirName()}_${suffix}`;
      suffix += 1;
    } catch {
      break;
    }
  }

  await fs.rename(nextDir, staleDir);
  process.stdout.write(`[dev-runtime-fix] moved existing .next to ${path.basename(staleDir)}\n`);
  return true;
}

async function main() {
  await isolateExistingNextDir();

  const child = spawn(process.execPath, [nextBin, 'dev', '-H', resolvedHost, ...forwardedArgs], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
  });

  patchWebpackRuntime().catch((error) => {
    process.stderr.write(`[dev-runtime-fix] initial patch failed: ${error.message}\n`);
  });

  const patchTimer = setInterval(() => {
    patchWebpackRuntime().catch((error) => {
      process.stderr.write(`[dev-runtime-fix] patch failed: ${error.message}\n`);
    });
  }, 100);

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on('SIGINT', forwardSignal);
  process.on('SIGTERM', forwardSignal);

  child.on('exit', (code, signal) => {
    clearInterval(patchTimer);

    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  process.stderr.write(`[dev-runtime-fix] startup failed: ${error.message}\n`);
  process.exit(1);
});
