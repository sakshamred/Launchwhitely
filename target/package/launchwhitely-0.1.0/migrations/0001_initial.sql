-- LaunchWhitely initial schema

CREATE TABLE IF NOT EXISTS environments (
    key         TEXT PRIMARY KEY NOT NULL,
    name        TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS flags (
    key         TEXT PRIMARY KEY NOT NULL,
    kind        TEXT NOT NULL CHECK (kind IN ('bool', 'string', 'number', 'json')),
    variations  TEXT NOT NULL,  -- JSON array of variation values
    description TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS flag_configs (
    flag_key      TEXT NOT NULL REFERENCES flags(key) ON DELETE CASCADE,
    env_key       TEXT NOT NULL REFERENCES environments(key) ON DELETE CASCADE,
    enabled       INTEGER NOT NULL DEFAULT 1,
    targets       TEXT NOT NULL DEFAULT '{}',       -- JSON object: context_key -> variation_index
    rules         TEXT NOT NULL DEFAULT '[]',        -- JSON array of Rule objects
    fallthrough   TEXT NOT NULL DEFAULT '0',         -- JSON: number or [{variation,weight}]
    off_variation INTEGER NOT NULL DEFAULT 0,
    salt          TEXT NOT NULL,
    updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    PRIMARY KEY (flag_key, env_key)
);

CREATE TABLE IF NOT EXISTS segments (
    key        TEXT NOT NULL,
    env_key    TEXT NOT NULL REFERENCES environments(key) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    included   TEXT NOT NULL DEFAULT '[]',  -- JSON array of context keys
    excluded   TEXT NOT NULL DEFAULT '[]',  -- JSON array of context keys
    clauses    TEXT NOT NULL DEFAULT '[]',  -- JSON array of Clause objects
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    PRIMARY KEY (key, env_key)
);

CREATE TABLE IF NOT EXISTS api_keys (
    id         TEXT PRIMARY KEY NOT NULL,
    hash       TEXT NOT NULL UNIQUE,  -- sha256(raw_key) hex-encoded
    role       TEXT NOT NULL CHECK (role IN ('admin', 'sdk')),
    env_key    TEXT,  -- NULL for admin keys (required for sdk keys)
    name       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS audit_log (
    id         TEXT PRIMARY KEY NOT NULL,
    ts         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    actor_key_id TEXT NOT NULL,
    action     TEXT NOT NULL,
    flag_key   TEXT,
    env_key    TEXT,
    before_val TEXT,  -- JSON snapshot before change
    after_val  TEXT   -- JSON snapshot after change
);

CREATE INDEX IF NOT EXISTS idx_audit_ts      ON audit_log(ts DESC);
CREATE INDEX IF NOT EXISTS idx_audit_flag    ON audit_log(flag_key);
CREATE INDEX IF NOT EXISTS idx_audit_env     ON audit_log(env_key);
CREATE INDEX IF NOT EXISTS idx_apikeys_hash  ON api_keys(hash);
