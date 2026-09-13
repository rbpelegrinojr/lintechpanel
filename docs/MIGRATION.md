# VPS Migration

Version 0.1.0 has no automated account backup/restore. For an evaluation migration: stop API and worker; securely archive `/var/lib/lintech-panel`, `/etc/lintech-panel`, and any customer homes; record permissions and service configuration; install the same release on the new fresh Ubuntu host; restore state with original ownership; run the doctor; validate each domain; issue new/renewed TLS as necessary; lower DNS TTL; then cut DNS over and monitor.

A production migration must additionally preserve PostgreSQL/MariaDB logical dumps, application environment secrets, mailboxes and DKIM keys, Git deploy keys, backups, quotas/cgroups, cron jobs, logs as required, and system unit overrides. Test restore before DNS cutover and retain the old VPS offline until acceptance. Never copy live database files between running or incompatible servers.

