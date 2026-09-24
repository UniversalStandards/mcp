# Multi-stage build for optimal image size
FROM node:22-alpine AS dependencies

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install build and runtime dependencies from the lockfile.
RUN npm ci

FROM dependencies AS verify
COPY src ./src
COPY tests ./tests
COPY config ./config
COPY schema ./schema
COPY scripts ./scripts
COPY jest.config.js eslint.config.js ./
RUN npm run build && npm run lint && npm run validate && npm test -- --runInBand

FROM dependencies AS builder
# Copy source code
COPY src ./src

# Build TypeScript and remove development-only packages before copying the
# dependency tree into the production image.
RUN npm run build && \
    npm prune --omit=dev && \
    npm cache clean --force

# Production stage
FROM node:22-alpine

# Add metadata
LABEL maintainer="Universal Standards <support@universalstandards.dev>"
LABEL description="Universal Standards local MCP catalog and control plane"
LABEL version="1.0.0"

# Install curl for health checks
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Set working directory
WORKDIR /app

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Copy configuration files
COPY config ./config
COPY schema ./schema
COPY scripts ./scripts

# Create necessary directories with proper permissions
RUN mkdir -p cache servers configs && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Start server
CMD ["node", "dist/server.js"]
