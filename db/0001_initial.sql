-- Draft D1 schema; not applied
CREATE TABLE projects (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE jobs (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), status TEXT NOT NULL CHECK(status IN ('queued','running','succeeded','failed','blocked')), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE audit_events (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), actor_id TEXT NOT NULL, action TEXT NOT NULL, outcome TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX jobs_project_idx ON jobs(project_id,status);
CREATE INDEX audit_project_idx ON audit_events(project_id,created_at);
