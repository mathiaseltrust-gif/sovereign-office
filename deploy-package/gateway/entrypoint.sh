#!/bin/sh
set -e

SSL_DIR=/etc/nginx/ssl

mkdir -p "$SSL_DIR"

if [ ! -f "$SSL_DIR/selfsigned.crt" ]; then
  echo "==> Generating self-signed TLS certificate..."
  openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout "$SSL_DIR/selfsigned.key" \
    -out    "$SSL_DIR/selfsigned.crt" \
    -subj   "/C=US/ST=State/L=City/O=SovereignOffice/CN=${SERVER_IP:-20.83.210.26}"
  echo "==> Certificate generated."
fi

exec nginx -g 'daemon off;'
