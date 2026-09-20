# syntax=docker/dockerfile:1

# ============================================
# BUILD STAGE
# ============================================
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Build shared package first
RUN pnpm --filter @valletcontrol/shared build

# Build API
RUN pnpm --filter @valletcontrol/api build

# ============================================
# PRODUCTION STAGE
# ============================================
FROM node:22-alpine AS runner

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install production dependencies only
RUN pnpm install --frozen-lockfile --prod

# Copy built files
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001
USER nestjs

EXPOSE 3001

ENV NODE_ENV=production
ENV API_PORT=3001

CMD ["sh", "-c", "cd /app/apps/api && pnpm prisma:migrate deploy && node dist/main.js"]