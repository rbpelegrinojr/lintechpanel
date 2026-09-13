# Upgrading

Commit or otherwise verify the release source, read `CHANGELOG.md`, take an off-host data backup, and test the release on a clone. Then run `sudo bash installer/update.sh` from the checked-out release. It creates `/var/backups/lintech-panel/pre-update-TIMESTAMP.tgz`, stops API/worker, copies code, restarts services, and runs the health check.

The current updater backs up application code only, not `/var/lib` state or `/etc` secrets, and has no migration runner. Before any future data migration, copy those directories securely. On failure, inspect the logs, stop services, extract the pre-update archive back under `/opt`, restore separately captured state/configuration if changed, reload units, and rerun the doctor. Never overwrite customer homes during an update.

