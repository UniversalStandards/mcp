# Universal MCP Hub API Reference

## Table of Contents

- [MCP JSON-RPC Endpoints](#mcp-json-rpc-endpoints)
- [Health & Monitoring](#health--monitoring)
- [Administration](#administration)

---

## MCP JSON-RPC Endpoints

### POST /mcp/v1

Main endpoint for MCP JSON-RPC 2.0 requests.

**Request Format:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "github_search_repos",
    "arguments": {
      "query": "mcp server"
    }
  }
}
```

**Supported Methods:**

#### ping
Health check ping.

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "ping",
  "params": {}
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "status": "ok",
    "timestamp": 1234567890
  }
}
```

#### tools/list
List all available tools from installed MCP servers.

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list",
  "params": {}
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tools": [
      {
        "name": "github_search_repos",
        "description": "Search GitHub repositories",
        "server": "github-primary",
        "inputSchema": {
          "type": "object",
          "properties": {
            "query": { "type": "string" }
          }
        }
      }
    ]
  }
}
```

#### tools/call
Execute a specific tool.

```json
{
  "jsonrpc": "2.0",
  "id": 1,
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

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "tool": "github_search_repos",
    "server": "github-primary",
    "status": "would_execute",
    "params": {
      "query": "machine learning",
      "language": "python"
    }
  }
}
```

#### resources/list
List available resources.

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resources/list",
  "params": {}
}
```

#### resources/read
Read a specific resource.

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resources/read",
  "params": {
    "uri": "file:///path/to/file.txt"
  }
}
```

---

## Health & Monitoring

### GET /health

Comprehensive health check with individual component status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600000,
  "checks": [
    {
      "name": "filesystem",
      "status": "pass",
      "duration": 5
    },
    {
      "name": "memory",
      "status": "pass",
      "message": "Memory usage: 45.2%"
    },
    {
      "name": "cache",
      "status": "pass",
      "message": "150 entries cached"
    },
    {
      "name": "environment",
      "status": "warn",
      "message": "Missing optional variables: ENCRYPTION_KEY (using default)"
    }
  ]
}
```

**Status Codes:**
- `200` - Healthy or degraded
- `503` - Unhealthy

### GET /health/ready

Kubernetes-style readiness probe.

**Response:**
```json
{
  "ready": true
}
```

### GET /health/live

Kubernetes-style liveness probe.

**Response:**
```json
{
  "alive": true
}
```

### GET /metrics

Detailed metrics in JSON format.

**Response:**
```json
{
  "uptime": 3600000,
  "requests": {
    "total": 1250,
    "successful": 1200,
    "failed": 50,
    "avgDuration": 125.5,
    "byMethod": {
      "tools/call": {
        "count": 800,
        "sum": 95000,
        "min": 50,
        "max": 500,
        "avg": 118.75,
        "lastUpdate": 1234567890
      }
    }
  },
  "cache": {
    "hits": 450,
    "misses": 200,
    "hitRate": 0.692
  },
  "discovery": {
    "searches": 15,
    "installations": 5,
    "failures": 1
  },
  "memory": {
    "used": 125829120,
    "total": 268435456,
    "percentage": 46.875
  }
}
```

### GET /metrics/summary

Human-readable metrics summary.

**Response:**
```
Universal MCP Hub Metrics
========================
Uptime: 1h 0m 0s
Requests: 1250 (✓ 1200, ✗ 50)
Avg Duration: 125.50ms
Cache Hit Rate: 69.2%
Discoveries: 15 searches, 5 installs
Memory: 120.05MB / 256.00MB (46.9%)
```

---

## Administration

### GET /admin/cache/stats

Get cache statistics.

**Response:**
```json
{
  "entries": 150,
  "size": 524288,
  "oldestEntry": 1234567000,
  "newestEntry": 1234567890
}
```

### POST /admin/cache/clear

Clear cache entries.

**Request:**
```json
{
  "pattern": "github:.*"
}
```

**Response:**
```json
{
  "cleared": 45,
  "pattern": "github:.*"
}
```

---

## Error Responses

All errors follow JSON-RPC 2.0 error format:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32600,
    "message": "Invalid Request"
  }
}
```

**Error Codes:**
- `-32700` - Parse error
- `-32600` - Invalid Request
- `-32601` - Method not found
- `-32602` - Invalid params
- `-32603` - Internal error

---

## Rate Limiting

Currently not implemented. Planned for future release.

---

## Authentication

Currently not required. For production deployments, consider implementing:
- API key authentication via `Authorization` header
- JWT tokens
- IP whitelisting
- Rate limiting per client

---

## Examples

### Using curl

```bash
# Ping
curl -X POST http://localhost:3000/mcp/v1 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"ping","params":{}}'

# List tools
curl -X POST http://localhost:3000/mcp/v1 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# Health check
curl http://localhost:3000/health

# Metrics
curl http://localhost:3000/metrics
```

### Using Node.js

```javascript
const response = await fetch('http://localhost:3000/mcp/v1', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'tools/list',
    params: {}
  })
});

const data = await response.json();
console.log(data.result.tools);
```

### Using Python

```python
import requests

response = requests.post('http://localhost:3000/mcp/v1', json={
    'jsonrpc': '2.0',
    'id': 1,
    'method': 'tools/list',
    'params': {}
})

data = response.json()
print(data['result']['tools'])
```

---

## WebSocket Support

Not currently implemented. Planned for future release to enable:
- Real-time notifications
- Streaming responses
- Bidirectional communication
