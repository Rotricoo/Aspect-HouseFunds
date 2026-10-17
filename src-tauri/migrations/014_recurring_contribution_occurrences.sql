CREATE TABLE recurring_contribution_occurrences (
  id TEXT PRIMARY KEY NOT NULL,
  recurring_contribution_plan_id TEXT NOT NULL REFERENCES recurring_contribution_plans(id),
  person_id TEXT NOT NULL REFERENCES people(id),
  due_date TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  status TEXT NOT NULL CHECK (status IN ('scheduled', 'paid', 'overdue', 'cancelled')),
  paid_date TEXT,
  fund_contribution_id TEXT REFERENCES fund_contributions(id),
  notes TEXT,
  UNIQUE (recurring_contribution_plan_id, person_id, due_date)
);

CREATE INDEX recurring_contribution_occurrences_due_date_index
  ON recurring_contribution_occurrences(due_date);

CREATE INDEX recurring_contribution_occurrences_status_index
  ON recurring_contribution_occurrences(status);
