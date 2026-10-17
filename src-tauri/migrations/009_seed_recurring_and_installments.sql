INSERT INTO recurring_bills (id, name, merchant, category, frequency, default_amount_cents, default_payment_source_id, preferred_payment_lead_days, starts_on, is_active, notes)
VALUES ('demo-internet-bill', 'Internet', 'Example Internet Co', 'Utilities', 'monthly', 6500, 'shared-bank', 3, '2026-01-01', 1, 'Fictional recurring bill.');

INSERT INTO recurring_bill_splits (recurring_bill_id, person_id)
VALUES ('demo-internet-bill', 'person-alex'), ('demo-internet-bill', 'person-jordan'), ('demo-internet-bill', 'person-sam');

INSERT INTO recurring_contribution_plans (id, name, frequency, amount_per_person_cents, destination_fund_source_id, starts_on, is_active, notes)
VALUES ('demo-monthly-contribution', 'Monthly household contribution', 'monthly', 5000, 'shared-bank', '2026-01-01', 1, 'Fictional contribution plan.');

INSERT INTO recurring_contribution_plan_members (recurring_contribution_plan_id, person_id)
VALUES ('demo-monthly-contribution', 'person-alex'), ('demo-monthly-contribution', 'person-jordan'), ('demo-monthly-contribution', 'person-sam');
