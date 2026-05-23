# =============================================================================
# Sovereign Office — SSL Gateway
# nginx reverse proxy that terminates HTTPS on ports 3001-3005 and forwards
# each connection to the corresponding dashboard container on port 80.
# A self-signed certificate is generated on first start.
# Note: TRACE is proxied at /trace/ through the sovereign container (port 3001)
#       and does not require a separate gateway port.
# =============================================================================

FROM nginx:1.27-alpine

RUN apk add --no-cache openssl

COPY nginx.conf   /etc/nginx/nginx.conf
COPY entrypoint.sh /docker-entrypoint-ssl.sh
RUN chmod +x /docker-entrypoint-ssl.sh

EXPOSE 3001 3002 3003 3004 3005

ENTRYPOINT ["/docker-entrypoint-ssl.sh"]
