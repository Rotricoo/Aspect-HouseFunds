CREATE TABLE attachments (
  id TEXT PRIMARY KEY NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('purchase', 'refund', 'fund-adjustment')),
  entity_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  original_file_name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX attachments_entity_index ON attachments(entity_type, entity_id);
