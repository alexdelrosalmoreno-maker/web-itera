FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY docker-entrypoint.d/ /docker-entrypoint.d/

WORKDIR /usr/share/nginx/html
COPY index.html privacidad.html style.css script.js globe.png config.js config.template.js ./

RUN chmod +x /docker-entrypoint.d/10-generate-config.sh

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1/healthz || exit 1
