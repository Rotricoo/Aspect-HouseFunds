ALTER TABLE fund_adjustments
  ADD COLUMN allocation_kind TEXT NOT NULL DEFAULT 'balance-only'
  CHECK (allocation_kind IN ('balance-only', 'household-expense'));

CREATE TABLE fund_adjustment_splits (
  fund_adjustment_id TEXT NOT NULL REFERENCES fund_adjustments(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES people(id),
  PRIMARY KEY (fund_adjustment_id, person_id)
);

CREATE INDEX fund_adjustment_splits_adjustment_index
  ON fund_adjustment_splits(fund_adjustment_id);

CREATE TRIGGER audit_adjustment_splits_insert AFTER INSERT ON fund_adjustment_splits BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('update', 'adjustment', NEW.fund_adjustment_id, 'Fund adjustment allocation updated', json_object('personId', NEW.person_id));
END;

CREATE TRIGGER audit_adjustment_splits_delete AFTER DELETE ON fund_adjustment_splits BEGIN
  INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
  VALUES ('update', 'adjustment', OLD.fund_adjustment_id, 'Fund adjustment allocation updated', json_object('personId', OLD.person_id));
END;
