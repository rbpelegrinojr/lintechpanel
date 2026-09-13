# Application Hosting Guides

Static document-root and PHP 8.3 site provisioning are implemented through validated worker/agent operations. PHP sites receive a per-site PHP-FPM pool, fixed safe limits, Nginx FastCGI routing, and retain an active generated TLS configuration. The application UI supports generic PHP, Laravel, and CodeIgniter metadata plus create/remove; it does not yet upload projects, run Composer, manage `.env`, execute framework commands, or prove a real framework deployment on Ubuntu.

Python 3.12 provisioning supports Flask, Django, and generic WSGI starter applications. Each application receives its own virtual environment, fixed Gunicorn systemd unit, Unix socket, Nginx reverse proxy, resource ceilings derived from the hosting package, lifecycle controls, and a post-start Unix-socket HTTP health check. Project upload/Git deployment, requirements/pyproject ingestion, environment-variable storage, deployment history, logs UI, and live Flask/Django validation remain outstanding.

Node.js 18 provisioning supports validated relative JavaScript entrypoints, lockfile-aware `npm ci` (or `npm install`), an optional fixed `npm run build --if-present` step, hardened systemd supervision, Unix-socket Nginx/WebSocket proxying, lifecycle controls, and a generated dependency-free starter when no project exists. Arbitrary startup/build command strings are intentionally not accepted. Multiple Node versions, environment variables, Git/upload deployment history, and live Ubuntu validation remain outstanding.

React remains an architectural target. Never treat a queued job as deployed: only a `successful` job and `active` application record indicate that the agent completed its validation path, and the current Linux provisioners still require external Ubuntu testing.

The planned safe flows use per-site PHP-FPM pools and Composer; per-app Python virtual environments plus Gunicorn; per-app controlled Node runtimes plus systemd; and build-output validation (`dist`, `build`, or explicit path) for React/static Nginx hosting. Customer dependencies never install globally, and all commands are fixed runners with validated arguments.
