CREATE TABLE categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL COLLATE NOCASE UNIQUE,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

INSERT OR IGNORE INTO categories (id, name)
SELECT lower(replace(trim(category), ' ', '-')), trim(category)
FROM purchase_items
WHERE trim(category) <> '';

INSERT OR IGNORE INTO categories (id, name)
SELECT lower(replace(trim(category), ' ', '-')), trim(category)
FROM recurring_bills
WHERE trim(category) <> '';
