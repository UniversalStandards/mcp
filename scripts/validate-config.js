#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const schema = JSON.parse(fs.readFileSync(path.join(root, 'schema/mcp-config.schema.json'), 'utf8'));
const configPath = path.resolve(process.argv[2] || path.join(root, 'config/mcp-config.json'));
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const validate = new Ajv({ allErrors: true, strict: true }).compile(schema);

if (!validate(config)) {
  console.error(`Invalid MCP configuration: ${configPath}`);
  console.error(validate.errors);
  process.exitCode = 1;
} else {
  console.log(`Valid MCP configuration: ${configPath}`);
}
