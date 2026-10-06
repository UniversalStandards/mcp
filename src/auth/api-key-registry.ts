import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { PrincipalContext } from './principal-context.js';
import { generateApiKey, digestApiKey, parseApiKey, constantTimeEqual } from './api-key.js';
import { parsePrincipalContext } from './principal-context.js';

export interface ApiKeyPrincipalInput {
  principalId: string;
  principalType: Exclude<PrincipalContext['principalType'], 'anonymous'>;
  tenantId?: string;
  roles?: string[];
  scopes?: string[];
  attributes?: Record<string, unknown>;
}

export interface ApiKeyRecord {
  keyId: string;
  environment: 'live' | 'test';
  displayPrefix: string;
  principal: ApiKeyPrincipalInput;
  createdAt: string;
  expiresAt: string;
  lastUsedAt?: string;
  revokedAt?: string;
}

export interface CreateApiKeyInput extends ApiKeyPrincipalInput {
  environment?: 'live' | 'test';
  expiresInSeconds?: number;
}

export interface CreatedApiKey {
  key: ReturnType<typeof generateApiKey>;
  record: ApiKeyRecord;
}

interface StoredApiKey extends ApiKeyRecord {
  digest: string;
}

const DEFAULT_EXPIRATION_SECONDS = 90 * 24 * 60 * 60;

/**
 * File-backed API-key registry. Only HMAC digests and non-sensitive metadata
 * are persisted; the token is returned exactly once from create().
 */
export class ApiKeyRegistry {
  private readonly records = new Map<string, StoredApiKey>();
  private readonly filePath: string;
  private readonly configuredPepper?: string;

  constructor(options: { filePath?: string; pepper?: string } = {}) {
    this.filePath = options.filePath ?? process.env.API_KEYS_FILE ?? './cache/api-keys.json';
    this.configuredPepper = options.pepper;
    this.load();
  }

  create(input: CreateApiKeyInput): CreatedApiKey {
    const pepper = this.requirePepper();
    if (!input.principalId) {
      throw new Error('A named principal is required for an API key');
    }

    const expiresInSeconds = input.expiresInSeconds ?? DEFAULT_EXPIRATION_SECONDS;
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds <= 0) {
      throw new Error('expiresInSeconds must be a positive integer');
    }

    const key = generateApiKey(input.environment ?? 'live');
    const createdAt = new Date();
    const record: ApiKeyRecord = {
      keyId: key.keyId,
      environment: input.environment ?? 'live',
      displayPrefix: key.displayPrefix,
      principal: {
        principalId: input.principalId,
        principalType: input.principalType,
        ...(input.tenantId ? { tenantId: input.tenantId } : {}),
        roles: [...(input.roles ?? [])],
        scopes: [...(input.scopes ?? [])],
        attributes: { ...(input.attributes ?? {}) },
      },
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + expiresInSeconds * 1000).toISOString(),
    };

    const stored: StoredApiKey = {
      ...record,
      digest: digestApiKey(key.token, pepper),
    };
    this.records.set(record.keyId, stored);
    this.persist();
    return { key, record };
  }

  authenticate(token: string): PrincipalContext | null {
    const pepper = this.requirePepper();
    const parsed = parseApiKey(token);
    if (!parsed) return null;

    const record = this.records.get(parsed.keyId);
    if (!record || record.environment !== parsed.environment || record.revokedAt) return null;
    if (new Date(record.expiresAt).getTime() <= Date.now()) return null;

    const digest = digestApiKey(token, pepper);
    if (!constantTimeEqual(digest, record.digest)) return null;

    record.lastUsedAt = new Date().toISOString();
    return parsePrincipalContext({
      ...record.principal,
      authMethod: 'api_key',
      credentialId: record.keyId,
      issuedAt: Math.floor(new Date(record.createdAt).getTime() / 1000),
      expiresAt: Math.floor(new Date(record.expiresAt).getTime() / 1000),
    });
  }

  revoke(keyId: string): boolean {
    const record = this.records.get(keyId);
    if (!record || record.revokedAt) return false;
    record.revokedAt = new Date().toISOString();
    this.persist();
    return true;
  }

  get(keyId: string): ApiKeyRecord | null {
    const record = this.records.get(keyId);
    return record ? this.publicRecord(record) : null;
  }

  list(): ApiKeyRecord[] {
    return [...this.records.values()].map((record) => this.publicRecord(record));
  }

  private requirePepper(): string {
    const pepper = this.configuredPepper ?? process.env.API_KEY_PEPPER ?? '';
    if (pepper.length < 32) {
      throw new Error('API_KEY_PEPPER must be configured with at least 32 characters');
    }
    return pepper;
  }

  private publicRecord(record: StoredApiKey): ApiKeyRecord {
    const publicRecord = { ...record } as Partial<StoredApiKey>;
    delete publicRecord.digest;
    return publicRecord as ApiKeyRecord;
  }

  private load(): void {
    try {
      if (!fs.existsSync(this.filePath)) return;
      const data = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as Record<string, StoredApiKey>;
      for (const [keyId, record] of Object.entries(data)) {
        if (
          record &&
          keyId === record.keyId &&
          typeof record.digest === 'string' &&
          typeof record.expiresAt === 'string'
        ) {
          this.records.set(keyId, record);
        }
      }
    } catch {
      // A corrupt registry must fail closed at authentication time. Do not
      // prevent health endpoints from starting so operators can recover it.
      this.records.clear();
    }
  }

  private persist(): void {
    const directory = path.dirname(this.filePath);
    fs.mkdirSync(directory, { recursive: true });
    const temporaryPath = `${this.filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
    const data = Object.fromEntries(this.records.entries());
    fs.writeFileSync(temporaryPath, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(temporaryPath, this.filePath);
  }
}

let defaultRegistry: ApiKeyRegistry | undefined;

export function getDefaultApiKeyRegistry(): ApiKeyRegistry {
  defaultRegistry ??= new ApiKeyRegistry();
  return defaultRegistry;
}
