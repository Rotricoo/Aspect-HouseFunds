CREATE TABLE app_settings (
  setting_key TEXT PRIMARY KEY NOT NULL,
  setting_value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO app_settings (setting_key, setting_value, updated_at) VALUES
  ('automaticBackupsEnabled', 'true', CURRENT_TIMESTAMP),
  ('automaticBackupRetention', '14', CURRENT_TIMESTAMP),
  ('purchasePageSize', '15', CURRENT_TIMESTAMP);
