import fs from 'fs/promises';
import { constants as fsConstants } from 'fs';
import { spawn } from 'child_process';
import path from 'path';

const projectRoot = process.cwd();
const runtimePath = path.join(projectRoot, '.next', 'server', 'webpack-runtime.js');
const nextBin = path.join(projectRoot, 'node_modules', 'next', 'dist', 'bin', 'next');

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

async function main() {
  const child = spawn(process.execPath, [nextBin, 'dev', '-H', '0.0.0.0'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
  });

  const patchTimer = setInterval(() => {
    patchWebpackRuntime().catch((error) => {
      process.stderr.write(`[dev-runtime-fix] patch failed: ${error.message}\n`);
    });
  }, 400);

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
