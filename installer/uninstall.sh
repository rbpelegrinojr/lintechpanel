#!/usr/bin/env bash
set -Eeuo pipefail
[[ ${EUID} -eq 0 ]] || { echo 'Run with sudo.' >&2; exit 1; }
mode=${1:---safe}
[[ $mode == --safe || $mode == --destroy-data ]] || { echo 'Usage: uninstall.sh [--safe|--destroy-data]' >&2; exit 2; }
systemctl disable --now lintech-api lintech-worker lintech-agent 2>/dev/null || true
rm -f /etc/systemd/system/lintech-{api,worker,agent}.service /etc/nginx/sites-enabled/lintech-panel /etc/nginx/sites-available/lintech-panel
systemctl daemon-reload; nginx -t && systemctl reload nginx || true
rm -rf -- /opt/lintech-panel
if [[ $mode == --destroy-data ]]; then
  read -r -p 'Type DELETE ALL LINTECH DATA to continue: ' answer
  [[ $answer == 'DELETE ALL LINTECH DATA' ]] || { echo 'Data deletion cancelled.'; exit 1; }
  rm -rf -- /var/lib/lintech-panel /etc/lintech-panel /var/log/lintech-panel /var/backups/lintech-panel
else
  echo 'Safe removal complete. Data and configuration were preserved.'
fi

