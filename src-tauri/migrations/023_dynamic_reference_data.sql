ALTER TABLE people ADD COLUMN is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1));

-- Reference tables are intentionally kept separate from financial history.
-- Members with historical records must be archived rather than deleted.
