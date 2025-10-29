#!/bin/bash
set -euo pipefail

echo '🚀 Setting up GitHub MCP Framework...'

command -v node >/dev/null || { echo 'Node.js required'; exit 1; }
command -v git  >/dev/null || { echo 'Git required'; exit 1; }

if [ ! -f .env ]; then
  cp .env.example .env
  echo '📝 Created .env from example — please edit credentials.'
fi

mkdir -p logs cache servers configs

chmod +x scripts/validate-config.js || true

echo '✅ Setup complete.'
