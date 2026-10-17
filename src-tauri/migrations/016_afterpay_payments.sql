CREATE TABLE afterpay_payments (
  id TEXT PRIMARY KEY NOT NULL,
  afterpay_source_id TEXT NOT NULL REFERENCES payment_sources(id),
  payment_date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  paid_from_payment_source_id TEXT NOT NULL REFERENCES payment_sources(id),
  notes TEXT
);

CREATE INDEX afterpay_payments_source_date_index
  ON afterpay_payments(afterpay_source_id, payment_date);
