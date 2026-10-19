import { spawn } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const PACKAGE_SPECIFIER = /^@?[a-z0-9][a-z0-9._~-]*(?:\/[a-z0-9][a-z0-9._~-]*)?(?:@[a-z0-9.*~^<>=|+_-]+)?$/i;
const DEFAULT_INSTALL_TIMEOUT_MS = 5 * 60 * 1000;

function getInstallTimeout(): number {
  const configured = Number.parseInt(process.env.MCP_INSTALL_TIMEOUT_MS || '', 10);
  if (!Number.isFinite(configured)) {
    return DEFAULT_INSTALL_TIMEOUT_MS;
  }

  return Math.min(Math.max(configured, 5_000), 15 * 60 * 1000);
}

export async function npmInstall(serverId: string): Promise<void> {
  if (!PACKAGE_SPECIFIER.test(serverId)) {
    throw new Error('Refusing to install an invalid npm package specifier');
  }

  if (process.env.MCP_AUTO_INSTALL !== 'true') {
    throw new Error('Automatic installation is disabled');
  }
  const approved = (process.env.MCP_APPROVED_PACKAGES || '').split(',').map(value => value.trim());
  if (!approved.includes(serverId) || !/@\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?$/i.test(serverId)) {
    throw new Error('Installation requires an explicitly approved package with an exact version');
  }
  // Windows cannot execute npm.cmd without a shell. Invoke the npm CLI with
  // Node directly, keeping package arguments separate on every platform.
  const npmCli = process.env.npm_execpath || path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
  if (!fs.existsSync(npmCli)) throw new Error('npm CLI is unavailable; start through npm or configure npm_execpath');
  const args = [npmCli, 'install', '--prefix', './servers', '--ignore-scripts', '--', serverId];
  const timeoutMs = getInstallTimeout();

  await new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'ignore', 'pipe']
    });

    let stderr = '';
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`npm install timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    timer.unref();

    child.stderr.on('data', (chunk: Buffer) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-2000);
    });

    child.once('error', (error) => {
      clearTimeout(timer);
      reject(new Error(`Unable to start npm install: ${error.message}`));
    });

    child.once('close', (code, signal) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }

      const reason = signal ? `signal ${signal}` : `exit code ${code}`;
      reject(new Error(`npm install failed with ${reason}${stderr ? `: ${stderr.trim()}` : ''}`));
    });
  });
}
