CREATE TABLE IF NOT EXISTS engineering_control (
 id INTEGER PRIMARY KEY CHECK(id=1),
 paused INTEGER NOT NULL DEFAULT 0 CHECK(paused IN (0,1)),
 updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);
INSERT OR IGNORE INTO engineering_control(id) VALUES (1);
CREATE TABLE IF NOT EXISTS engineering_inspections (
 day INTEGER PRIMARY KEY,
 base_sha TEXT NOT NULL,
 blueprint_sha TEXT NOT NULL,
 charter_sha TEXT NOT NULL,
 observed_sha TEXT,
 source_url TEXT NOT NULL,
 source_status TEXT NOT NULL,
 run_id TEXT NOT NULL
);
