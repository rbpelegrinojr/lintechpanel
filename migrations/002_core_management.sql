BEGIN;
ALTER TABLE hosting_packages ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE users ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
COMMIT;
