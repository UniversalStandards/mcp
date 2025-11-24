# Universal MCP Server Hub 🚀

A self-expanding, intelligent MCP (Model Context Protocol) server that automatically discovers, installs, and provisions tools from public registries on-demand.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-purple.svg)](https://modelcontextprotocol.io)

---

## 🌟 Introduction

The **Universal MCP Server Hub** represents a paradigm shift in how AI applications interact with external tools and services. Traditional MCP (Model Context Protocol) implementations require developers to manually discover, install, configure, and maintain each individual server—a process that becomes increasingly cumbersome as the ecosystem grows. Imagine needing to search through registries, read documentation, install dependencies, configure authentication, and update your client configuration every time you want to add a new capability to your AI assistant. This manual overhead creates friction, slows development, and limits the dynamic potential of AI-powered applications.

Our solution transforms this static, manual workflow into an intelligent, self-expanding system that operates more like a modern package manager combined with an AI-powered orchestration layer. When your AI client needs a capability—whether it's searching GitHub repositories, reading files, querying databases, or calling external APIs—the Universal MCP Hub automatically searches both private repositories and public registries, discovers the appropriate tool, installs it with all necessary dependencies, generates the required configuration, securely manages credentials, and provisions the tool for immediate use. All of this happens transparently, without requiring manual intervention or configuration changes. The system even includes an AI-powered request normalization layer that intelligently translates between different MCP client formats, handles parameter variations, fills in sensible defaults, and ensures compatibility across the diverse ecosystem of MCP implementations.

This approach unlocks unprecedented flexibility and scalability for AI applications. Development teams can focus on building features rather than managing infrastructure. AI assistants can dynamically expand their capabilities based on user needs rather than being limited to a pre-configured toolset. Organizations can maintain a single, centralized MCP hub that serves multiple AI clients and automatically stays up-to-date with the latest tools from the community. Whether you're building a personal AI assistant, an enterprise automation platform, or a multi-tenant AI service, the Universal MCP Hub provides the foundation for a truly dynamic, self-expanding AI ecosystem that grows with your needs.

---

## 🎯 What Makes This Different

Traditional MCP implementations require manual discovery, installation, and configuration of each server. **Universal MCP Hub** revolutionizes this workflow:

| Feature | Traditional MCP | Universal MCP Hub |
|---------|----------------|-------------------|
| **Discovery** | Manual search | Automatic registry search |
| **Installation** | Manual setup | Auto-install with dependencies |
| **Configuration** | Per-server config | Single unified config |
| **Authentication** | Multiple credentials | Centralized credential store |
| **Scalability** | Static capabilities | Self-expanding on demand |
| **Request Format** | Strict JSON-RPC | AI-powered normalization |

### Key Features

- ✨ **Auto-Discovery**: Searches private repo first, then public MCP registries automatically
- 🔄 **Dynamic Installation**: Automatically installs missing tools with all dependencies
- 🤖 **Request Normalization**: AI layer translates between different MCP client formats
- 🔐 **Single Authentication**: One credential store for all tools
- 📈 **Self-Expanding**: Grows capabilities based on user requests
- 🏷️ **Label-Based Automation**: Trigger AI-powered tasks on issues/PRs with simple labels

---

## 🏗️ Architecture

```
┌─────────────┐
│   Any AI    │  (Claude, GPT, etc.)
│   Client    │
└──────┬──────┘
       │ JSON-RPC 2.0
       ▼
┌─────────────────────────────────┐
│      Universal MCP Hub          │
│  ┌───────────────────────────┐  │
│  │ Request Normalizer (AI)   │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │   Search Private Repo     │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │  Search Public Registries │  │
│  │  - GitHub MCP Registry    │  │
│  │  - Official MCP Registry  │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │   Auto-Install & Cache    │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │  User Credential Store    │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│      GitHub Repository          │
│  - /servers (installed tools)   │
│  - /cache (metadata)            │
│  - /configs (auto-generated)    │
└─────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org))
- **GitHub account** with Actions enabled
- **MCP-compatible AI client** (Claude Desktop, Continue, etc.)
- **API keys** for AI provider (OpenAI, Anthropic, etc.)

### Installation

```bash
# Clone the repository
git clone https://github.com/UniversalStandards/mcp.git
cd mcp

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials (see Configuration section)

# Build the project
npm run build

# Start the server
npm start
```

### Verify Installation

```bash
# Check server status
curl http://localhost:3000/health

# List available tools
curl -X POST http://localhost:3000 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

---

## 📋 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# ============================================
# Server Configuration
# ============================================
PORT=3000
NODE_ENV=production
LOG_LEVEL=info

# ============================================
# GitHub Integration
# ============================================
GITHUB_TOKEN=ghp_your_github_personal_access_token
GITHUB_REPO=yourusername/universal-mcp-hub
GITHUB_BRANCH=main

# ============================================
# Registry Sources
# ============================================
GITHUB_REGISTRY_URL=https://github.com/mcp
OFFICIAL_REGISTRY_URL=https://registry.modelcontextprotocol.io

# ============================================
# AI Normalizer Configuration
# ============================================
AI_PROVIDER=openai  # Options: openai, anthropic, azure
AI_API_KEY=sk-your_ai_api_key
AI_MODEL=gpt-4      # Options: gpt-4, claude-3-opus, etc.

# ============================================
# Security
# ============================================
JWT_SECRET=your_secure_jwt_secret_min_32_chars
ENCRYPTION_KEY=your_secure_encryption_key_32_chars

# ============================================
# Cache & Performance
# ============================================
CACHE_TTL=3600
MAX_CONCURRENT_INSTALLS=3
```

### GitHub Token Permissions

Your GitHub token needs the following scopes:
- `repo` - Full control of private repositories
- `workflow` - Update GitHub Action workflows
- `read:packages` - Download packages from GitHub Package Registry

[Create a token here](https://github.com/settings/tokens/new)

---

## 🔧 How It Works

### 1. Request Flow (JSON-RPC 2.0)

Client sends a standard MCP request:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "github_search_repos",
    "arguments": {
      "query": "MCP servers"
    }
  }
}
```

### 2. AI-Powered Normalization

The AI layer interprets and normalizes requests to handle:
- Variations in parameter naming
- Missing required fields (with intelligent defaults)
- Natural language requests
- Format conversions between different MCP client implementations

### 3. Intelligent Discovery

```
1. Check private repository cache
   └─ If found → Execute immediately

2. Query GitHub MCP Registry
   └─ Search for matching tools

3. Query Official MCP Registry
   └─ Fallback to official sources

4. Parse and validate registry responses
```

### 4. Automated Installation

When a new tool is discovered:

```bash
# Triggered via GitHub Actions
npm install @modelcontextprotocol/server-github

# Generate configuration
# Update local cache
# Commit to repository
# Notify server to reload
```

### 5. Execution & Response

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Found 42 repositories matching 'MCP servers'"
      }
    ]
  }
}
```

---

## 📁 Project Structure

```
universal-mcp-hub/
├── .github/
│   └── workflows/          # GitHub Actions for auto-install
├── src/
│   ├── server.ts           # Main MCP server entry point
│   ├── normalizer/         # AI request normalizer
│   │   ├── ai-client.ts
│   │   └── request-parser.ts
│   ├── discovery/          # Registry search logic
│   │   ├── github-registry.ts
│   │   └── official-registry.ts
│   ├── installer/          # Auto-installation system
│   │   ├── npm-installer.ts
│   │   └── config-generator.ts
│   ├── auth/               # Credential management
│   │   └── credential-store.ts
│   └── cache/              # Caching layer
│       └── tool-cache.ts
├── servers/                # Installed MCP servers
├── cache/                  # Metadata cache
├── configs/                # Auto-generated configs
├── config/                 # Base configuration files
├── dist/                   # Compiled JavaScript
├── docs/                   # Documentation
├── tests/                  # Test suites
├── schema/                 # JSON schemas
├── scripts/                # Utility scripts
├── .env.example            # Environment template
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## 🎮 Usage Examples

### Example 1: GitHub Repository Search

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "github_search_repos",
    "arguments": {
      "query": "machine learning",
      "language": "python"
    }
  }
}
```

### Example 2: File System Operations

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "filesystem_read",
    "arguments": {
      "path": "/path/to/file.txt"
    }
  }
}
```

### Example 3: Web Search

```json
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "brave_search",
    "arguments": {
      "query": "latest AI news"
    }
  }
}
```

---

## 🔌 Client Integration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "universal-hub": {
      "command": "node",
      "args": ["/path/to/universal-mcp-hub/dist/server.js"],
      "env": {
        "PORT": "3000"
      }
    }
  }
}
```

### Continue (VS Code)

Add to `.continue/config.json`:

```json
{
  "mcpServers": [
    {
      "name": "universal-hub",
      "url": "http://localhost:3000"
    }
  ]
}
```

---

## 🧪 Development

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test -- --grep "discovery"
```

### Development Mode

```bash
# Start with hot reload
npm run dev

# Watch mode for TypeScript
npm run watch

# Lint code
npm run lint

# Format code
npm run format
```

### Adding a New Registry Source

1. Create a new file in `src/discovery/`
2. Implement the `RegistrySource` interface
3. Register in `src/discovery/index.ts`

```typescript
export interface RegistrySource {
  name: string;
  search(query: string): Promise<Tool[]>;
  getMetadata(toolName: string): Promise<ToolMetadata>;
}
```

---

## 🏷️ Label-Based Automation

Trigger automated tasks by adding labels to GitHub issues or pull requests:

| Label | Action |
|-------|--------|
| `mcp:analyze` | Run code analysis |
| `mcp:test` | Execute test suite |
| `mcp:document` | Generate documentation |
| `mcp:review` | AI-powered code review |

Configure in `.github/workflows/mcp-automation.yml`

---

## 🛡️ Security

### Credential Storage

- All credentials are encrypted using AES-256
- Stored in secure environment variables or secret management systems
- Never committed to version control

### API Key Management

- Rotate API keys regularly
- Use separate keys for development and production
- Monitor usage and set rate limits

### Network Security

- Use HTTPS for all external communications
- Validate all registry responses
- Implement request signing for authentication

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Follow TypeScript best practices
- Use ESLint and Prettier configurations
- Write tests for new features
- Update documentation

---

## 📚 Documentation

- [MCP Specification](https://modelcontextprotocol.io/docs)
- [API Reference](docs/API.md)
- [Architecture Guide](docs/ARCHITECTURE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)

---

## 🐛 Troubleshooting

### Server won't start

```bash
# Check Node.js version
node --version  # Should be 18+

# Verify dependencies
npm install

# Check environment variables
cat .env
```

### Tools not auto-installing

- Verify GitHub token has correct permissions
- Check GitHub Actions are enabled
- Review workflow logs in GitHub Actions tab

### AI normalization errors

- Verify AI provider API key is valid
- Check AI_MODEL is supported by your provider
- Review logs for specific error messages

---

## 📊 Performance

- **Cold start**: ~2-3 seconds
- **Tool discovery**: ~500ms average
- **Auto-installation**: ~10-30 seconds (cached after first install)
- **Request normalization**: ~200ms average

---

## 🗺️ Roadmap

- [ ] Support for more AI providers (Gemini, Cohere)
- [ ] Web UI for server management
- [ ] Plugin marketplace
- [ ] Multi-language support (Python, Go, Rust)
- [ ] Distributed caching with Redis
- [ ] Kubernetes deployment templates
- [ ] Advanced monitoring and analytics

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io) - For the MCP specification
- [Anthropic](https://anthropic.com) - For Claude and MCP development
- All contributors and the open-source community

---

## 📞 Support

- **Issues**: [GitHub Issues](https://github.com/UniversalStandards/mcp/issues)
- **Discussions**: [GitHub Discussions](https://github.com/UniversalStandards/mcp/discussions)
- **Email**: support@universalstandards.dev

---

## ⭐ Star History

If you find this project useful, please consider giving it a star! ⭐

---

**Made with ❤️ by the Universal Standards team**
