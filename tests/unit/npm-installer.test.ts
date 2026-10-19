import { afterEach, describe, expect, test } from '@jest/globals';
import { npmInstall } from '../../src/installer/npm-installer.js';

const originalEnabled = process.env.MCP_AUTO_INSTALL;
const originalApproved = process.env.MCP_APPROVED_PACKAGES;

afterEach(() => {
  if (originalEnabled === undefined) delete process.env.MCP_AUTO_INSTALL;
  else process.env.MCP_AUTO_INSTALL = originalEnabled;
  if (originalApproved === undefined) delete process.env.MCP_APPROVED_PACKAGES;
  else process.env.MCP_APPROVED_PACKAGES = originalApproved;
});

describe('Package installation boundary', () => {
  test.each(['package;whoami', '--global', 'https://example.com/package.tgz', '../package', '$(whoami)', 'pkg && whoami'])(
    'rejects unsafe package specifier %s before invoking a subprocess', async specifier => {
      process.env.MCP_AUTO_INSTALL = 'true';
      await expect(npmInstall(specifier)).rejects.toThrow('invalid npm package specifier');
    }
  );

  test('disables installation by default', async () => {
    delete process.env.MCP_AUTO_INSTALL;
    await expect(npmInstall('package@1.2.3')).rejects.toThrow('disabled');
  });

  test('requires an explicit package approval', async () => {
    process.env.MCP_AUTO_INSTALL = 'true';
    delete process.env.MCP_APPROVED_PACKAGES;
    await expect(npmInstall('package@1.2.3')).rejects.toThrow('explicitly approved');
  });

  test.each(['package', 'package@latest', 'package@^1.2.3'])('rejects floating version %s even if listed', async specifier => {
    process.env.MCP_AUTO_INSTALL = 'true';
    process.env.MCP_APPROVED_PACKAGES = specifier;
    await expect(npmInstall(specifier)).rejects.toThrow('exact version');
  });
});
