CREATE TABLE IF NOT EXISTS engineering_queue (
 id TEXT PRIMARY KEY,
 owner TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('dashboard-theme','composer-keyboard')),
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','blocked','paused','verified')),
 requested_at INTEGER NOT NULL DEFAULT (unixepoch()),
 lease_until INTEGER NOT NULL DEFAULT 0,
 attempts INTEGER NOT NULL DEFAULT 0,
 run_id TEXT,
 pr INTEGER,
 merge_sha TEXT,
 evidence TEXT
);
CREATE INDEX IF NOT EXISTS engineering_queue_pending ON engineering_queue(status, requested_at);
