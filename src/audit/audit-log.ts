import fs from 'node:fs';
import path from 'node:path';

export interface AuditEvent {
  eventType: 'authentication' | 'authorization';
  outcome: 'success' | 'failure';
  requestId: string;
  principalId?: string;
  authMethod?: string;
  controlId: string;
  reason: string;
  action?: string;
  resource?: string;
  metadata?: Record<string, string | number | boolean | undefined>;
  occurredAt?: string;
}

const SENSITIVE_KEY = /(token|secret|password|credential|authorization|api[-_]?key)/i;

function redactMetadata(metadata: AuditEvent['metadata']): AuditEvent['metadata'] | undefined {
  if (!metadata) return undefined;
  return Object.fromEntries(Object.entries(metadata).map(([key, value]) => [
    key,
    SENSITIVE_KEY.test(key) ? '[REDACTED]' : value,
  ]));
}

export function writeAuditEvent(event: AuditEvent): void {
  const record = {
    ...event,
    occurredAt: event.occurredAt ?? new Date().toISOString(),
    metadata: redactMetadata(event.metadata),
  };
  const filePath = process.env.AUDIT_LOG_FILE;
  if (!filePath) return;

  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.appendFileSync(filePath, `${JSON.stringify(record)}\n`, { encoding: 'utf8', mode: 0o600 });
  } catch {
    // Audit failures must not turn a valid deny into an allow. The caller's
    // authorization result remains fail-closed even if persistence is down.
  }
}
