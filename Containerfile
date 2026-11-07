# ==========================================
# Stage 1: Build Application Bundle
# ==========================================
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Install dependencies with lockfile enforcement
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source code and build production bundle
COPY tsconfig.json ./
COPY src/ ./src/
RUN bun run build

# ==========================================
# Stage 2: Production Runtime
# ==========================================
FROM oven/bun:1-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install production dependencies only
COPY package.json bun.lock ./
RUN bun install --production --frozen-lockfile

# Copy compiled bundle from builder stage
COPY --from=builder /app/dist ./dist

# Copy database migration files, seeder, and entrypoint
COPY src/db/ ./src/db/
COPY docker-entrypoint.sh ./

# Enforce non-root execution for container security
RUN chown -R bun:bun /app && chmod +x ./docker-entrypoint.sh

USER bun

EXPOSE 3000

ENTRYPOINT ["./docker-entrypoint.sh"]
