ALTER TABLE recurring_bill_occurrences
  ADD COLUMN is_generated INTEGER NOT NULL DEFAULT 0 CHECK (is_generated IN (0, 1));
ALTER TABLE recurring_bill_occurrences
  ADD COLUMN is_manually_overridden INTEGER NOT NULL DEFAULT 0 CHECK (is_manually_overridden IN (0, 1));

UPDATE recurring_bill_occurrences
SET is_generated = 1
WHERE purchase_id IS NULL AND status <> 'paid';

ALTER TABLE recurring_contribution_occurrences
  ADD COLUMN is_generated INTEGER NOT NULL DEFAULT 0 CHECK (is_generated IN (0, 1));
ALTER TABLE recurring_contribution_occurrences
  ADD COLUMN is_manually_overridden INTEGER NOT NULL DEFAULT 0 CHECK (is_manually_overridden IN (0, 1));

UPDATE recurring_contribution_occurrences
SET is_generated = 1
WHERE fund_contribution_id IS NULL AND status <> 'paid';

CREATE INDEX recurring_bill_occurrences_generation_index
  ON recurring_bill_occurrences(recurring_bill_id, is_generated, is_manually_overridden, due_date);
CREATE INDEX recurring_contribution_occurrences_generation_index
  ON recurring_contribution_occurrences(recurring_contribution_plan_id, is_generated, is_manually_overridden, due_date);
