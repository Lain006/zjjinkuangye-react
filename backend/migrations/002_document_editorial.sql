ALTER TABLE documents ADD COLUMN topic text;
ALTER TABLE documents ADD COLUMN evidence_locator text NOT NULL DEFAULT '';
