CREATE TABLE IF NOT EXISTS chat_tasks (
 id TEXT PRIMARY KEY,
 owner TEXT NOT NULL,
 prompt TEXT NOT NULL,
 attachment_name TEXT,
 attachment_text TEXT,
 state TEXT NOT NULL CHECK(state IN ('queued','running','paused','review','blocked')),
 attempt TEXT,
 updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
 created_at INTEGER NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS chat_tasks_owner_created ON chat_tasks(owner, created_at DESC);
