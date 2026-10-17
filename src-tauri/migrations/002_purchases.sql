CREATE TABLE purchases (
  id TEXT PRIMARY KEY NOT NULL,
  purchase_date TEXT NOT NULL,
  merchant TEXT NOT NULL,
  receipt_total_cents INTEGER NOT NULL CHECK (receipt_total_cents >= 0),
  payment_source_id TEXT NOT NULL REFERENCES payment_sources(id),
  receipt_item_count INTEGER CHECK (receipt_item_count >= 0),
  items_are_consolidated INTEGER NOT NULL DEFAULT 0 CHECK (items_are_consolidated IN (0, 1)),
  receipt_rounding_adjustment_cents INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE TABLE purchase_items (
  id TEXT PRIMARY KEY NOT NULL,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  total_amount_cents INTEGER NOT NULL CHECK (total_amount_cents >= 0),
  category TEXT NOT NULL,
  ownership TEXT NOT NULL CHECK (ownership IN ('household', 'personal')),
  notes TEXT
);

CREATE TABLE purchase_item_splits (
  purchase_item_id TEXT NOT NULL REFERENCES purchase_items(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES people(id),
  PRIMARY KEY (purchase_item_id, person_id)
);

CREATE TABLE purchase_item_owners (
  purchase_item_id TEXT NOT NULL REFERENCES purchase_items(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES people(id),
  PRIMARY KEY (purchase_item_id, person_id)
);

CREATE TABLE purchase_rounding_splits (
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES people(id),
  PRIMARY KEY (purchase_id, person_id)
);

CREATE INDEX purchases_date_index ON purchases(purchase_date);
CREATE INDEX purchases_merchant_index ON purchases(merchant);
CREATE INDEX purchases_payment_source_index ON purchases(payment_source_id);
CREATE INDEX purchase_items_purchase_index ON purchase_items(purchase_id);
