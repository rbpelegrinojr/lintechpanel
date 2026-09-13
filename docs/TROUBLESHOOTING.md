# Troubleshooting

- API unavailable: `systemctl status lintech-api`, then `journalctl -u lintech-api`; verify port 8080 is loopback-only.
- Worker jobs remain queued: check `lintech-worker`; only `deploy_static` has a development runner and other job types fail explicitly.
- Agent unavailable: inspect socket ownership at `/run/lintech-panel/agent.sock`, secret permissions, and agent journal. Never weaken socket permissions to fix access.
- Nginx failure: run `sudo nginx -t`; do not reload until it passes.
- Login failures: verify the account is not suspended and wait 15 minutes after five failures. Do not edit hashes manually.
- Installer refusal: resolve the reported OS/resource/panel conflict; do not bypass a detected existing control panel.

