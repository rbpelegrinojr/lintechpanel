BEGIN;
CREATE TYPE user_role AS ENUM ('super_admin', 'reseller', 'customer');
CREATE TYPE job_status AS ENUM ('queued', 'running', 'successful', 'failed', 'cancelled');
CREATE TABLE hosting_packages (id uuid PRIMARY KEY, name text UNIQUE NOT NULL, limits jsonb NOT NULL CHECK (jsonb_typeof(limits)='object'), created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE users (id uuid PRIMARY KEY, username varchar(32) UNIQUE NOT NULL CHECK (username ~ '^[a-z][a-z0-9_-]{2,31}$'), email text UNIQUE NOT NULL, password_hash text NOT NULL, role user_role NOT NULL, reseller_id uuid REFERENCES users(id), package_id uuid REFERENCES hosting_packages(id), suspended boolean NOT NULL DEFAULT false, must_change_password boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE sessions (id uuid PRIMARY KEY, user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE, token_hash char(64) UNIQUE NOT NULL, csrf_token_hash char(64) NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE domains (id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id), name text UNIQUE NOT NULL, kind text NOT NULL, enabled boolean NOT NULL DEFAULT true, ssl_status text NOT NULL DEFAULT 'pending', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE applications (id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id), domain_id uuid REFERENCES domains(id), kind text NOT NULL CHECK(kind IN ('php','python','node','react','static')), runtime text, settings jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE jobs (id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id), type text NOT NULL, status job_status NOT NULL DEFAULT 'queued', progress smallint NOT NULL DEFAULT 0 CHECK(progress BETWEEN 0 AND 100), input_encrypted bytea, safe_logs jsonb NOT NULL DEFAULT '[]', error text, idempotency_key text, created_at timestamptz NOT NULL DEFAULT now(), started_at timestamptz, completed_at timestamptz, UNIQUE(owner_id,idempotency_key));
CREATE TABLE audit_events (id uuid PRIMARY KEY, actor_id uuid REFERENCES users(id), action text NOT NULL, target text NOT NULL, result text NOT NULL, ip inet, metadata jsonb NOT NULL DEFAULT '{}', previous_hash char(64), event_hash char(64) NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE notifications (id uuid PRIMARY KEY, owner_id uuid NOT NULL REFERENCES users(id), kind text NOT NULL, title text NOT NULL, body text NOT NULL, read_at timestamptz, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX jobs_owner_status_idx ON jobs(owner_id,status); CREATE INDEX audit_actor_time_idx ON audit_events(actor_id,created_at DESC); CREATE INDEX domains_owner_idx ON domains(owner_id);
COMMIT;

