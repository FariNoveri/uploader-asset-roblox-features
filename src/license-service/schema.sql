CREATE TABLE IF NOT EXISTS licenses (
    id TEXT PRIMARY KEY,
    key_hash TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    max_devices INTEGER NOT NULL DEFAULT 1 CHECK (max_devices BETWEEN 1 AND 20),
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
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

CREATE INDEX IF NOT EXISTS activations_last_seen_idx
    ON activations(last_seen DESC);
