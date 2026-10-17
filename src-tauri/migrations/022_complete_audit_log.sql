DROP TRIGGER audit_purchases_insert;
DROP TRIGGER audit_purchases_update;
DROP TRIGGER audit_purchases_delete;
CREATE TRIGGER audit_purchases_insert AFTER INSERT ON purchases BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('create', 'purchase', NEW.id, 'Purchase created', json_object('date', NEW.purchase_date, 'merchant', NEW.merchant, 'amountCents', NEW.receipt_total_cents, 'source', NEW.payment_source_id));
END;
CREATE TRIGGER audit_purchases_update AFTER UPDATE ON purchases BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('update', 'purchase', NEW.id, 'Purchase updated', json_object('date', NEW.purchase_date, 'merchant', NEW.merchant, 'amountCents', NEW.receipt_total_cents, 'source', NEW.payment_source_id));
END;
CREATE TRIGGER audit_purchases_delete AFTER DELETE ON purchases BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('delete', 'purchase', OLD.id, 'Purchase deleted', json_object('date', OLD.purchase_date, 'merchant', OLD.merchant, 'amountCents', OLD.receipt_total_cents, 'source', OLD.payment_source_id));
END;

DROP TRIGGER audit_recurring_bill_occurrences_update;
CREATE TRIGGER audit_recurring_bill_occurrences_update AFTER UPDATE ON recurring_bill_occurrences
WHEN OLD.status <> NEW.status OR OLD.amount_cents <> NEW.amount_cents OR OLD.paid_date IS NOT NEW.paid_date
  OR OLD.payment_source_id IS NOT NEW.payment_source_id OR OLD.purchase_id IS NOT NEW.purchase_id OR OLD.notes IS NOT NEW.notes BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('update', 'recurring-bill-occurrence', NEW.id, 'Recurring payment updated', json_object('amountCents', NEW.amount_cents, 'status', NEW.status, 'paidDate', NEW.paid_date, 'source', NEW.payment_source_id, 'purchaseId', NEW.purchase_id));
END;

DROP TRIGGER audit_recurring_contributions_update;
CREATE TRIGGER audit_recurring_contributions_update AFTER UPDATE ON recurring_contribution_occurrences
WHEN OLD.status <> NEW.status OR OLD.amount_cents <> NEW.amount_cents OR OLD.paid_date IS NOT NEW.paid_date
  OR OLD.fund_contribution_id IS NOT NEW.fund_contribution_id OR OLD.notes IS NOT NEW.notes BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('update', 'recurring-contribution-occurrence', NEW.id, 'Scheduled contribution updated', json_object('amountCents', NEW.amount_cents, 'status', NEW.status, 'paidDate', NEW.paid_date, 'contributionId', NEW.fund_contribution_id));
END;

CREATE TRIGGER audit_balance_checks_insert AFTER INSERT ON fund_balance_checks BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('create', 'balance-check', NEW.id, 'Fund balance check created', json_object('source', NEW.fund_source_id, 'countedAmountCents', NEW.counted_amount_cents, 'checkedAt', NEW.checked_at));
END;
CREATE TRIGGER audit_balance_checks_update AFTER UPDATE ON fund_balance_checks BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('update', 'balance-check', NEW.id, 'Fund balance check updated', json_object('source', NEW.fund_source_id, 'countedAmountCents', NEW.counted_amount_cents, 'checkedAt', NEW.checked_at));
END;
CREATE TRIGGER audit_balance_checks_delete AFTER DELETE ON fund_balance_checks BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('delete', 'balance-check', OLD.id, 'Fund balance check deleted', json_object('source', OLD.fund_source_id, 'countedAmountCents', OLD.counted_amount_cents, 'checkedAt', OLD.checked_at));
END;

CREATE TRIGGER audit_recurring_bills_insert AFTER INSERT ON recurring_bills BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('create', 'recurring-bill', NEW.id, 'Recurring bill template created', json_object('name', NEW.name, 'frequency', NEW.frequency, 'active', NEW.is_active));
END;
CREATE TRIGGER audit_recurring_bills_update AFTER UPDATE ON recurring_bills BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('update', 'recurring-bill', NEW.id, 'Recurring bill template updated', json_object('name', NEW.name, 'frequency', NEW.frequency, 'active', NEW.is_active));
END;
CREATE TRIGGER audit_recurring_bills_delete AFTER DELETE ON recurring_bills BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('delete', 'recurring-bill', OLD.id, 'Recurring bill template deleted', json_object('name', OLD.name, 'frequency', OLD.frequency));
END;

CREATE TRIGGER audit_contribution_plans_insert AFTER INSERT ON recurring_contribution_plans BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('create', 'recurring-contribution-plan', NEW.id, 'Contribution plan created', json_object('name', NEW.name, 'amountCents', NEW.amount_per_person_cents, 'active', NEW.is_active));
END;
CREATE TRIGGER audit_contribution_plans_update AFTER UPDATE ON recurring_contribution_plans BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('update', 'recurring-contribution-plan', NEW.id, 'Contribution plan updated', json_object('name', NEW.name, 'amountCents', NEW.amount_per_person_cents, 'active', NEW.is_active));
END;
CREATE TRIGGER audit_contribution_plans_delete AFTER DELETE ON recurring_contribution_plans BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('delete', 'recurring-contribution-plan', OLD.id, 'Contribution plan deleted', json_object('name', OLD.name, 'amountCents', OLD.amount_per_person_cents));
END;

CREATE TRIGGER audit_installments_insert AFTER INSERT ON payment_installments BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('create', 'payment-installment', NEW.id, 'Payment installment created', json_object('purchaseId', NEW.purchase_id, 'number', NEW.installment_number, 'amountCents', NEW.amount_cents, 'status', NEW.status));
END;
CREATE TRIGGER audit_installments_update AFTER UPDATE ON payment_installments BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('update', 'payment-installment', NEW.id, 'Payment installment updated', json_object('purchaseId', NEW.purchase_id, 'number', NEW.installment_number, 'amountCents', NEW.amount_cents, 'status', NEW.status));
END;
CREATE TRIGGER audit_installments_delete AFTER DELETE ON payment_installments BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('delete', 'payment-installment', OLD.id, 'Payment installment deleted', json_object('purchaseId', OLD.purchase_id, 'number', OLD.installment_number, 'amountCents', OLD.amount_cents));
END;

CREATE TRIGGER audit_attachments_insert AFTER INSERT ON attachments BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('create', 'attachment', NEW.id, 'Attachment added', json_object('parentType', NEW.entity_type, 'parentId', NEW.entity_id, 'fileName', NEW.original_file_name));
END;
CREATE TRIGGER audit_attachments_delete AFTER DELETE ON attachments BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('delete', 'attachment', OLD.id, 'Attachment removed', json_object('parentType', OLD.entity_type, 'parentId', OLD.entity_id, 'fileName', OLD.original_file_name));
END;

CREATE TRIGGER audit_categories_insert AFTER INSERT ON categories BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('create', 'category', NEW.id, 'Category created', json_object('name', NEW.name, 'active', NEW.is_active));
END;
CREATE TRIGGER audit_categories_update AFTER UPDATE ON categories BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('update', 'category', NEW.id, 'Category updated', json_object('name', NEW.name, 'active', NEW.is_active));
END;
CREATE TRIGGER audit_categories_delete AFTER DELETE ON categories BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('delete', 'category', OLD.id, 'Category deleted', json_object('name', OLD.name));
END;

CREATE TRIGGER audit_app_settings_insert AFTER INSERT ON app_settings BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('create', 'app-setting', NEW.setting_key, 'Application setting created', json_object('value', NEW.setting_value));
END;
CREATE TRIGGER audit_app_settings_update AFTER UPDATE ON app_settings BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('update', 'app-setting', NEW.setting_key, 'Application setting updated', json_object('oldValue', OLD.setting_value, 'value', NEW.setting_value));
END;

CREATE TRIGGER audit_settlement_periods_insert AFTER INSERT ON settlement_periods BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('create', 'settlement-period', NEW.id, 'Settlement period created', json_object('periodStart', NEW.period_start, 'periodEnd', NEW.period_end, 'status', NEW.status));
END;
CREATE TRIGGER audit_settlement_periods_delete AFTER DELETE ON settlement_periods BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('delete', 'settlement-period', OLD.id, 'Settlement period deleted', json_object('periodStart', OLD.period_start, 'periodEnd', OLD.period_end));
END;
CREATE TRIGGER audit_settlement_payments_insert AFTER INSERT ON settlement_payments BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('create', 'settlement-payment', NEW.id, 'Payment linked to settlement', json_object('periodId', NEW.settlement_period_id, 'reimbursementId', NEW.reimbursement_id));
END;
CREATE TRIGGER audit_settlement_payments_delete AFTER DELETE ON settlement_payments BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('delete', 'settlement-payment', OLD.id, 'Payment unlinked from settlement', json_object('periodId', OLD.settlement_period_id, 'reimbursementId', OLD.reimbursement_id));
END;
