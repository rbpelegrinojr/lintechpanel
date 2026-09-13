#!/usr/bin/env bash
set -Eeuo pipefail
[[ ${EUID} -eq 0 ]] || { echo 'Run with sudo.' >&2; exit 1; }
SOURCE_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
install -d -m 0700 /var/backups/lintech-panel
tar -C /opt -czf "/var/backups/lintech-panel/pre-update-${STAMP}.tgz" lintech-panel
systemctl stop lintech-api lintech-worker
trap 'systemctl start lintech-api lintech-worker || true; echo "Update failed; restore the pre-update archive documented in docs/UPGRADING.md" >&2' ERR
cp -a "$SOURCE_DIR"/. /opt/lintech-panel/
chown -R root:root /opt/lintech-panel
systemctl daemon-reload; systemctl start lintech-api lintech-worker; LINTECH_URL=http://127.0.0.1:8080 node /opt/lintech-panel/scripts/doctor.js
echo 'Update completed.'

