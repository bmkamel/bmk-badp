-- Dedicated BADP run ownership; a fresh token fences writers after expiry.
ALTER TABLE development_runs ADD COLUMN lease_token TEXT;
ALTER TABLE development_runs ADD COLUMN lease_until INTEGER;
