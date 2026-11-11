FROM nginxinc/nginx-unprivileged:stable-alpine

COPY infra/status/nginx.conf.template /etc/nginx/templates/default.conf.template

ENV STATUS_PAGE_SLUG=status \
    NGINX_ENVSUBST_FILTER='^(STATUS_PAGE_SLUG)$' \
    NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/conf.d

USER root
RUN chown nginx:nginx /etc/nginx/conf.d
USER nginx

EXPOSE 8081

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD busybox wget -q -O - http://127.0.0.1:8081/healthz || exit 1
