FROM node:26-alpine AS build

WORKDIR /app

# Copy workspace manifests first so dependency installation is cached across source edits.
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/admin-web/package.json ./apps/admin-web/package.json
COPY apps/user-web/package.json ./apps/user-web/package.json
COPY packages/shared/package.json ./packages/shared/package.json
COPY packages/ui/package.json ./packages/ui/package.json
RUN npm ci

COPY . .

ARG SENTRY_DSN_USER=
ARG SENTRY_DSN_ADMIN=
RUN if [ -n "$SENTRY_DSN_USER" ]; then \
      sed -i "s|sentryDsn: ''|sentryDsn: '${SENTRY_DSN_USER}'|" apps/user-web/src/environments/environment.production.ts; \
    fi && \
    if [ -n "$SENTRY_DSN_ADMIN" ]; then \
      sed -i "s|sentryDsn: ''|sentryDsn: '${SENTRY_DSN_ADMIN}'|" apps/admin-web/src/environments/environment.production.ts; \
    fi

RUN cd apps/user-web && npx ng build --configuration production && \
    cd ../admin-web && npx ng build --configuration production --base-href /console/

# Angular's critical-CSS helper injects an inline script to switch Beasties' stylesheet
# from media="print" to media="all". Keep CSP script-src 'self' by applying that
# media change in the generated HTML at build time and removing the inline helper.
RUN node --input-type=module <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs';

const activationScript = /<script>document\.querySelectorAll\('link\[data-beasties-media\]'\)\.forEach\(function\(l\)\{l\.media=l\.getAttribute\('data-beasties-media'\);l\.removeAttribute\('data-beasties-media'\)\}\)<\/script>/;
for (const app of ['user-web', 'admin-web']) {
  const indexPath = `/app/apps/${app}/dist/${app}/browser/index.html`;
  const html = readFileSync(indexPath, 'utf8');
  if (!activationScript.test(html)) {
    throw new Error(`Expected Angular critical-CSS activation script in ${indexPath}`);
  }
  const updated = html
    .replaceAll(' media="print" data-beasties-media="all"', '')
    .replace(activationScript, '');
  writeFileSync(indexPath, updated);
}
NODE

FROM nginxinc/nginx-unprivileged:stable-alpine AS runtime

COPY --from=build /app/apps/user-web/dist/user-web/browser /usr/share/nginx/html/user
COPY --from=build /app/apps/admin-web/dist/admin-web/browser /usr/share/nginx/html/console
COPY infra/web/nginx.conf /etc/nginx/templates/default.conf.template
COPY infra/web/security-headers.conf /etc/nginx/security-headers.conf
COPY infra/web/robots-header.conf /etc/nginx/robots-header.conf

ENV API_UPSTREAM=api:3000 PORT=8080
ENV NGINX_ENVSUBST_FILTER='^(PORT|API_UPSTREAM)$'
ENV NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/conf.d

USER root
RUN chown nginx:nginx /etc/nginx/conf.d
USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD sh -c 'busybox wget -q -O - "http://127.0.0.1:${PORT}/healthz" || exit 1'
