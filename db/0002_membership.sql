-- Draft migration; apply only to isolated BADP database.
CREATE TABLE actors (id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE memberships (project_id TEXT NOT NULL REFERENCES projects(id), actor_id TEXT NOT NULL REFERENCES actors(id), role TEXT NOT NULL CHECK(role IN ('viewer','developer','owner')), PRIMARY KEY(project_id,actor_id));
CREATE TABLE budget_months (month TEXT PRIMARY KEY, spent_cents INTEGER NOT NULL DEFAULT 0 CHECK(spent_cents>=0), reserved_cents INTEGER NOT NULL DEFAULT 0 CHECK(reserved_cents>=0), limit_cents INTEGER NOT NULL DEFAULT 1000 CHECK(limit_cents BETWEEN 0 AND 1000), CHECK(spent_cents+reserved_cents<=limit_cents));
CREATE TABLE reservations (id TEXT PRIMARY KEY, month TEXT NOT NULL REFERENCES budget_months(month), project_id TEXT NOT NULL REFERENCES projects(id), cents INTEGER NOT NULL CHECK(cents>=0), status TEXT NOT NULL CHECK(status IN ('reserved','settled','released')));
