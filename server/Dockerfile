# ==============================================================================
# TravelSync Backend Dockerfile
# Multi-stage production build using Node.js 22 (Alpine Linux LTS)
# ==============================================================================

# ─── Stage 1: Build & Prisma Client Generation ─────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install OpenSSL for Prisma engine compatibility on Alpine
RUN apk add --no-cache openssl

# Install all dependencies (including devDependencies so prisma CLI is available)
COPY package*.json ./
RUN npm ci

# Copy Prisma schema and generate client
COPY prisma ./prisma
RUN npx prisma generate

# ─── Stage 2: Production Runner ────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Install OpenSSL for Prisma runtime on Alpine
RUN apk add --no-cache openssl

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only (using npm ci --omit=dev)
COPY package*.json ./
RUN npm ci --omit=dev

# Copy generated Prisma Client artifacts and schema from builder stage
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/prisma ./prisma

# Copy application source files
COPY . .

# NOTE ON UPLOADS & EPHEMERAL DISK:
# Container local filesystem is ephemeral; any uploads stored in ./uploads will be wiped
# on container restart, redeploy, or horizontal autoscaling.
# Production recommendations:
#   1. Mount a persistent volume: `docker run -v travelsync-uploads:/app/uploads ...`
#      or a Kubernetes PersistentVolumeClaim (PVC) mounted to /app/uploads.
#   2. Cloud Object Storage (AWS S3, Cloudflare R2, Google Cloud Storage) with signed URLs
#      or Cloudinary for automated optimization, resizing, and global CDN delivery.
RUN mkdir -p uploads && chown -R node:node /app

# Run as non-root user (built into node:*-alpine with UID 1000)
USER node

EXPOSE 3000

# Health check: queries /api/health and fails if HTTP status !== 200 or dbStatus !== 'connected'
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "\
    const http = require('http');\
    const req = http.get('http://localhost:3000/api/health', (res) => {\
      let body = '';\
      res.on('data', chunk => body += chunk);\
      res.on('end', () => {\
        try {\
          const data = JSON.parse(body);\
          if (res.statusCode !== 200 || data.dbStatus !== 'connected') process.exit(1);\
          process.exit(0);\
        } catch (_) { process.exit(1); }\
      });\
    });\
    req.on('error', () => process.exit(1));"

# Deploy pending database migrations and start server
CMD ["npm", "run", "start:prod"]
