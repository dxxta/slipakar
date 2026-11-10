# ==========================================
# Stage 1: Dependencies
# ==========================================
FROM node:26-alpine AS deps

WORKDIR /app

# Copy root and workspace package files for layer caching
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci

# ==========================================
# Stage 2: Build
# ==========================================
FROM node:26-alpine AS build

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY package.json package-lock.json tsconfig.base.json tsconfig.json ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

# Generate Prisma Client and build packages/apps
RUN npx prisma generate --config apps/api/prisma.config.ts && \
    npm run build --workspace=@slipakar/shared && \
    npm run build --workspace=@slipakar/api

# ==========================================
# Stage 3: Runtime
# ==========================================
FROM node:26-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# Copy package manifests for production install
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/

# Install only production dependencies plus prisma CLI for migrate deploy
RUN npm ci --omit=dev && \
    npm install prisma@7.10.1 --save-exact

# Copy built artifacts and prisma assets
COPY --from=build /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY apps/api/docker-entrypoint.sh /app/apps/api/docker-entrypoint.sh

RUN chmod +x /app/apps/api/docker-entrypoint.sh && \
    chown -R node:node /app

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD busybox wget -q -O - http://127.0.0.1:3000/health || exit 1

ENTRYPOINT ["/app/apps/api/docker-entrypoint.sh"]
