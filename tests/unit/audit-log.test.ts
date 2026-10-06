import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, test } from '@jest/globals';
import { writeAuditEvent } from '../../src/audit/audit-log.js';

describe('audit log redaction', () => {
  const temporaryDirectories: string[] = [];
  const previousAuditLogFile = process.env.AUDIT_LOG_FILE;

  afterEach(() => {
    if (previousAuditLogFile === undefined) delete process.env.AUDIT_LOG_FILE;
    else process.env.AUDIT_LOG_FILE = previousAuditLogFile;

    for (const directory of temporaryDirectories.splice(0)) {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });

  test('redacts credential-bearing metadata before persistence', () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-audit-'));
    temporaryDirectories.push(directory);
    const logFile = path.join(directory, 'audit.log');
    process.env.AUDIT_LOG_FILE = logFile;

    writeAuditEvent({
      eventType: 'authentication',
      outcome: 'failure',
      requestId: 'request-1',
      controlId: 'IAM-OAUTH-001',
      reason: 'invalid_credential',
      metadata: {
        token: 'must-not-persist',
        authorization: 'Bearer must-not-persist',
        safeReason: 'invalid_credential',
      },
    });

    const record = JSON.parse(fs.readFileSync(logFile, 'utf8')) as { metadata: Record<string, string> };
    expect(record.metadata).toEqual({
      token: '[REDACTED]',
      authorization: '[REDACTED]',
      safeReason: 'invalid_credential',
    });
    expect(fs.readFileSync(logFile, 'utf8')).not.toContain('must-not-persist');
  });
});
