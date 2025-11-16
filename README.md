# Universal MCP Server Hub 🚀

A self-expanding, intelligent MCP server that automatically discovers, installs, and provisions tools from public registries on-demand.

## 🎯 What Makes This Different

Traditional MCP implementations require manual discovery, installation, and configuration of each server [1] [2]. Our Universal MCP Hub:

- **Auto-Discovery**: Searches private repo first, then public MCP registries automatically [3] [4]
- **Dynamic Installation**: Automatically installs missing tools with all dependencies [1] [3]
- **Request Normalization**: AI layer translates between different MCP client formats [5] [6]
- **Single Authentication**: One credential store for all tools [1] [2]
- **Self-Expanding**: Grows capabilities based on user requests [3] [4]
- **Label-Based Automation**: Trigger AI-powered tasks on issues/PRs with simple labels 🆕

## 🏗️ Architecture

```
┌─────────────┐
│  Any AI     │ (Claude, GPT, etc.)
│  Client     │
└──────┬──────┘
       │ JSON-RPC 2.0 [5] [6]
       ▼
┌─────────────────────────────────┐
│  Universal MCP Hub              │
│  ┌───────────────────────────┐  │
│  │ Request Normalizer (AI)   │  │ [5] [7]
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ Search Private Repo       │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ Search Public Registries  │  │ [3] [4]
│  │ - GitHub MCP Registry     │  │ [1]
│  │ - Official MCP Registry   │  │ [3]
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ Auto-Install & Cache      │  │ [1] [2]
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ User Credential Store     │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────┐
│  GitHub Repository              │
│  - /servers (installed tools)   │ [8]
│  - /cache (metadata)            │
│  - /configs (auto-generated)    │
└─────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ [2] [8]
- GitHub account with Actions enabled [1] [8]
- MCP-compatible AI client [2] [5]

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/universal-mcp-hub.git
cd universal-mcp-hub

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Start the server
npm start
```

## 📋 Configuration

Create `.env` file:

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# GitHub Integration [1] [8]
GITHUB_TOKEN=your_github_token
GITHUB_REPO=yourusername/universal-mcp-hub
GITHUB_BRANCH=main

# Registry Sources [3] [4]
GITHUB_REGISTRY_URL=https://github.com/mcp
OFFICIAL_REGISTRY_URL=https://registry.modelcontextprotocol.io

# AI Normalizer (OpenAI/Anthropic/etc.) [5]
AI_PROVIDER=openai
AI_API_KEY=your_ai_api_key
AI_MODEL=gpt-4

# Security
JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=your_encryption_key
```

## 🔧 How It Works

### 1. Request Flow [5] [6] [7]

```typescript
// Client sends JSON-RPC 2.0 request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "github_search_repos",
    "arguments": { "query": "MCP servers" }
  }
}
```

### 2. Normalization [5] [7]

AI layer interprets the request and normalizes it to standard MCP format [5] [6].

### 3. Discovery [3] [4]

- Check private repo cache
- If not found, query GitHub MCP Registry [1] [3]
- Query official MCP Registry [3] [4]
- Parse registry API responses [1] [3]

### 4. Auto-Installation [1] [2] [8]

```bash
# Triggered via GitHub Actions
npm install @modelcontextprotocol/server-github
# Generate config
# Update cache
# Commit to repo
```

### 5. Execution & Response [5] [6]

Execute tool and return JSON-RPC response [5] [6] [7].

## 📁 Project Structure

```
universal-mcp-hub/
├── src/
│   ├── server.ts              # Main MCP server [2] [5]
│   ├── normalizer/            # AI request normalizer [5] [7]
│   │   ├── ai-client.ts
│   │   └── request-parser.ts
│   ├── discovery/             # Registry search [3] [4]
│   │   ├── github-registry.ts [1]
│   │   ├── official-registry.ts [3]
│   │   └── cache-manager.ts
│   ├── installer/             # Auto-installation [1] [8]
│   │   ├── npm-installer.ts
│   │   ├── github-actions.ts [8]
│   │   └── config-generator.ts
│   ├── auth/                  # User credentials
│   │   ├── jwt-handler.ts
│   │   └── credential-store.ts
│   └── proxy/                 # MCP proxy layer [5] [6]
│       └── rpc-handler.ts
├── .github/
│   └── workflows/
│       └── auto-install.yml   # GitHub Actions [8]
├── servers/                   # Installed MCP servers
├── cache/                     # Metadata & indexes
├── configs/                   # Auto-generated configs
├── schema/
│   └── hub-schema.json        # MCP Hub schema [5] [6]
├── package.json
├── tsconfig.json
└── README.md
```

## 🔐 Security

- JWT-based authentication [1]
- Encrypted credential storage
- GitHub token scoping [8]
- Rate limiting on registry queries [3]
- Sandboxed tool execution [2] [5]

## 🌐 API Endpoints

### Standard MCP Protocol [5] [6]

```
POST /mcp/v1
Content-Type: application/json
Authorization: Bearer <token>
```

### Hub Management

```
GET  /api/servers          # List installed servers
POST /api/servers/install  # Manual install
GET  /api/cache            # View cache
POST /api/auth/register    # User registration
```

## 📊 Registry Integration [1] [3] [4]

### GitHub MCP Registry [1]
- API: https://mcp.run/api/v1/servers
- Search, filter, and install from GitHub's curated list

### Official MCP Registry [3]
- API: https://registry.modelcontextprotocol.io/api/servers
- Access community-contributed servers

## 🏷️ Label-Based Task Automation

Automate common development tasks by simply applying labels to issues and pull requests! The system supports AI-powered automation for:

- **`copilot:fix-issue`** - Automatically analyze and fix reported issues
- **`copilot:review-pr`** - Comprehensive automated PR review
- **`copilot:fix-code`** - Fix code issues and bugs
- **`copilot:merge-to-main`** - Safe automated merging after validation
- **`copilot:update-docs`** - Update documentation automatically
- **`copilot:security-scan`** - Security vulnerability scanning and fixes
- **`copilot:refactor`** - Code quality improvements
- **`copilot:add-tests`** - Generate test coverage
- **`copilot:optimize`** - Performance optimization
- **`copilot:deploy`** - Trigger deployment pipeline

📖 **Full Documentation**: See [Label Automation Guide](docs/LABEL_AUTOMATION.md) for detailed usage instructions.

**Quick Example**:
```
1. Create issue: "Bug: Login fails with empty email"
2. Add label: copilot:fix-issue
3. AI analyzes, implements fix, and creates PR
4. Review and merge! ✨
```

## 🤝 Contributing

1. Fork the repository [8]
2. Create feature branch
3. Add tests
4. Submit PR with registry source citations [1] [3]

## 📜 License

MIT License - See LICENSE file

## 🔗 Resources

- [MCP Specification](https://modelcontextprotocol.io/specification) [5] [6]
- [GitHub MCP Registry](https://github.com/mcp) [1]
- [Official Registry](https://github.com/modelcontextprotocol/registry) [3]
- [JSON-RPC 2.0 Spec](https://www.jsonrpc.org/specification) [5] [6]

---

**Built with ❤️ using GitHub as the universal platform** [8]
