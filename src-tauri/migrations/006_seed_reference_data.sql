INSERT INTO people (id, name, weekly_contribution_cents)
VALUES
  ('person-alex', 'Alex', 5000),
  ('person-jordan', 'Jordan', 5000),
  ('person-sam', 'Sam', 5000);

INSERT INTO payment_sources (
  id,
  name,
  type,
  ownership,
  managed_by,
  opening_balance_cents
)
VALUES
  ('shared-cash', 'Shared cash', 'cash', 'household', 'household', 15000),
  ('shared-bank', 'Shared bank account', 'bank-account', 'household', 'household', NULL),
  ('alex-bank', 'Alex bank account', 'bank-account', 'person-alex', 'person-alex', NULL),
  ('jordan-bank', 'Jordan bank account', 'bank-account', 'person-jordan', 'person-jordan', NULL),
  ('sam-pay-later', 'Sam pay-later account', 'afterpay', 'person-sam', 'person-sam', NULL);

INSERT INTO settlement_groups (id, name)
VALUES
  ('group-alex-jordan', 'Alex & Jordan'),
  ('group-sam', 'Sam');

INSERT INTO settlement_group_members (settlement_group_id, person_id)
VALUES
  ('group-alex-jordan', 'person-alex'),
  ('group-alex-jordan', 'person-jordan'),
  ('group-sam', 'person-sam');
