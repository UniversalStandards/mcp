# Multi-stage build for optimal image size
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production && \
    npm cache clean --force

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm install -D typescript && \
    npm run build && \
    npm uninstall typescript

# Production stage
FROM node:18-alpine

# Add metadata
LABEL maintainer="Universal Standards <support@universalstandards.dev>"
LABEL description="Universal MCP Hub - Self-expanding MCP server"
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
