#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
LOG_DIR=/var/log/lintech-panel
APP_DIR=/opt/lintech-panel
CONFIG_DIR=/etc/lintech-panel
DATA_DIR=/var/lib/lintech-panel
HOSTNAME_VALUE=''
ADMIN_EMAIL=''
ADMIN_USER=''
NON_INTERACTIVE=0

while (($#)); do
  case "$1" in
    --hostname) HOSTNAME_VALUE=${2:?}; shift 2;; --admin-email) ADMIN_EMAIL=${2:?}; shift 2;;
    --admin-user) ADMIN_USER=${2:?}; shift 2;; --non-interactive) NON_INTERACTIVE=1; shift;;
    *) printf 'Unknown option: %s\n' "$1" >&2; exit 2;;
  esac
done
[[ ${EUID} -eq 0 ]] || { printf 'Run with sudo.\n' >&2; exit 1; }
mkdir -p "$LOG_DIR"; chmod 750 "$LOG_DIR"; exec > >(tee -a "$LOG_DIR/install.log") 2>&1
on_error() {
  code=$?
  line=${1:-unknown}
  printf 'Installation failed at line %s (exit %s). Review %s/install.log; customer data was not removed.\n' "$line" "$code" "$LOG_DIR" >&2
  if command -v systemctl >/dev/null 2>&1; then
    systemctl --no-pager --full status lintech-api lintech-worker lintech-agent nginx 2>&1 || true
    journalctl --no-pager -n 50 -u lintech-api -u lintech-worker -u lintech-agent 2>&1 || true
  fi
  exit "$code"
}
trap 'on_error "$LINENO"' ERR

step(){ printf '\n[%s/12] %s\n' "$1" "$2"; }
step 1 'Checking operating system and conflicts'; "$ROOT_DIR/installer/preflight.sh"
if (( ! NON_INTERACTIVE )); then
  [[ -n $HOSTNAME_VALUE ]] || read -r -p 'Panel hostname: ' HOSTNAME_VALUE
  [[ -n $ADMIN_EMAIL ]] || read -r -p 'Administrator email: ' ADMIN_EMAIL
  [[ -n $ADMIN_USER ]] || read -r -p 'Administrator username: ' ADMIN_USER
fi
[[ $HOSTNAME_VALUE =~ ^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[A-Za-z]{2,63}$ ]] || { echo 'Invalid hostname' >&2; exit 2; }
[[ $ADMIN_EMAIL == *@*.* ]] || { echo 'Invalid administrator email' >&2; exit 2; }
[[ $ADMIN_USER =~ ^[a-z][a-z0-9_-]{2,31}$ ]] || { echo 'Invalid administrator username' >&2; exit 2; }

step 2 'Installing required packages'; apt-get update; DEBIAN_FRONTEND=noninteractive apt-get install -y nginx nodejs openssl ca-certificates curl git ufw fail2ban certbot php8.3-cli php8.3-fpm php8.3-common composer python3 python3-venv
node_major=$(node -p 'Number(process.versions.node.split(".")[0])'); (( node_major >= 18 )) || { echo 'Node.js 18+ is required; install a supported Node.js LTS and retry.' >&2; exit 1; }
step 3 'Creating service accounts and directories'; systemctl stop lintech-worker lintech-api lintech-agent 2>/dev/null || true; id lintech >/dev/null 2>&1 || useradd --system --home "$DATA_DIR" --shell /usr/sbin/nologin lintech; touch /etc/.pwd.lock /etc/subuid /etc/subgid; chown root:root /etc/.pwd.lock /etc/subuid /etc/subgid; chmod 0600 /etc/.pwd.lock; install -d -o lintech -g lintech -m 0750 "$DATA_DIR" "$DATA_DIR/customers"; install -d -o root -g lintech -m 0750 "$CONFIG_DIR" /run/lintech-panel
step 4 'Installing application files'; mkdir -p "$APP_DIR"; cp -a "$ROOT_DIR"/. "$APP_DIR"/; chown -R root:root "$APP_DIR"; chmod -R o-w "$APP_DIR"
step 5 'Creating secrets'; if [[ ! -s "$CONFIG_DIR/agent.secret" ]]; then openssl rand -base64 48 > "$CONFIG_DIR/agent.secret"; fi; chown root:lintech "$CONFIG_DIR/agent.secret"; chmod 0640 "$CONFIG_DIR/agent.secret"; printf 'LINTECH_DATA_FILE=%s/panel.json\nLINTECH_HOST=127.0.0.1\nLINTECH_PORT=8080\nLINTECH_ACME_EMAIL=%s\n' "$DATA_DIR" "$ADMIN_EMAIL" > "$CONFIG_DIR/panel.env"; chown root:lintech "$CONFIG_DIR/panel.env"; chmod 0640 "$CONFIG_DIR/panel.env"
step 6 'Creating initial administrator'; if [[ -z ${LINTECH_ADMIN_PASSWORD:-} ]]; then read -r -s -p 'Initial administrator password (preserved if an admin already exists): ' LINTECH_ADMIN_PASSWORD; printf '\n'; fi; export LINTECH_ADMIN_PASSWORD LINTECH_DATA_FILE="$DATA_DIR/panel.json"; runuser -u lintech --preserve-environment -- node "$APP_DIR/scripts/bootstrap-admin.js" --if-missing "$ADMIN_USER" "$ADMIN_EMAIL"; unset LINTECH_ADMIN_PASSWORD
step 7 'Installing systemd services'; install -m 0644 "$APP_DIR/deployment/systemd/lintech-api.service" /etc/systemd/system/; install -m 0644 "$APP_DIR/deployment/systemd/lintech-worker.service" /etc/systemd/system/; install -m 0644 "$APP_DIR/deployment/systemd/lintech-agent.service" /etc/systemd/system/; systemctl daemon-reload
step 8 'Configuring Nginx'; if [[ ! -e /etc/nginx/sites-available/lintech-panel ]]; then sed "s/__PANEL_HOST__/${HOSTNAME_VALUE}/g" "$APP_DIR/deployment/nginx/panel.conf" > /etc/nginx/sites-available/lintech-panel; else echo 'Preserving existing LinTech Nginx configuration (including operator-managed TLS).'; fi; ln -sfn /etc/nginx/sites-available/lintech-panel /etc/nginx/sites-enabled/lintech-panel; install -d -m 0755 /etc/letsencrypt/renewal-hooks/deploy; install -m 0755 "$APP_DIR/deployment/certbot/reload-nginx.sh" /etc/letsencrypt/renewal-hooks/deploy/lintech-nginx-reload; nginx -t
step 9 'Configuring firewall and brute-force protection'; ufw allow OpenSSH; ufw allow 'Nginx Full'; ufw --force enable; systemctl enable --now fail2ban
step 10 'Starting services'; systemctl enable lintech-api lintech-worker lintech-agent; systemctl restart lintech-api lintech-worker lintech-agent; systemctl reload nginx; for service in lintech-api lintech-worker lintech-agent nginx; do systemctl is-active --quiet "$service" || { systemctl --no-pager --full status "$service" || true; exit 1; }; done
step 11 'Running health checks'; LINTECH_URL=http://127.0.0.1:8080 node "$APP_DIR/scripts/doctor.js"
step 12 'Installation complete'; printf 'Panel HTTP endpoint: http://%s (issue TLS before production login)\nConfiguration: %s\nApplication: %s\nLogs: %s\n' "$HOSTNAME_VALUE" "$CONFIG_DIR" "$APP_DIR" "$LOG_DIR"
