CREATE TABLE recurring_bills (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  merchant TEXT NOT NULL,
  category TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly')),
  default_amount_cents INTEGER CHECK (default_amount_cents >= 0),
  default_payment_source_id TEXT NOT NULL REFERENCES payment_sources(id),
  preferred_payment_lead_days INTEGER NOT NULL DEFAULT 0 CHECK (preferred_payment_lead_days >= 0),
  starts_on TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  notes TEXT
);

CREATE TABLE recurring_bill_splits (
  recurring_bill_id TEXT NOT NULL REFERENCES recurring_bills(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES people(id),
  PRIMARY KEY (recurring_bill_id, person_id)
);

CREATE TABLE recurring_bill_occurrences (
  id TEXT PRIMARY KEY NOT NULL,
  recurring_bill_id TEXT NOT NULL REFERENCES recurring_bills(id),
  period_start_date TEXT NOT NULL,
  period_end_date TEXT NOT NULL,
  due_date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'paid', 'overdue', 'cancelled')),
  paid_date TEXT,
  payment_source_id TEXT REFERENCES payment_sources(id),
  purchase_id TEXT REFERENCES purchases(id),
  notes TEXT,
  CHECK (period_end_date >= period_start_date)
);

CREATE TABLE recurring_contribution_plans (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly')),
  amount_per_person_cents INTEGER NOT NULL CHECK (amount_per_person_cents > 0),
  destination_fund_source_id TEXT NOT NULL REFERENCES payment_sources(id),
  starts_on TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  notes TEXT
);

CREATE TABLE recurring_contribution_plan_members (
  recurring_contribution_plan_id TEXT NOT NULL REFERENCES recurring_contribution_plans(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES people(id),
  PRIMARY KEY (recurring_contribution_plan_id, person_id)
);

CREATE TABLE payment_installments (
  id TEXT PRIMARY KEY NOT NULL,
  purchase_id TEXT NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  installment_number INTEGER NOT NULL CHECK (installment_number > 0),
  total_installments INTEGER NOT NULL CHECK (total_installments > 0),
  due_date TEXT NOT NULL,
  paid_date TEXT,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL CHECK (status IN ('unconfirmed', 'pending', 'paid', 'overdue')),
  afterpay_source_id TEXT NOT NULL REFERENCES payment_sources(id),
  paid_from_payment_source_id TEXT REFERENCES payment_sources(id),
  schedule_is_estimated INTEGER NOT NULL DEFAULT 0 CHECK (schedule_is_estimated IN (0, 1)),
  notes TEXT,
  UNIQUE (purchase_id, installment_number)
);

CREATE INDEX recurring_bill_occurrences_due_date_index ON recurring_bill_occurrences(due_date);
CREATE INDEX recurring_bill_occurrences_status_index ON recurring_bill_occurrences(status);
CREATE INDEX payment_installments_due_date_index ON payment_installments(due_date);
CREATE INDEX payment_installments_status_index ON payment_installments(status);
