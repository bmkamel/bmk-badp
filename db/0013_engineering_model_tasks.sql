CREATE TABLE IF NOT EXISTS engineering_model_tasks (
 id TEXT PRIMARY KEY,
 owner TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('language-names','theme-actions')),
 status TEXT NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','running','blocked','paused','verified')),
 requested_at INTEGER NOT NULL DEFAULT (unixepoch()),
 attempts INTEGER NOT NULL DEFAULT 0,
 lease_until INTEGER NOT NULL DEFAULT 0,
 available_at INTEGER NOT NULL DEFAULT 0,
 run_id TEXT, pr INTEGER, merge_sha TEXT, evidence TEXT,
 research TEXT NOT NULL, base_sha TEXT, proposal TEXT, provider TEXT, reason TEXT,
 UNIQUE(owner,kind)
);
CREATE TABLE IF NOT EXISTS engineering_intake (
 id TEXT PRIMARY KEY, owner TEXT NOT NULL, command TEXT NOT NULL,
 requested_at INTEGER NOT NULL DEFAULT (unixepoch()), run_id TEXT,
 status TEXT NOT NULL CHECK(status IN ('queued','inspected','needs_scope','paused')),
 summary TEXT
);
