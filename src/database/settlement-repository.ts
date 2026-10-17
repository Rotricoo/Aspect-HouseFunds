import type { FinancialReport } from "../types/financial-report";
import type { AuditEvent, SettlementKind, SettlementPeriod } from "../types/settlement-period";
import { formatDateOnly, parseDateOnly } from "../utils/date-only";
import { executeDatabaseTransaction, type DatabaseStatement } from "./database-transaction";
import { openHouseFundDatabase } from "./connection";

const cents = (amount: number) => Math.round(amount * 100);

export async function loadSettlementPeriods(): Promise<SettlementPeriod[]> {
  const database = await openHouseFundDatabase();
  const [periods, transfers, payments] = await Promise.all([
    database.select<
      Array<{
        id: string;
        period_start: string;
        period_end: string;
        status: "open" | "closed";
        closed_at: string | null;
        notes: string | null;
        created_at: string;
      }>
    >("SELECT * FROM settlement_periods ORDER BY period_end DESC, created_at DESC"),
    database.select<
      Array<{
        id: string;
        settlement_period_id: string;
        from_group_id: string;
        to_group_id: string;
        amount_cents: number;
        settlement_kind: SettlementKind;
      }>
    >("SELECT * FROM settlement_snapshot_transfers ORDER BY settlement_period_id, settlement_kind, id"),
    database.select<Array<{ settlement_period_id: string; reimbursement_id: string }>>(
      "SELECT settlement_period_id, reimbursement_id FROM settlement_payments ORDER BY created_at",
    ),
  ]);

  return periods.map((period) => ({
    id: period.id,
    periodStart: parseDateOnly(period.period_start),
    periodEnd: parseDateOnly(period.period_end),
    status: period.status,
    closedAt: period.closed_at ? new Date(period.closed_at) : null,
    notes: period.notes,
    createdAt: new Date(period.created_at),
    transfers: transfers
      .filter((transfer) => transfer.settlement_period_id === period.id)
      .map((transfer) => ({
        id: transfer.id,
        fromGroupId: transfer.from_group_id,
        toGroupId: transfer.to_group_id,
        amount: transfer.amount_cents / 100,
        kind: transfer.settlement_kind,
      })),
    reimbursementIds: payments.filter((payment) => payment.settlement_period_id === period.id).map((payment) => payment.reimbursement_id),
  }));
}

export async function closeSettlementPeriod(input: {
  periodStart: Date;
  periodEnd: Date;
  notes: string | null;
  report: FinancialReport;
}): Promise<void> {
  if (input.periodStart > input.periodEnd) throw new Error("The settlement start date must be before the end date.");
  const database = await openHouseFundDatabase();
  const overlapping = await database.select<Array<{ total: number }>>(
    "SELECT COUNT(*) AS total FROM settlement_periods WHERE NOT (period_end < ? OR period_start > ?)",
    [formatDateOnly(input.periodStart), formatDateOnly(input.periodEnd)],
  );
  if ((overlapping[0]?.total ?? 0) > 0) throw new Error("This date range overlaps an existing settlement period.");

  const periodId = crypto.randomUUID();
  const now = new Date().toISOString();
  const statements: DatabaseStatement[] = [
    {
      sql: `INSERT INTO settlement_periods
        (id, period_start, period_end, status, closed_at, notes, created_at)
        VALUES (?, ?, ?, 'closed', ?, ?, ?)`,
      values: [periodId, formatDateOnly(input.periodStart), formatDateOnly(input.periodEnd), now, input.notes, now],
    },
  ];
  const snapshots = [
    ["payable-now", input.report.groupPayableNowSettlements],
    ["afterpay", input.report.groupAfterpayCommitmentSettlements],
    ["overall", input.report.groupOverallSettlements],
  ] as const;
  for (const [kind, transfers] of snapshots) {
    for (const transfer of transfers) {
      statements.push({
        sql: `INSERT INTO settlement_snapshot_transfers
          (id, settlement_period_id, from_group_id, to_group_id, amount_cents, settlement_kind)
          VALUES (?, ?, ?, ?, ?, ?)`,
        values: [crypto.randomUUID(), periodId, transfer.fromGroupId, transfer.toGroupId, cents(transfer.amount), kind],
      });
    }
  }
  statements.push({
    sql: `INSERT INTO audit_log (action, entity_type, entity_id, summary, snapshot_json)
      VALUES ('close-period', 'settlement-period', ?, 'Settlement period closed', ?)`,
    values: [periodId, JSON.stringify({ periodStart: formatDateOnly(input.periodStart), periodEnd: formatDateOnly(input.periodEnd) })],
  });
  await executeDatabaseTransaction(statements);
}

export async function loadAuditEvents(limit = 100): Promise<AuditEvent[]> {
  const database = await openHouseFundDatabase();
  const rows = await database.select<
    Array<{
      id: number;
      occurred_at: string;
      action: AuditEvent["action"];
      entity_type: string;
      entity_id: string;
      summary: string;
      snapshot_json: string | null;
    }>
  >("SELECT * FROM audit_log ORDER BY occurred_at DESC, id DESC LIMIT ?", [limit]);
  return rows.map((row) => ({
    id: row.id,
    occurredAt: new Date(row.occurred_at.endsWith("Z") ? row.occurred_at : `${row.occurred_at}Z`),
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    summary: row.summary,
    snapshotJson: row.snapshot_json,
  }));
}
