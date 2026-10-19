# Multi-stage build for optimal image size
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install the locked dependency tree, including build tooling.
RUN npm ci --ignore-scripts

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

FROM builder AS verify
COPY eslint.config.js jest.config.js ./
COPY tests ./tests
COPY scripts ./scripts
COPY schema ./schema
COPY config ./config
RUN npm run typecheck && npm run lint && npm run validate && npm run test:ci

# Production stage
FROM node:22-alpine AS runtime

# Add metadata
LABEL maintainer="Universal Standards <support@universalstandards.dev>"
LABEL description="Universal MCP Hub - Self-expanding MCP server"
LABEL version="1.0.0"

# Set working directory
WORKDIR /app

# Install only runtime dependencies from the lockfile.
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy built application from builder
COPY --from=builder /app/dist ./dist

# Copy configuration files
COPY config ./config
COPY schema ./schema
COPY scripts ./scripts

# Create necessary directories with proper permissions
RUN mkdir -p cache servers configs && \
    chown node:node cache servers configs

# Switch to non-root user
USER node

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:3000/health/live > /dev/null || exit 1

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    MCP_ALLOWED_HOSTS=127.0.0.1:3000,localhost:3000 \
    MCP_AUTO_INSTALL=false

STOPSIGNAL SIGTERM

# Start server
CMD ["node", "dist/server.js"]
