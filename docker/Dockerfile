FROM node:20-alpine AS builder

RUN apk add --no-cache python3 make g++ && npm install -g pnpm

WORKDIR /app

# Copy generic config and pnpm workspace configuration
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
# Copy package sources
COPY packages/core ./packages/core
COPY packages/api ./packages/api
COPY packages/dashboard ./packages/dashboard
COPY tsconfig.base.json ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build everything
RUN pnpm build

FROM node:20-alpine AS production

RUN apk add --no-cache curl python3 make g++ && npm install -g pnpm

WORKDIR /app

# Copy build artifacts and dependencies
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./

COPY --from=builder /app/packages/core/package.json ./packages/core/package.json
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/api/package.json ./packages/api/package.json
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/dashboard/package.json ./packages/dashboard/package.json
COPY --from=builder /app/packages/dashboard/dist ./packages/dashboard/dist

# Install only production dependencies
RUN pnpm install --frozen-lockfile --prod

# Add a healthcheck
HEALTHCHECK --interval=30s --timeout=3s \
  CMD curl -f http://localhost:${PORT:-3000}/health || exit 1

EXPOSE 8080

# CMD should start the API server by default
CMD ["pnpm", "--filter", "api", "start"]
