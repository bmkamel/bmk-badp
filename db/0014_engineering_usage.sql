CREATE TABLE IF NOT EXISTS engineering_usage (
 task_id TEXT NOT NULL REFERENCES engineering_model_tasks(id),
 run_id TEXT NOT NULL,
 provider TEXT NOT NULL CHECK(provider IN ('groq','openrouter-free')),
 outcome TEXT NOT NULL CHECK(outcome IN ('accepted','daily_quota','provider_or_validation_failure')),
 prompt_tokens INTEGER, completion_tokens INTEGER, reported_cost REAL,
 recorded_at INTEGER NOT NULL DEFAULT (unixepoch()),
 PRIMARY KEY(task_id,run_id,provider)
);
