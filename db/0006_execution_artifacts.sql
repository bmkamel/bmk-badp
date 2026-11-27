-- Artifacts keep each generated plan, patch set, test result, and preview in
-- the isolated BADP database. They are not deployments or project worktrees.
CREATE TABLE development_artifacts (
 id TEXT PRIMARY KEY,
 run_id TEXT NOT NULL,
 project_id TEXT NOT NULL,
 type TEXT NOT NULL CHECK(type IN ('plan','patch','test','preview','failure')),
 content_json TEXT NOT NULL CHECK(length(content_json) BETWEEN 2 AND 500000),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(run_id,project_id) REFERENCES development_runs(id,project_id)
);
CREATE INDEX development_artifacts_run_idx ON development_artifacts(project_id,run_id,created_at);
