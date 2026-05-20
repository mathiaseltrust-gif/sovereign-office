#!/bin/sh
set -e

SSL_DIR=/etc/nginx/ssl

mkdir -p "$SSL_DIR"

# Always regenerate so SAN is included (required by iOS 13+)
echo "==> Generating self-signed TLS certificate with SAN..."
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout "$SSL_DIR/selfsigned.key" \
  -out    "$SSL_DIR/selfsigned.crt" \
  -subj   "/C=US/ST=State/L=City/O=SovereignOffice/CN=${SERVER_IP:-20.83.210.26}" \
  -addext "subjectAltName=IP:${SERVER_IP:-20.83.210.26}"
echo "==> Certificate generated (CN + SAN = IP:${SERVER_IP:-20.83.210.26})."

exec nginx -g 'daemon off;'
