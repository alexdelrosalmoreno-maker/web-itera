#!/bin/sh
set -eu

: "${N8N_BASE_URL:=}"
: "${N8N_CHAT_WEBHOOK_URL:=}"
: "${N8N_CONTACT_WEBHOOK_URL:=}"

cat > /usr/share/nginx/html/config.js <<EOF
window.ITERA_CONFIG = {
    n8nBaseUrl: '${N8N_BASE_URL}',
    chatWebhookUrl: '${N8N_CHAT_WEBHOOK_URL}',
    contactWebhookUrl: '${N8N_CONTACT_WEBHOOK_URL}'
};
EOF
