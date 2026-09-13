# Application Hosting Guides

Static document-root and PHP 8.3 site provisioning are implemented through validated worker/agent operations. PHP sites receive a per-site PHP-FPM pool, fixed safe limits, Nginx FastCGI routing, and retain an active generated TLS configuration. The application UI supports generic PHP, Laravel, and CodeIgniter metadata plus create/remove; it does not yet upload projects, run Composer, manage `.env`, execute framework commands, or prove a real framework deployment on Ubuntu.

Flask, Django, Node.js, and React remain architectural targets. Never treat a queued job as deployed: only a `successful` job and `active` application record indicate that the agent completed its validation path, and the current Linux provisioners still require external Ubuntu testing.

The planned safe flows use per-site PHP-FPM pools and Composer; per-app Python virtual environments plus Gunicorn; per-app controlled Node runtimes plus systemd; and build-output validation (`dist`, `build`, or explicit path) for React/static Nginx hosting. Customer dependencies never install globally, and all commands are fixed runners with validated arguments.
