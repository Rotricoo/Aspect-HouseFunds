export type SettlementKind = "payable-now" | "afterpay" | "overall";

export interface SettlementSnapshotTransfer {
  id: string;
  fromGroupId: string;
  toGroupId: string;
  amount: number;
  kind: SettlementKind;
}

export interface SettlementPeriod {
  id: string;
  periodStart: Date;
  periodEnd: Date;
  status: "open" | "closed";
  closedAt: Date | null;
  notes: string | null;
  createdAt: Date;
  transfers: SettlementSnapshotTransfer[];
  reimbursementIds: string[];
}

export interface AuditEvent {
  id: number;
  occurredAt: Date;
  action: "create" | "update" | "delete" | "cancel" | "restore" | "close-period";
  entityType: string;
  entityId: string;
  summary: string;
  snapshotJson: string | null;
}
