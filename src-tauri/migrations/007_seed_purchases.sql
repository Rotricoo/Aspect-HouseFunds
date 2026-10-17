INSERT INTO purchases (id, purchase_date, merchant, receipt_total_cents, payment_source_id, receipt_item_count, items_are_consolidated, receipt_rounding_adjustment_cents, notes)
VALUES ('demo-grocery-purchase', '2026-01-15', 'Example Market', 6420, 'shared-bank', 3, 0, 0, 'Fictional demo purchase for the public portfolio app.');

INSERT INTO purchase_items (id, purchase_id, name, description, quantity, unit_price_cents, total_amount_cents, category, ownership, notes)
VALUES ('demo-grocery-item', 'demo-grocery-purchase', 'Household groceries', 'Fictional shared grocery item', 1, 6420, 6420, 'Groceries', 'household', NULL);

INSERT INTO purchase_item_splits (purchase_item_id, person_id)
VALUES ('demo-grocery-item', 'person-alex'), ('demo-grocery-item', 'person-jordan'), ('demo-grocery-item', 'person-sam');
