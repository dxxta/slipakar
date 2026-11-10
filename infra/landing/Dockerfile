FROM node:26-alpine AS build

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/admin-web/package.json apps/admin-web/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/landing-web/package.json apps/landing-web/package.json
COPY apps/user-web/package.json apps/user-web/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/ui/package.json packages/ui/package.json

RUN npm ci

COPY . .
RUN npm run build --workspace=@slipakar/landing-web

FROM node:26-alpine AS runtime

ENV NODE_ENV=production
ENV PORT=8082
WORKDIR /app

COPY --from=build --chown=node:node /workspace/apps/landing-web/dist/landing-web ./dist/landing-web

USER node
EXPOSE 8082
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD busybox wget -q -O - http://127.0.0.1:8082/healthz || exit 1
CMD ["node", "dist/landing-web/server/server.mjs"]
