#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const schemaPath = path.resolve(__dirname, '../schema/hub-schema.json');
const mcpSchemaPath = path.resolve(__dirname, '../schema/mcp-config.schema.json');
const configPath = path.resolve(__dirname, '../config/mcp-config.json');

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
const mcpSchema = JSON.parse(fs.readFileSync(mcpSchemaPath, 'utf8'));
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const validateHub = ajv.compile(schema);
const validateMcp = ajv.compile(mcpSchema);
const hubBaseline = {
  hub: { version: '1.0.0', name: 'Universal MCP Hub', installedServers: [] },
  config: {
    registries: { github: { enabled: true }, official: { enabled: true } },
    normalizer: { provider: 'openai' },
    github: { repo: process.env.GITHUB_REPO || 'UniversalStandards/mcp', token: '***' }
  }
};

const hubValid = validateHub(hubBaseline);
const mcpValid = validateMcp(config);

if (!hubValid || !mcpValid) {
  if (!hubValid) console.error('Hub schema validation errors:', validateHub.errors);
  if (!mcpValid) console.error('MCP configuration validation errors:', validateMcp.errors);
  process.exit(1);
}

console.log('✅ Hub schema baseline and config/mcp-config.json are valid.');
