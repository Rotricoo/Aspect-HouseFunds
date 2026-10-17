CREATE TABLE fund_contributions (
  id TEXT PRIMARY KEY NOT NULL,
  contribution_date TEXT,
  fund_source_id TEXT NOT NULL REFERENCES payment_sources(id),
  contributor_person_id TEXT NOT NULL REFERENCES people(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  notes TEXT
);

CREATE TABLE fund_transfers (
  id TEXT PRIMARY KEY NOT NULL,
  transfer_date TEXT NOT NULL,
  from_payment_source_id TEXT NOT NULL REFERENCES payment_sources(id),
  to_payment_source_id TEXT NOT NULL REFERENCES payment_sources(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  notes TEXT,
  CHECK (from_payment_source_id <> to_payment_source_id)
);

CREATE TABLE refunds (
  id TEXT PRIMARY KEY NOT NULL,
  refund_date TEXT NOT NULL,
  merchant TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  received_to_payment_source_id TEXT NOT NULL REFERENCES payment_sources(id),
  original_purchase_id TEXT NOT NULL REFERENCES purchases(id),
  original_purchase_item_id TEXT REFERENCES purchase_items(id),
  notes TEXT
);

CREATE TABLE refund_beneficiaries (
  refund_id TEXT NOT NULL REFERENCES refunds(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES people(id),
  PRIMARY KEY (refund_id, person_id)
);

CREATE TABLE reimbursements (
  id TEXT PRIMARY KEY NOT NULL,
  reimbursement_date TEXT NOT NULL,
  from_person_id TEXT NOT NULL REFERENCES people(id),
  to_person_id TEXT NOT NULL REFERENCES people(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  payment_source_id TEXT NOT NULL REFERENCES payment_sources(id),
  applies_to TEXT NOT NULL CHECK (applies_to IN ('immediate', 'afterpay')),
  notes TEXT,
  CHECK (from_person_id <> to_person_id)
);

CREATE TABLE reimbursement_purchases (
  reimbursement_id TEXT NOT NULL REFERENCES reimbursements(id) ON DELETE CASCADE,
  purchase_id TEXT NOT NULL REFERENCES purchases(id),
  PRIMARY KEY (reimbursement_id, purchase_id)
);

CREATE TABLE fund_balance_checks (
  id TEXT PRIMARY KEY NOT NULL,
  fund_source_id TEXT NOT NULL REFERENCES payment_sources(id),
  counted_amount_cents INTEGER NOT NULL CHECK (counted_amount_cents >= 0),
  checked_at TEXT NOT NULL,
  notes TEXT
);

CREATE TABLE fund_adjustments (
  id TEXT PRIMARY KEY NOT NULL,
  fund_source_id TEXT NOT NULL REFERENCES payment_sources(id),
  adjustment_date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  direction TEXT NOT NULL CHECK (direction IN ('increase', 'decrease')),
  reason TEXT NOT NULL CHECK (reason IN ('cash-count-correction', 'cash-found', 'cash-lost', 'other')),
  notes TEXT NOT NULL
);

CREATE INDEX fund_contributions_source_date_index ON fund_contributions(fund_source_id, contribution_date);
CREATE INDEX fund_transfers_from_index ON fund_transfers(from_payment_source_id);
CREATE INDEX fund_transfers_to_index ON fund_transfers(to_payment_source_id);
CREATE INDEX refunds_purchase_index ON refunds(original_purchase_id);
CREATE INDEX fund_balance_checks_source_date_index ON fund_balance_checks(fund_source_id, checked_at);
CREATE INDEX fund_adjustments_source_date_index ON fund_adjustments(fund_source_id, adjustment_date);
