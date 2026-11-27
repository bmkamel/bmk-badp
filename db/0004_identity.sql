CREATE TABLE identities (issuer TEXT NOT NULL, subject TEXT NOT NULL, actor_id TEXT NOT NULL REFERENCES actors(id), PRIMARY KEY(issuer,subject));
