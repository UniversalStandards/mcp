#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.resolve(__dirname, '../schema/hub-schema.json');
const configPath = path.resolve(__dirname, '../config/mcp-config.json');

const ajv = new Ajv({ allErrors: true, strict: false });

const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const validate = ajv.compile(schema);
const valid = validate({
  hub: { version: '1.0.0', name: 'Universal MCP Hub', installedServers: [] },
  config: {
    registries: { github: { enabled: true }, official: { enabled: true } },
    normalizer: { provider: 'openai' },
    github: { repo: process.env.GITHUB_REPO || 'UniversalStandards/mcp', token: '***' }
  }
});

if (!valid) {
  console.error('Schema validation errors:', validate.errors);
  process.exit(1);
}

console.log('✅ Schema baseline OK. (Note: full config validation occurs at runtime)');
