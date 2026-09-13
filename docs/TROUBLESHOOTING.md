# Troubleshooting

- API unavailable: `systemctl status lintech-api`, then `journalctl -u lintech-api`; verify port 8080 is loopback-only. The installer health check retries for 15 seconds and prints the underlying network error plus recent service status if it still fails.
- Worker jobs remain queued: check `lintech-worker` and `lintech-agent`, then inspect the job's Details column. Resource operations are queued from their own management screens; the generic manual job form was removed.
- Failed `provision_user` or dependent `create_domain`: upgrade and rerun the installer so the corrected agent sandbox is active, then use **Jobs → Retry** on `provision_user` first and `create_domain` second. Retries are owner/administrator authorized and capped at five attempts.
- Agent unavailable: inspect socket ownership at `/run/lintech-panel/agent.sock`, secret permissions, and agent journal. Never weaken socket permissions to fix access.
- Nginx failure: run `sudo nginx -t`; do not reload until it passes.
- Login failures: verify the account is not suspended and wait 15 minutes after five failures. Do not edit hashes manually.
- Installer refusal: resolve the reported OS/resource/panel conflict; do not bypass a detected existing control panel.
