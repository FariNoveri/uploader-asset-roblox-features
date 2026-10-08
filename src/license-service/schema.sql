CREATE TABLE IF NOT EXISTS licenses (
    id TEXT PRIMARY KEY,
    key_hash TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    max_devices INTEGER NOT NULL DEFAULT 1 CHECK (max_devices BETWEEN 1 AND 20),
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    creator_id TEXT NOT NULL DEFAULT '',
    creator_is_group INTEGER NOT NULL DEFAULT 0 CHECK (creator_is_group IN (0, 1)),
    profile_locked INTEGER NOT NULL DEFAULT 0 CHECK (profile_locked IN (0, 1))
);

CREATE TABLE IF NOT EXISTS activations (
    key_hash TEXT NOT NULL,
    install_id TEXT NOT NULL,
    ip_address TEXT NOT NULL,
    creator_id TEXT NOT NULL DEFAULT '',
    creator_verified INTEGER NOT NULL DEFAULT 0 CHECK (creator_verified = 0),
    first_seen TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    PRIMARY KEY (key_hash, install_id),
    FOREIGN KEY (key_hash) REFERENCES licenses(key_hash) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    maintenance_enabled INTEGER NOT NULL DEFAULT 0 CHECK (maintenance_enabled IN (0, 1)),
    maintenance_message TEXT NOT NULL DEFAULT '',
    update_version TEXT NOT NULL DEFAULT '',
    update_url TEXT NOT NULL DEFAULT '',
    update_sha256 TEXT NOT NULL DEFAULT '',
    update_notes TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
);

INSERT OR IGNORE INTO app_settings (id) VALUES (1);

CREATE INDEX IF NOT EXISTS activations_last_seen_idx
    ON activations(last_seen DESC);
