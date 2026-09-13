# Disaster Recovery

Maintain encrypted, versioned, off-host backups and regularly restore them into an isolated host. For panel-store corruption, stop writers, preserve the corrupt file, restore the latest verified snapshot, and reconcile audit/job events. For Nginx failure, restore the last valid site configuration and require `nginx -t` before reload. For failed updates, follow `UPGRADING.md`. For database, disk, accidental deletion, app, or TLS failure, isolate the affected service, preserve evidence, restore into staging, validate ownership and tenant boundaries, then return traffic gradually.

Recovery point and recovery time objectives must be selected by the operator. No recovery objective is guaranteed until restore drills and monitoring demonstrate it.

