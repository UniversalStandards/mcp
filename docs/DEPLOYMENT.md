# Deployment Guide

This guide covers various deployment options for the Universal MCP Hub.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [Kubernetes Deployment](#kubernetes-deployment)
- [Cloud Platforms](#cloud-platforms)
- [Production Checklist](#production-checklist)

---

## Prerequisites

- **Node.js** 18+ installed
- **npm** or **yarn** package manager
- **GitHub account** with Personal Access Token
- **AI Provider API key** (OpenAI, Anthropic, etc.)

---

## Local Development

### 1. Clone and Install

```bash
git clone https://github.com/UniversalStandards/mcp.git
cd mcp
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
PORT=3000
NODE_ENV=development

GITHUB_TOKEN=ghp_your_token
GITHUB_OWNER=YourUsername
GITHUB_REPO=mcp

AI_PROVIDER=openai
AI_API_KEY=sk-your_key
AI_MODEL=gpt-4o-mini

ENCRYPTION_KEY=your-32-char-encryption-key-here
JWT_SECRET=your-jwt-secret-at-least-32-chars
```

### 3. Build and Run

```bash
npm run build
npm start
```

For development with hot reload:

```bash
npm run dev
```

### 4. Verify

```bash
curl http://localhost:3000/health
```

---

## Docker Deployment

### 1. Create Dockerfile

Already included in the repository.

### 2. Build Image

```bash
docker build -t universal-mcp-hub:latest .
```

### 3. Run Container

```bash
docker run -d \
  --name mcp-hub \
  -p 3000:3000 \
  -e GITHUB_TOKEN=ghp_your_token \
  -e AI_API_KEY=sk-your_key \
  -e AI_PROVIDER=openai \
  -e NODE_ENV=production \
  -v $(pwd)/cache:/app/cache \
  -v $(pwd)/servers:/app/servers \
  universal-mcp-hub:latest
```

### 4. Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  mcp-hub:
    build: .
    image: universal-mcp-hub:latest
    container_name: mcp-hub
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - GITHUB_TOKEN=${GITHUB_TOKEN}
      - AI_API_KEY=${AI_API_KEY}
      - AI_PROVIDER=openai
      - ENCRYPTION_KEY=${ENCRYPTION_KEY}
      - JWT_SECRET=${JWT_SECRET}
    volumes:
      - ./cache:/app/cache
      - ./servers:/app/servers
      - ./config:/app/config
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

Run with:

```bash
docker-compose up -d
```

---

## Kubernetes Deployment

### 1. Create Secret

```bash
kubectl create secret generic mcp-hub-secrets \
  --from-literal=github-token=ghp_your_token \
  --from-literal=ai-api-key=sk-your_key \
  --from-literal=encryption-key=your-encryption-key \
  --from-literal=jwt-secret=your-jwt-secret
```

### 2. Create Deployment

`k8s/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-hub
  labels:
    app: mcp-hub
spec:
  replicas: 3
  selector:
    matchLabels:
      app: mcp-hub
  template:
    metadata:
      labels:
        app: mcp-hub
    spec:
      containers:
      - name: mcp-hub
        image: universal-mcp-hub:latest
        ports:
        - containerPort: 3000
          name: http
        env:
        - name: NODE_ENV
          value: "production"
        - name: PORT
          value: "3000"
        - name: GITHUB_TOKEN
          valueFrom:
            secretKeyRef:
              name: mcp-hub-secrets
              key: github-token
        - name: AI_API_KEY
          valueFrom:
            secretKeyRef:
              name: mcp-hub-secrets
              key: ai-api-key
        - name: ENCRYPTION_KEY
          valueFrom:
            secretKeyRef:
              name: mcp-hub-secrets
              key: encryption-key
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: mcp-hub-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health/live
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
        volumeMounts:
        - name: cache
          mountPath: /app/cache
        - name: servers
          mountPath: /app/servers
      volumes:
      - name: cache
        emptyDir: {}
      - name: servers
        emptyDir: {}
```

### 3. Create Service

`k8s/service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: mcp-hub
spec:
  selector:
    app: mcp-hub
  ports:
  - port: 80
    targetPort: 3000
    name: http
  type: LoadBalancer
```

### 4. Create Ingress

`k8s/ingress.yaml`:

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mcp-hub
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
  - hosts:
    - mcp-hub.yourdomain.com
    secretName: mcp-hub-tls
  rules:
  - host: mcp-hub.yourdomain.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: mcp-hub
            port:
              number: 80
```

### 5. Apply Configuration

```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

---

## Cloud Platforms

### AWS ECS

1. Create ECR repository
2. Push Docker image
3. Create ECS task definition
4. Create ECS service

### Google Cloud Run

```bash
gcloud run deploy mcp-hub \
  --image gcr.io/your-project/universal-mcp-hub \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GITHUB_TOKEN=...,AI_API_KEY=...
```

### Azure Container Instances

```bash
az container create \
  --resource-group mcp-hub-rg \
  --name mcp-hub \
  --image universal-mcp-hub:latest \
  --dns-name-label mcp-hub \
  --ports 3000 \
  --environment-variables \
    GITHUB_TOKEN=... \
    AI_API_KEY=...
```

### Heroku

```bash
heroku create mcp-hub
heroku config:set GITHUB_TOKEN=...
heroku config:set AI_API_KEY=...
git push heroku main
```

---

## Production Checklist

### Security

- [ ] Set strong `ENCRYPTION_KEY` (32+ characters)
- [ ] Set strong `JWT_SECRET` (32+ characters)
- [ ] Use environment-specific API keys
- [ ] Enable HTTPS/TLS
- [ ] Configure firewall rules
- [ ] Set up VPC/network isolation
- [ ] Implement rate limiting
- [ ] Add authentication middleware
- [ ] Regular security audits
- [ ] Keep dependencies updated

### Performance

- [ ] Enable caching
- [ ] Configure cache TTL appropriately
- [ ] Set up CDN for static assets
- [ ] Configure horizontal scaling
- [ ] Implement connection pooling
- [ ] Monitor resource usage
- [ ] Set appropriate resource limits

### Monitoring

- [ ] Set up log aggregation (e.g., ELK, Datadog)
- [ ] Configure APM (Application Performance Monitoring)
- [ ] Set up alerting for errors
- [ ] Monitor health endpoints
- [ ] Track metrics over time
- [ ] Set up uptime monitoring

### Backup & Recovery

- [ ] Backup cache directory regularly
- [ ] Backup configuration files
- [ ] Document recovery procedures
- [ ] Test backup restoration
- [ ] Set up automated backups

### Documentation

- [ ] Document deployment process
- [ ] Create runbooks for common issues
- [ ] Document API endpoints
- [ ] Maintain change log
- [ ] Document environment variables

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3000` | Server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `HOST` | No | `0.0.0.0` | Server host |
| `GITHUB_TOKEN` | Yes | - | GitHub Personal Access Token |
| `GITHUB_OWNER` | No | - | GitHub username/org |
| `GITHUB_REPO` | No | `mcp` | Repository name |
| `AI_PROVIDER` | No | `openai` | AI provider (openai, anthropic) |
| `AI_API_KEY` | Yes | - | AI provider API key |
| `AI_MODEL` | No | `gpt-4o-mini` | AI model to use |
| `ENCRYPTION_KEY` | No | (insecure default) | 32+ char encryption key |
| `JWT_SECRET` | No | (insecure default) | JWT signing secret |
| `CACHE_DIR` | No | `./cache` | Cache directory path |
| `WORKSPACE_PATH` | No | `.` | Workspace path |

---

## Troubleshooting

### Server Won't Start

```bash
# Check logs
docker logs mcp-hub

# Verify environment variables
docker exec mcp-hub env | grep -E "GITHUB|AI"

# Check port availability
netstat -an | grep 3000
```

### High Memory Usage

```bash
# Monitor memory
curl http://localhost:3000/metrics | jq '.memory'

# Clear cache
curl -X POST http://localhost:3000/admin/cache/clear
```

### Connection Refused

```bash
# Check if service is running
curl http://localhost:3000/health/live

# Check network policies
kubectl get networkpolicies
```

---

## Scaling

### Horizontal Scaling

For Kubernetes:

```bash
kubectl scale deployment mcp-hub --replicas=5
```

For Docker Swarm:

```bash
docker service scale mcp-hub=5
```

### Vertical Scaling

Adjust resource limits in your deployment configuration.

---

## Support

For deployment issues:
- GitHub Issues: https://github.com/UniversalStandards/mcp/issues
- Discussions: https://github.com/UniversalStandards/mcp/discussions
- Email: support@universalstandards.dev
