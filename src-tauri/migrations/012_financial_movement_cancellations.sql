CREATE TABLE financial_movement_cancellations (
  entity_type TEXT NOT NULL CHECK (entity_type IN ('contribution', 'refund', 'reimbursement', 'transfer', 'balance-check', 'adjustment')),
  entity_id TEXT NOT NULL,
  cancelled_at TEXT NOT NULL,
  reason TEXT NOT NULL,
  PRIMARY KEY (entity_type, entity_id)
);

CREATE INDEX financial_movement_cancellations_entity_index
ON financial_movement_cancellations(entity_type, entity_id);
