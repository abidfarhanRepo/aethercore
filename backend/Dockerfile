# Backend Dockerfile - production-ready multi-stage build
FROM node:18-alpine3.18 AS builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++ curl

# Copy dependency files
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/
COPY scripts ./scripts/
COPY src ./src/

# Install dependencies (including dev for build)
RUN npm ci --legacy-peer-deps && \
    npm run build && \
    npx prisma generate --schema=./prisma/schema.prisma || true

# Runtime stage
FROM node:18-alpine3.18

WORKDIR /app

# Install runtime dependencies needed by Prisma and health checks
RUN apk add --no-cache dumb-init curl openssl1.1-compat && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files (only production dependencies)
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production --legacy-peer-deps && \
    npm cache clean --force

# Copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# Create required directories
RUN mkdir -p logs && \
    chown -R nodejs:nodejs /app

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Switch to non-root user
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Expose port
EXPOSE 3000

# Use dumb-init to properly handle signals
ENTRYPOINT ["dumb-init", "--"]

# Start application
CMD ["node", "dist/index.js"]
