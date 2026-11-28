ALTER TABLE engineering_queue ADD COLUMN recipe TEXT CHECK(recipe IS NULL OR recipe='dashboard-theme-selector');
CREATE UNIQUE INDEX IF NOT EXISTS engineering_one_recipe ON engineering_queue(owner,recipe) WHERE recipe IS NOT NULL;
