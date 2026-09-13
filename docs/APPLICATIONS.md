# Application Hosting Guides

PHP, Laravel, CodeIgniter, Flask, Django, Node.js, React, and generic static hosting are architectural targets, not deployable features in 0.1.0. The API accepts deployment job records, but only the static runner has a minimal development success path and it does not yet publish files or configure Nginx. Do not treat a successful job record as a deployed application.

The planned safe flows use per-site PHP-FPM pools and Composer; per-app Python virtual environments plus Gunicorn; per-app controlled Node runtimes plus systemd; and build-output validation (`dist`, `build`, or explicit path) for React/static Nginx hosting. Customer dependencies never install globally, and all commands are fixed runners with validated arguments.

