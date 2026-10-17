ALTER TABLE purchase_items ADD COLUMN category_id TEXT REFERENCES categories(id);
ALTER TABLE recurring_bills ADD COLUMN category_id TEXT REFERENCES categories(id);

UPDATE purchase_items
SET category_id = (SELECT categories.id FROM categories WHERE categories.name = purchase_items.category COLLATE NOCASE);

UPDATE recurring_bills
SET category_id = (SELECT categories.id FROM categories WHERE categories.name = recurring_bills.category COLLATE NOCASE);
