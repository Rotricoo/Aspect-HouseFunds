CREATE TRIGGER audit_contributions_insert AFTER INSERT ON fund_contributions BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('create', 'contribution', NEW.id, 'Contribution created', json_object('amountCents', NEW.amount_cents, 'person', NEW.contributor_person_id, 'source', NEW.fund_source_id));
END;
CREATE TRIGGER audit_contributions_update AFTER UPDATE ON fund_contributions BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('update', 'contribution', NEW.id, 'Contribution updated', json_object('amountCents', NEW.amount_cents, 'person', NEW.contributor_person_id, 'source', NEW.fund_source_id));
END;
CREATE TRIGGER audit_contributions_delete AFTER DELETE ON fund_contributions BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('delete', 'contribution', OLD.id, 'Contribution deleted', json_object('amountCents', OLD.amount_cents, 'person', OLD.contributor_person_id, 'source', OLD.fund_source_id));
END;

CREATE TRIGGER audit_refunds_insert AFTER INSERT ON refunds BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('create', 'refund', NEW.id, 'Refund created', json_object('merchant', NEW.merchant, 'amountCents', NEW.amount_cents));
END;
CREATE TRIGGER audit_refunds_update AFTER UPDATE ON refunds BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('update', 'refund', NEW.id, 'Refund updated', json_object('merchant', NEW.merchant, 'amountCents', NEW.amount_cents));
END;
CREATE TRIGGER audit_refunds_delete AFTER DELETE ON refunds BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('delete', 'refund', OLD.id, 'Refund deleted', json_object('merchant', OLD.merchant, 'amountCents', OLD.amount_cents));
END;

CREATE TRIGGER audit_transfers_insert AFTER INSERT ON fund_transfers BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('create', 'transfer', NEW.id, 'Fund transfer created', json_object('amountCents', NEW.amount_cents, 'from', NEW.from_payment_source_id, 'to', NEW.to_payment_source_id));
END;
CREATE TRIGGER audit_transfers_update AFTER UPDATE ON fund_transfers BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('update', 'transfer', NEW.id, 'Fund transfer updated', json_object('amountCents', NEW.amount_cents, 'from', NEW.from_payment_source_id, 'to', NEW.to_payment_source_id));
END;
CREATE TRIGGER audit_transfers_delete AFTER DELETE ON fund_transfers BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('delete', 'transfer', OLD.id, 'Fund transfer deleted', json_object('amountCents', OLD.amount_cents, 'from', OLD.from_payment_source_id, 'to', OLD.to_payment_source_id));
END;

CREATE TRIGGER audit_adjustments_insert AFTER INSERT ON fund_adjustments BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('create', 'adjustment', NEW.id, 'Fund adjustment created', json_object('amountCents', NEW.amount_cents, 'direction', NEW.direction, 'source', NEW.fund_source_id));
END;
CREATE TRIGGER audit_adjustments_update AFTER UPDATE ON fund_adjustments BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('update', 'adjustment', NEW.id, 'Fund adjustment updated', json_object('amountCents', NEW.amount_cents, 'direction', NEW.direction, 'source', NEW.fund_source_id));
END;
CREATE TRIGGER audit_adjustments_delete AFTER DELETE ON fund_adjustments BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('delete', 'adjustment', OLD.id, 'Fund adjustment deleted', json_object('amountCents', OLD.amount_cents, 'direction', OLD.direction, 'source', OLD.fund_source_id));
END;

CREATE TRIGGER audit_afterpay_payments_insert AFTER INSERT ON afterpay_payments BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('create', 'afterpay-payment', NEW.id, 'Afterpay payment created', json_object('amountCents', NEW.amount_cents, 'source', NEW.afterpay_source_id));
END;
CREATE TRIGGER audit_afterpay_payments_update AFTER UPDATE ON afterpay_payments BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('update', 'afterpay-payment', NEW.id, 'Afterpay payment updated', json_object('amountCents', NEW.amount_cents, 'source', NEW.afterpay_source_id));
END;
CREATE TRIGGER audit_afterpay_payments_delete AFTER DELETE ON afterpay_payments BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('delete', 'afterpay-payment', OLD.id, 'Afterpay payment deleted', json_object('amountCents', OLD.amount_cents, 'source', OLD.afterpay_source_id));
END;

CREATE TRIGGER audit_recurring_bill_occurrences_update AFTER UPDATE ON recurring_bill_occurrences
WHEN OLD.status <> NEW.status OR OLD.amount_cents <> NEW.amount_cents BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('update', 'recurring-bill-occurrence', NEW.id, 'Recurring payment updated', json_object('amountCents', NEW.amount_cents, 'status', NEW.status, 'paidDate', NEW.paid_date));
END;

CREATE TRIGGER audit_recurring_contributions_update AFTER UPDATE ON recurring_contribution_occurrences
WHEN OLD.status <> NEW.status OR OLD.amount_cents <> NEW.amount_cents BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('update', 'recurring-contribution-occurrence', NEW.id, 'Scheduled contribution updated', json_object('amountCents', NEW.amount_cents, 'status', NEW.status, 'paidDate', NEW.paid_date));
END;
