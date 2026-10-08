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
