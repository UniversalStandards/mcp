# UniversalStandards/mcp Setup Guide

## Repository Structure

```
UniversalStandards/mcp/
├── README.md
├── github/
│   ├── main.yaml              # Entry point (2KB)
│   ├── schemas.yaml           # Data models
│   ├── files.yaml             # File operations
│   ├── repos.yaml             # Repository management
│   ├── issues.yaml            # Issues & comments
│   ├── pulls.yaml             # Pull requests & reviews
│   ├── branches.yaml          # Branch operations
│   └── search.yaml            # Search functionality
├── slack/                     # Future: Slack API modules
├── stripe/                    # Future: Stripe API modules
└── examples/                  # Usage examples
```

## Quick Setup

### 1. Clone and Navigate
```bash
git clone https://github.com/UniversalStandards/mcp.git
cd mcp
```

### 2. Verify Structure
```bash
tree github/
# Should show all .yaml files
```

### 3. Test Main File
```bash
# Check main.yaml size (should be ~2KB)
ls -la github/main.yaml

# Validate YAML syntax
yamllint github/main.yaml
```

## AI Tool Integration

### Universal Configuration
```json
{
  "name": "GitHub API",
  "description": "Complete GitHub repository and code management",
  "openapi_url": "https://raw.githubusercontent.com/UniversalStandards/mcp/main/github/main.yaml",
  "authentication": {
    "type": "bearer",
    "token_field": "github_token"
  },
  "cache_settings": {
    "cache_references": true,
    "cache_ttl": 3600,
    "cache_max_size": "10MB"
  }
}
```

### Environment Variables
```bash
# Required
export GITHUB_TOKEN="ghp_your_token_here"

# Optional
export GITHUB_API_BASE_URL="https://api.github.com"
export GITHUB_RATE_LIMIT="5000"
```

## File Descriptions

### Core Files

#### `main.yaml` (Entry Point)
- **Size**: ~2KB
- **Purpose**: References to all other modules
- **Load**: Immediate (by AI tools)
- **Updates**: Rarely needed

#### `schemas.yaml` (Data Models)
- **Size**: ~3KB
- **Purpose**: All GitHub object definitions
- **Load**: On-demand when objects referenced
- **Updates**: When GitHub API changes

#### `files.yaml` (File Operations)
- **Size**: ~2KB
- **Purpose**: Get, create, update, delete files
- **Load**: When file operations needed
- **Updates**: When new file features added

#### `repos.yaml` (Repository Management)
- **Size**: ~4KB  
- **Purpose**: Repository CRUD, collaborators
- **Load**: When repository operations needed
- **Updates**: When new repo features added

#### `issues.yaml` (Issue Management)
- **Size**: ~3KB
- **Purpose**: Issues, comments, assignees
- **Load**: When issue operations needed
- **Updates**: When new issue features added

#### `pulls.yaml` (Pull Requests)
- **Size**: ~4KB
- **Purpose**: PRs, reviews, merging
- **Load**: When PR operations needed
- **Updates**: When new PR features added

#### `branches.yaml` (Branch Operations)
- **Size**: ~3KB
- **Purpose**: Branch management, refs, merging
- **Load**: When branch operations needed
- **Updates**: When new branch features added

#### `search.yaml` (Search Functions)
- **Size**: ~2KB
- **Purpose**: Search repos, issues, code, users
- **Load**: When search operations needed
- **Updates**: When new search features added

## Development Workflow

### Making Changes

1. **Single Module Updates**
```bash
# Edit specific module
vim github/issues.yaml

# Test changes
./scripts/validate-module.sh github/issues.yaml

# Commit
git add github/issues.yaml
git commit -m "feat: add issue labels endpoint"
git push
```

2. **Adding New Endpoints**
```bash
# Create new module
touch github/releases.yaml

# Add to main.yaml
vim github/main.yaml
# Add reference: $ref: 'https://raw.githubusercontent.com/UniversalStandards/mcp/main/github/releases.yaml#/paths/releases'

# Commit both
git add github/releases.yaml github/main.yaml
git commit -m "feat: add releases module"
```

3. **Schema Changes**
```bash
# Update schemas
vim github/schemas.yaml

# Verify no breaking changes
./scripts/schema-diff.sh

# Update version if needed
./scripts/bump-version.sh minor
```

### Testing

#### Validation Script
```bash
#!/bin/bash
# scripts/validate-all.sh

echo "🔍 Validating OpenAPI modules..."

for file in github/*.yaml; do
    echo "Checking $file..."
    
    # YAML syntax
    yamllint "$file" || exit 1
    
    # OpenAPI validation
    swagger-codegen validate -i "$file" || exit 1
    
    # Reference resolution
    ./scripts/check-refs.sh "$file" || exit 1
    
    echo "✅ $file valid"
done

echo "🎉 All modules validated successfully!"
```

#### Reference Checker
```bash
#!/bin/bash
# scripts/check-refs.sh

file="$1"
echo "🔗 Checking references in $file..."

# Extract all $ref URLs
refs=$(grep -o 'https://raw\.githubusercontent\.com[^"]*' "$file")

for ref in $refs; do
    echo "  Checking: $ref"
    if curl -f -s "$ref" > /dev/null; then
        echo "  ✅ Valid"
    else
        echo "  ❌ Invalid: $ref"
        exit 1
    fi
done
```

## Advanced Patterns

### Environment-Specific Modules
```yaml
# github/main-dev.yaml
$ref: 'https://raw.githubusercontent.com/UniversalStandards/mcp/dev/github/schemas.yaml'

# github/main-prod.yaml  
$ref: 'https://raw.githubusercontent.com/UniversalStandards/mcp/main/github/schemas.yaml'
```

### Feature Flags
```yaml
# github/main-experimental.yaml
paths:
  /experimental:
    $ref: 'https://raw.githubusercontent.com/UniversalStandards/mcp/experimental/github/beta-features.yaml'
```

### Versioning Strategy
```bash
# Tag releases
git tag -a v1.0.0 -m "GitHub API v1.0.0"
git push origin v1.0.0

# Use versioned URLs
https://raw.githubusercontent.com/UniversalStandards/mcp/v1.0.0/github/main.yaml
```

## Performance Optimization

### CDN Integration
```yaml
# Use jsDelivr for faster loading
$ref: 'https://cdn.jsdelivr.net/gh/UniversalStandards/mcp@main/github/schemas.yaml'
```

### Compression
```bash
# Pre-compress files
gzip github/*.yaml

# Serve with correct headers
Content-Encoding: gzip
Cache-Control: public, max-age=3600
```

### Smart Caching
```yaml
# Add cache hints in comments
# Cache-TTL: 3600
# Cache-Key: github-schemas-v1.2.3
```

## Monitoring & Analytics

### Usage Tracking
```bash
# Monitor reference loads
tail -f /var/log/nginx/access.log | grep "raw.githubusercontent.com.*mcp"
```

### Performance Metrics
- **First Load Time**: < 100ms (main.yaml)
- **Reference Resolution**: < 200ms per module
- **Cache Hit Rate**: > 90%
- **Error Rate**: < 0.1%

### Health Checks
```bash
# Daily validation
0 6 * * * /path/to/validate-all.sh

# Reference availability check
*/15 * * * * /path/to/check-refs.sh github/main.yaml
```

## Troubleshooting

### Common Issues

1. **"Reference not found"**
```bash
# Check if file exists
curl -I https://raw.githubusercontent.com/UniversalStandards/mcp/main/github/schemas.yaml

# Verify branch name
git branch -r | grep main
```

2. **"YAML parse error"**
```bash
# Validate syntax
yamllint github/schemas.yaml

# Check for tabs vs spaces
cat -A github/schemas.yaml | grep -E '^\t'
```

3. **"Circular reference"**
```bash
# Find circular refs
./scripts/detect-circular-refs.sh github/
```

### Support

- **Issues**: https://github.com/UniversalStandards/mcp/issues
- **Discussions**: https://github.com/UniversalStandards/mcp/discussions  
- **Wiki**: https://github.com/UniversalStandards/mcp/wiki

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/new-endpoints`
3. Add your modules following existing patterns
4. Run validation: `./scripts/validate-all.sh`
5. Submit pull request

## License

This project is licensed under the MIT License - see LICENSE file for details.
