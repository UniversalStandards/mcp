import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const docs = fs.readFileSync(path.join(root, 'docs', 'IDENTITY_TRUST.md'), 'utf8');
const required = [
  'IAM-ARCH-001',
  'IAM-ARCH-002',
  'IAM-AUTHZ-001',
  'IAM-KEY-001',
  'IAM-KEY-002',
];
const files = [
  'src/auth/principal-context.ts',
  'src/auth/authentication.ts',
  'src/auth/authorization.ts',
  'src/auth/api-key.ts',
  'tests/unit/identity-trust.test.ts',
];
const failures = [];

for (const controlId of required) {
  if (!docs.includes(controlId)) failures.push(`docs/IDENTITY_TRUST.md does not trace ${controlId}`);
}
for (const file of files) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`required implementation/evidence file is missing: ${file}`);
}

if (failures.length) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exit(1);
}

console.log(`MCP identity trust traceability passed: ${required.length} controls and ${files.length} files.`);
