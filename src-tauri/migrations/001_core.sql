CREATE TABLE people (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  weekly_contribution_cents INTEGER NOT NULL DEFAULT 0 CHECK (weekly_contribution_cents >= 0)
);

CREATE TABLE settlement_groups (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE settlement_group_members (
  settlement_group_id TEXT NOT NULL REFERENCES settlement_groups(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  PRIMARY KEY (settlement_group_id, person_id)
);

CREATE TABLE payment_sources (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('cash', 'bank-account', 'afterpay')),
  ownership TEXT CHECK (ownership IS NULL OR ownership = 'household' OR length(trim(ownership)) > 0),
  managed_by TEXT CHECK (managed_by IS NULL OR managed_by = 'household' OR length(trim(managed_by)) > 0),
  opening_balance_cents INTEGER
);
