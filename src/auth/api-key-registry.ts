import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { digestApiKey, generateApiKey, parseApiKey, constantTimeEqual, type GeneratedApiKey } from './api-key.js';
import { parsePrincipalContext, type PrincipalContext } from './principal-context.js';

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
  key: GeneratedApiKey;
  record: ApiKeyRecord;
}

interface StoredApiKey extends ApiKeyRecord {
  digest: string;
}

const DEFAULT_EXPIRATION_SECONDS = 90 * 24 * 60 * 60;
const MIN_PEPPER_LENGTH = 32;

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
    const principal = parsePrincipalContext({
      principalId: input.principalId, principalType: input.principalType,
      tenantId: input.tenantId, roles: input.roles, scopes: input.scopes,
      attributes: input.attributes, authMethod: 'api_key',
    });
    if (principal.principalType === 'anonymous') throw new Error('A named principal is required for an API key');
    if (input.environment !== undefined && !['live', 'test'].includes(input.environment)) {
      throw new Error('Invalid API key environment');
    }

    const expiresInSeconds = input.expiresInSeconds ?? DEFAULT_EXPIRATION_SECONDS;
    if (!Number.isSafeInteger(expiresInSeconds) || expiresInSeconds <= 0) {
      throw new Error('expiresInSeconds must be a positive integer');
    }

    const key = generateApiKey(input.environment ?? 'live');
    const createdAt = new Date();
    const record: ApiKeyRecord = {
      keyId: key.keyId,
      environment: input.environment ?? 'live',
      displayPrefix: key.displayPrefix,
      principal: {
        principalId: principal.principalId,
        principalType: principal.principalType,
        ...(principal.tenantId ? { tenantId: principal.tenantId } : {}),
        roles: principal.roles,
        scopes: principal.scopes,
        attributes: structuredClone(principal.attributes),
      },
      createdAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + expiresInSeconds * 1000).toISOString(),
    };

    this.records.set(record.keyId, {
      ...record,
      digest: digestApiKey(key.token, pepper),
    });
    try {
      this.persist();
    } catch (error) {
      this.records.delete(record.keyId);
      throw error;
    }
    return { key, record: this.get(record.keyId)! };
  }

  authenticate(token: string): PrincipalContext | null {
    const pepper = this.requirePepper();
    const parsed = parseApiKey(token);
    if (!parsed) return null;

    const record = this.records.get(parsed.keyId);
    if (!record || record.environment !== parsed.environment || record.revokedAt) return null;
    const createdAt = Date.parse(record.createdAt);
    const expiresAt = Date.parse(record.expiresAt);
    if (!Number.isFinite(createdAt) || !Number.isFinite(expiresAt) ||
        expiresAt <= Date.now() || createdAt > Date.now() || expiresAt <= createdAt) return null;

    const digest = digestApiKey(token, pepper);
    if (!constantTimeEqual(digest, record.digest)) return null;

    try {
      const principal = parsePrincipalContext({
        ...record.principal, authMethod: 'api_key', credentialId: record.keyId,
        issuedAt: Math.floor(createdAt / 1000), expiresAt: Math.floor(expiresAt / 1000),
      });
      record.lastUsedAt = new Date().toISOString();
      return principal;
    } catch {
      return null;
    }
  }

  revoke(keyId: string): boolean {
    const record = this.records.get(keyId);
    if (!record || record.revokedAt) return false;
    record.revokedAt = new Date().toISOString();
    try {
      this.persist();
    } catch (error) {
      delete record.revokedAt;
      throw error;
    }
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
    if (pepper.trim().length < MIN_PEPPER_LENGTH) {
      throw new Error('API_KEY_PEPPER must be configured with at least 32 characters');
    }
    return pepper;
  }

  private publicRecord(record: StoredApiKey): ApiKeyRecord {
    const publicRecord = structuredClone(record) as Partial<StoredApiKey>;
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
      // A corrupt registry must fail closed at authentication time.
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
