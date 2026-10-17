CREATE TABLE settlement_periods (
  id TEXT PRIMARY KEY NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('open', 'closed')),
  closed_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  CHECK (period_start <= period_end),
  CHECK ((status = 'open' AND closed_at IS NULL) OR (status = 'closed' AND closed_at IS NOT NULL))
);

CREATE TABLE settlement_snapshot_transfers (
  id TEXT PRIMARY KEY NOT NULL,
  settlement_period_id TEXT NOT NULL REFERENCES settlement_periods(id) ON DELETE CASCADE,
  from_group_id TEXT NOT NULL REFERENCES settlement_groups(id),
  to_group_id TEXT NOT NULL REFERENCES settlement_groups(id),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  settlement_kind TEXT NOT NULL CHECK (settlement_kind IN ('payable-now', 'afterpay', 'overall')),
  CHECK (from_group_id <> to_group_id)
);

CREATE TABLE settlement_payments (
  id TEXT PRIMARY KEY NOT NULL,
  settlement_period_id TEXT NOT NULL REFERENCES settlement_periods(id) ON DELETE CASCADE,
  reimbursement_id TEXT NOT NULL UNIQUE REFERENCES reimbursements(id),
  created_at TEXT NOT NULL
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  occurred_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete', 'cancel', 'restore', 'close-period')),
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  snapshot_json TEXT
);

CREATE INDEX settlement_periods_date_index ON settlement_periods(period_start, period_end);
CREATE INDEX settlement_snapshot_period_index ON settlement_snapshot_transfers(settlement_period_id);
CREATE INDEX settlement_payments_period_index ON settlement_payments(settlement_period_id);
CREATE INDEX audit_log_occurred_at_index ON audit_log(occurred_at DESC);
CREATE INDEX audit_log_entity_index ON audit_log(entity_type, entity_id);

CREATE TRIGGER audit_purchases_insert AFTER INSERT ON purchases BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('create', 'purchase', NEW.id, 'Purchase created', json_object('merchant', NEW.merchant, 'amountCents', NEW.receipt_total_cents));
END;

CREATE TRIGGER audit_purchases_update AFTER UPDATE ON purchases BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('update', 'purchase', NEW.id, 'Purchase updated', json_object('merchant', NEW.merchant, 'amountCents', NEW.receipt_total_cents));
END;

CREATE TRIGGER audit_purchases_delete AFTER DELETE ON purchases BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('delete', 'purchase', OLD.id, 'Purchase deleted', json_object('merchant', OLD.merchant, 'amountCents', OLD.receipt_total_cents));
END;

CREATE TRIGGER audit_reimbursements_insert AFTER INSERT ON reimbursements BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('create', 'reimbursement', NEW.id, 'Settlement payment recorded', json_object('amountCents', NEW.amount_cents, 'from', NEW.from_person_id, 'to', NEW.to_person_id));
END;

CREATE TRIGGER audit_reimbursements_update AFTER UPDATE ON reimbursements BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('update', 'reimbursement', NEW.id, 'Settlement payment updated', json_object('amountCents', NEW.amount_cents, 'from', NEW.from_person_id, 'to', NEW.to_person_id));
END;

CREATE TRIGGER audit_reimbursements_delete AFTER DELETE ON reimbursements BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('delete', 'reimbursement', OLD.id, 'Settlement payment deleted', json_object('amountCents', OLD.amount_cents, 'from', OLD.from_person_id, 'to', OLD.to_person_id));
END;

CREATE TRIGGER audit_cancellations_insert AFTER INSERT ON financial_movement_cancellations BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('cancel', NEW.entity_type, NEW.entity_id, 'Financial movement cancelled', json_object('reason', NEW.reason));
END;

CREATE TRIGGER audit_cancellations_delete AFTER DELETE ON financial_movement_cancellations BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary)
  VALUES ('restore', OLD.entity_type, OLD.entity_id, 'Financial movement restored');
END;

CREATE TRIGGER audit_settlement_period_closed AFTER UPDATE OF status ON settlement_periods
WHEN OLD.status = 'open' AND NEW.status = 'closed' BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('close-period', 'settlement-period', NEW.id, 'Settlement period closed', json_object('periodStart', NEW.period_start, 'periodEnd', NEW.period_end));
END;
