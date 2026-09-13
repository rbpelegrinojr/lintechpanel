# Administrator Guide

The current dashboard reports domains and jobs. The API can create users, suspend/unsuspend managed accounts, create tenant-owned domains, and enqueue allowlisted job types. Confirm destructive changes out of band because the v0.1 UI does not yet present management dialogs. Inspect audit data only on the protected host; no audit UI exists. Use `scripts/doctor.js`, systemd status, journald, and Nginx logs for health. Never edit the development JSON store while services are running.

