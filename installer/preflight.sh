#!/usr/bin/env bash
set -Eeuo pipefail

fail(){ printf 'PRECHECK FAILED: %s\n' "$1" >&2; exit 1; }
[[ ${EUID} -eq 0 ]] || fail 'run as root (sudo)'
[[ -r /etc/os-release ]] || fail 'cannot identify operating system'
. /etc/os-release
[[ ${ID} == ubuntu && ${VERSION_ID} == 24.04 ]] || fail 'Ubuntu 24.04 LTS is required'
[[ $(uname -m) == x86_64 ]] || fail 'x86_64 is required in this release'

for marker in /usr/local/hestia /usr/local/CyberCP /usr/local/directadmin /usr/local/cpanel /etc/psa /www/server/panel; do
  [[ ! -e ${marker} ]] || fail "another hosting panel was detected at ${marker}; no changes were made"
done

ram_kib=$(awk '/MemTotal/{print $2}' /proc/meminfo)
disk_kib=$(df -Pk /opt | awk 'NR==2{print $4}')
(( ram_kib >= 3500000 )) || fail 'at least 4 GB RAM is required'
(( disk_kib >= 20000000 )) || fail 'at least 20 GB free under /opt is required (40 GB total recommended)'
command -v systemctl >/dev/null || fail 'systemd is required'
printf 'Preflight checks passed. Existing web/database services still require administrator review.\n'

