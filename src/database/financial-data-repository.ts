import type { FundAdjustment } from "../types/fund-adjustment";
import type { AfterpayPayment } from "../types/afterpay-payment";
import type { FundBalanceCheck } from "../types/fund-balance-check";
import type { FundContribution } from "../types/fund-contribution";
import type { FundTransfer } from "../types/fund-transfer";
import type { PaymentInstallment } from "../types/payment-installment";
import type { Refund } from "../types/refund";
import type { Reimbursement } from "../types/reimbursement";
import type { PersonId } from "../types/person-id";
import { openHouseFundDatabase } from "./connection";
import { executeDatabaseTransaction, type DatabaseStatement } from "./database-transaction";
import { formatDateOnly, parseDateOnly } from "../utils/date-only";
import type { FinancialMovementCancellation, FinancialMovementType } from "../types/financial-movement";
import { removeStoredAttachments } from "../services/attachment-service";

export interface FinancialMovementData {
  contributions: FundContribution[];
  refunds: Refund[];
  reimbursements: Reimbursement[];
  transfers: FundTransfer[];
  balanceChecks: FundBalanceCheck[];
  adjustments: FundAdjustment[];
  installments: PaymentInstallment[];
  afterpayPayments: AfterpayPayment[];
  cancellations: FinancialMovementCancellation[];
}

const money = (cents: number) => cents / 100;
const date = (value: string) => parseDateOnly(value);
const cents = (amount: number) => Math.round(amount * 100);
const dateOnly = (value: Date | null) => (value ? formatDateOnly(value) : null);

export async function loadFinancialMovementData(): Promise<FinancialMovementData> {
  const database = await openHouseFundDatabase();
  const [
    contributionRows,
    refundRows,
    beneficiaryRows,
    reimbursementRows,
    reimbursementPurchaseRows,
    transferRows,
    checkRows,
    adjustmentRows,
    adjustmentSplitRows,
    installmentRows,
    afterpayPaymentRows,
    attachmentRows,
    cancellationRows,
  ] = await Promise.all([
    database.select<
      Array<{
        id: string;
        contribution_date: string | null;
        fund_source_id: string;
        contributor_person_id: PersonId;
        amount_cents: number;
        notes: string | null;
      }>
    >("SELECT * FROM fund_contributions ORDER BY contribution_date"),
    database.select<
      Array<{
        id: string;
        refund_date: string;
        merchant: string;
        amount_cents: number;
        received_to_payment_source_id: string;
        original_purchase_id: string;
        original_purchase_item_id: string | null;
        notes: string | null;
      }>
    >("SELECT * FROM refunds ORDER BY refund_date"),
    database.select<Array<{ refund_id: string; person_id: string }>>("SELECT * FROM refund_beneficiaries"),
    database.select<
      Array<{
        id: string;
        reimbursement_date: string;
        from_person_id: PersonId;
        to_person_id: PersonId;
        amount_cents: number;
        payment_source_id: string;
        applies_to: Reimbursement["appliesTo"];
        notes: string | null;
      }>
    >("SELECT * FROM reimbursements ORDER BY reimbursement_date"),
    database.select<Array<{ reimbursement_id: string; purchase_id: string }>>("SELECT * FROM reimbursement_purchases"),
    database.select<
      Array<{
        id: string;
        transfer_date: string;
        from_payment_source_id: string;
        to_payment_source_id: string;
        amount_cents: number;
        notes: string | null;
      }>
    >("SELECT * FROM fund_transfers ORDER BY transfer_date"),
    database.select<Array<{ id: string; fund_source_id: string; counted_amount_cents: number; checked_at: string; notes: string | null }>>(
      "SELECT * FROM fund_balance_checks ORDER BY checked_at",
    ),
    database.select<
      Array<{
        id: string;
        fund_source_id: string;
        adjustment_date: string;
        amount_cents: number;
        direction: FundAdjustment["direction"];
        reason: FundAdjustment["reason"];
        allocation_kind: FundAdjustment["allocationKind"];
        notes: string;
      }>
    >("SELECT * FROM fund_adjustments ORDER BY adjustment_date"),
    database.select<Array<{ fund_adjustment_id: string; person_id: PersonId }>>("SELECT * FROM fund_adjustment_splits"),
    database.select<
      Array<{
        id: string;
        purchase_id: string;
        installment_number: number;
        total_installments: number;
        due_date: string;
        paid_date: string | null;
        amount_cents: number;
        status: PaymentInstallment["status"];
        afterpay_source_id: string;
        paid_from_payment_source_id: string | null;
        schedule_is_estimated: number;
        notes: string | null;
      }>
    >("SELECT * FROM payment_installments ORDER BY due_date, installment_number"),
    database.select<
      Array<{
        id: string;
        afterpay_source_id: string;
        payment_date: string;
        amount_cents: number;
        paid_from_payment_source_id: string;
        notes: string | null;
      }>
    >("SELECT * FROM afterpay_payments ORDER BY payment_date, id"),
    database.select<Array<{ entity_type: string; entity_id: string; file_path: string }>>(
      "SELECT entity_type, entity_id, file_path FROM attachments",
    ),
    database.select<Array<{ entity_type: FinancialMovementType; entity_id: string; cancelled_at: string; reason: string }>>(
      "SELECT * FROM financial_movement_cancellations",
    ),
  ]);

  return {
    contributions: contributionRows.map((row) => ({
      id: row.id,
      date: row.contribution_date ? date(row.contribution_date) : null,
      fundSourceId: row.fund_source_id,
      contributorPersonId: row.contributor_person_id,
      amount: money(row.amount_cents),
      notes: row.notes,
    })),
    refunds: refundRows.map((row) => ({
      id: row.id,
      date: date(row.refund_date),
      merchant: row.merchant,
      amount: money(row.amount_cents),
      receivedToPaymentSourceId: row.received_to_payment_source_id,
      originalPurchaseId: row.original_purchase_id,
      originalPurchaseItemId: row.original_purchase_item_id,
      beneficiaryPersonIds: beneficiaryRows
        .filter((beneficiary) => beneficiary.refund_id === row.id)
        .map((beneficiary) => beneficiary.person_id),
      attachmentPaths: attachmentRows
        .filter((attachment) => attachment.entity_type === "refund" && attachment.entity_id === row.id)
        .map((attachment) => attachment.file_path),
      notes: row.notes,
    })),
    reimbursements: reimbursementRows.map((row) => ({
      id: row.id,
      date: date(row.reimbursement_date),
      fromPersonId: row.from_person_id,
      toPersonId: row.to_person_id,
      amount: money(row.amount_cents),
      paymentSourceId: row.payment_source_id,
      appliesTo: row.applies_to,
      relatedPurchaseIds: reimbursementPurchaseRows
        .filter((relation) => relation.reimbursement_id === row.id)
        .map((relation) => relation.purchase_id),
      notes: row.notes,
    })),
    transfers: transferRows.map((row) => ({
      id: row.id,
      date: date(row.transfer_date),
      fromPaymentSourceId: row.from_payment_source_id,
      toPaymentSourceId: row.to_payment_source_id,
      amount: money(row.amount_cents),
      notes: row.notes,
    })),
    balanceChecks: checkRows.map((row) => ({
      id: row.id,
      fundSourceId: row.fund_source_id,
      countedAmount: money(row.counted_amount_cents),
      checkedAt: date(row.checked_at),
      notes: row.notes,
    })),
    adjustments: adjustmentRows.map((row) => ({
      id: row.id,
      fundSourceId: row.fund_source_id,
      date: date(row.adjustment_date),
      amount: money(row.amount_cents),
      direction: row.direction,
      reason: row.reason,
      allocationKind: row.allocation_kind,
      splitBetweenPersonIds: adjustmentSplitRows.filter((split) => split.fund_adjustment_id === row.id).map((split) => split.person_id),
      notes: row.notes,
      attachmentPaths: attachmentRows
        .filter((attachment) => attachment.entity_type === "fund-adjustment" && attachment.entity_id === row.id)
        .map((attachment) => attachment.file_path),
    })),
    installments: installmentRows.map((row) => ({
      id: row.id,
      purchaseId: row.purchase_id,
      installmentNumber: row.installment_number,
      totalInstallments: row.total_installments,
      dueDate: date(row.due_date),
      paidDate: row.paid_date ? date(row.paid_date) : null,
      amount: money(row.amount_cents),
      status: row.status,
      afterpaySourceId: row.afterpay_source_id,
      paidFromPaymentSourceId: row.paid_from_payment_source_id,
      scheduleIsEstimated: Boolean(row.schedule_is_estimated),
      notes: row.notes,
    })),
    afterpayPayments: afterpayPaymentRows.map((row) => ({
      id: row.id,
      afterpaySourceId: row.afterpay_source_id,
      date: date(row.payment_date),
      amount: money(row.amount_cents),
      paidFromPaymentSourceId: row.paid_from_payment_source_id,
      notes: row.notes,
    })),
    cancellations: cancellationRows.map((row) => ({
      entityType: row.entity_type,
      entityId: row.entity_id,
      cancelledAt: date(row.cancelled_at),
      reason: row.reason,
    })),
  };
}

const movementTables: Record<FinancialMovementType, string> = {
  contribution: "fund_contributions",
  refund: "refunds",
  reimbursement: "reimbursements",
  transfer: "fund_transfers",
  "balance-check": "fund_balance_checks",
  adjustment: "fund_adjustments",
};

export async function setFinancialMovementCancellation(
  entityType: FinancialMovementType,
  entityId: string,
  reason: string | null,
): Promise<void> {
  const database = await openHouseFundDatabase();
  if (entityType === "contribution" && reason !== null) {
    const linkedOccurrences = await database.select<Array<{ total: number }>>(
      "SELECT COUNT(*) AS total FROM recurring_contribution_occurrences WHERE fund_contribution_id = ?",
      [entityId],
    );
    if ((linkedOccurrences[0]?.total ?? 0) > 0) {
      throw new Error("This contribution belongs to the weekly schedule. Change its status in Bills & Contributions instead.");
    }
  }
  if (reason === null) {
    await database.execute("DELETE FROM financial_movement_cancellations WHERE entity_type = ? AND entity_id = ?", [entityType, entityId]);
    return;
  }
  await database.execute(
    `INSERT INTO financial_movement_cancellations (entity_type, entity_id, cancelled_at, reason) VALUES (?, ?, ?, ?)
     ON CONFLICT(entity_type, entity_id) DO UPDATE SET cancelled_at=excluded.cancelled_at, reason=excluded.reason`,
    [entityType, entityId, formatDateOnly(new Date()), reason],
  );
}

export async function deleteFinancialMovement(entityType: FinancialMovementType, entityId: string): Promise<void> {
  const database = await openHouseFundDatabase();
  if (entityType === "contribution") {
    const linkedOccurrences = await database.select<Array<{ total: number }>>(
      "SELECT COUNT(*) AS total FROM recurring_contribution_occurrences WHERE fund_contribution_id = ?",
      [entityId],
    );
    if ((linkedOccurrences[0]?.total ?? 0) > 0) {
      throw new Error("This contribution belongs to the weekly schedule. Change its status in Bills & Contributions instead.");
    }
  }
  const attachmentEntityType = entityType === "adjustment" ? "fund-adjustment" : entityType;
  const attachments = await database.select<Array<{ file_path: string }>>(
    "SELECT file_path FROM attachments WHERE entity_type = ? AND entity_id = ?",
    [attachmentEntityType, entityId],
  );
  await executeDatabaseTransaction([
    { sql: "DELETE FROM financial_movement_cancellations WHERE entity_type = ? AND entity_id = ?", values: [entityType, entityId] },
    { sql: "DELETE FROM attachments WHERE entity_type = ? AND entity_id = ?", values: [attachmentEntityType, entityId] },
    { sql: `DELETE FROM ${movementTables[entityType]} WHERE id = ?`, values: [entityId] },
  ]);
  await removeStoredAttachments(attachments.map((attachment) => attachment.file_path));
}

export async function saveFundContribution(value: FundContribution): Promise<void> {
  const database = await openHouseFundDatabase();
  await database.execute(
    `INSERT INTO fund_contributions (id, contribution_date, fund_source_id, contributor_person_id, amount_cents, notes)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET contribution_date=excluded.contribution_date, fund_source_id=excluded.fund_source_id,
     contributor_person_id=excluded.contributor_person_id, amount_cents=excluded.amount_cents, notes=excluded.notes`,
    [value.id, dateOnly(value.date), value.fundSourceId, value.contributorPersonId, cents(value.amount), value.notes],
  );
}

export async function saveFundTransfer(value: FundTransfer): Promise<void> {
  const database = await openHouseFundDatabase();
  await database.execute(
    `INSERT INTO fund_transfers (id, transfer_date, from_payment_source_id, to_payment_source_id, amount_cents, notes)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET transfer_date=excluded.transfer_date, from_payment_source_id=excluded.from_payment_source_id,
     to_payment_source_id=excluded.to_payment_source_id, amount_cents=excluded.amount_cents, notes=excluded.notes`,
    [value.id, dateOnly(value.date), value.fromPaymentSourceId, value.toPaymentSourceId, cents(value.amount), value.notes],
  );
}

export async function saveFundBalanceCheck(value: FundBalanceCheck): Promise<void> {
  const database = await openHouseFundDatabase();
  await database.execute(
    `INSERT INTO fund_balance_checks (id, fund_source_id, counted_amount_cents, checked_at, notes) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET fund_source_id=excluded.fund_source_id, counted_amount_cents=excluded.counted_amount_cents,
     checked_at=excluded.checked_at, notes=excluded.notes`,
    [value.id, value.fundSourceId, cents(value.countedAmount), dateOnly(value.checkedAt), value.notes],
  );
}

export async function saveFundAdjustment(value: FundAdjustment): Promise<void> {
  const database = await openHouseFundDatabase();
  const previousAttachments = await database.select<Array<{ file_path: string }>>(
    "SELECT file_path FROM attachments WHERE entity_type = 'fund-adjustment' AND entity_id = ?",
    [value.id],
  );
  const statements: DatabaseStatement[] = [
    {
      sql: `INSERT INTO fund_adjustments (id, fund_source_id, adjustment_date, amount_cents, direction, reason, allocation_kind, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET fund_source_id=excluded.fund_source_id, adjustment_date=excluded.adjustment_date,
     amount_cents=excluded.amount_cents, direction=excluded.direction, reason=excluded.reason,
     allocation_kind=excluded.allocation_kind, notes=excluded.notes`,
      values: [
        value.id,
        value.fundSourceId,
        dateOnly(value.date),
        cents(value.amount),
        value.direction,
        value.reason,
        value.allocationKind,
        value.notes,
      ],
    },
    { sql: "DELETE FROM fund_adjustment_splits WHERE fund_adjustment_id = ?", values: [value.id] },
    { sql: "DELETE FROM attachments WHERE entity_type = 'fund-adjustment' AND entity_id = ?", values: [value.id] },
  ];
  for (const personId of value.splitBetweenPersonIds) {
    statements.push({
      sql: "INSERT INTO fund_adjustment_splits (fund_adjustment_id, person_id) VALUES (?, ?)",
      values: [value.id, personId],
    });
  }
  for (const filePath of value.attachmentPaths)
    statements.push({
      sql: "INSERT INTO attachments (id, entity_type, entity_id, file_path, original_file_name, created_at) VALUES (?, 'fund-adjustment', ?, ?, ?, ?)",
      values: [crypto.randomUUID(), value.id, filePath, filePath.split("/").at(-1) ?? filePath, new Date().toISOString()],
    });
  await executeDatabaseTransaction(statements);
  await removeStoredAttachments(previousAttachments.map((row) => row.file_path).filter((path) => !value.attachmentPaths.includes(path)));
}

export async function saveAfterpayPayment(value: AfterpayPayment): Promise<void> {
  const database = await openHouseFundDatabase();
  await database.execute(
    `INSERT INTO afterpay_payments
      (id, afterpay_source_id, payment_date, amount_cents, paid_from_payment_source_id, notes)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET afterpay_source_id=excluded.afterpay_source_id,
       payment_date=excluded.payment_date, amount_cents=excluded.amount_cents,
       paid_from_payment_source_id=excluded.paid_from_payment_source_id, notes=excluded.notes`,
    [value.id, value.afterpaySourceId, dateOnly(value.date), cents(value.amount), value.paidFromPaymentSourceId, value.notes],
  );
}

export async function deleteAfterpayPayment(paymentId: string): Promise<void> {
  const database = await openHouseFundDatabase();
  await database.execute("DELETE FROM afterpay_payments WHERE id = ?", [paymentId]);
}

export async function saveRefund(value: Refund): Promise<void> {
  const database = await openHouseFundDatabase();
  const previousAttachments = await database.select<Array<{ file_path: string }>>(
    "SELECT file_path FROM attachments WHERE entity_type = 'refund' AND entity_id = ?",
    [value.id],
  );
  const statements: DatabaseStatement[] = [
    {
      sql: `INSERT INTO refunds (id, refund_date, merchant, amount_cents, received_to_payment_source_id, original_purchase_id, original_purchase_item_id, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET refund_date=excluded.refund_date, merchant=excluded.merchant, amount_cents=excluded.amount_cents,
     received_to_payment_source_id=excluded.received_to_payment_source_id, original_purchase_id=excluded.original_purchase_id,
     original_purchase_item_id=excluded.original_purchase_item_id, notes=excluded.notes`,
      values: [
        value.id,
        dateOnly(value.date),
        value.merchant,
        cents(value.amount),
        value.receivedToPaymentSourceId,
        value.originalPurchaseId,
        value.originalPurchaseItemId,
        value.notes,
      ],
    },
    { sql: "DELETE FROM refund_beneficiaries WHERE refund_id=?", values: [value.id] },
  ];
  for (const personId of value.beneficiaryPersonIds) {
    statements.push({ sql: "INSERT INTO refund_beneficiaries (refund_id, person_id) VALUES (?, ?)", values: [value.id, personId] });
  }
  statements.push({ sql: "DELETE FROM attachments WHERE entity_type = 'refund' AND entity_id = ?", values: [value.id] });
  for (const filePath of value.attachmentPaths)
    statements.push({
      sql: "INSERT INTO attachments (id, entity_type, entity_id, file_path, original_file_name, created_at) VALUES (?, 'refund', ?, ?, ?, ?)",
      values: [crypto.randomUUID(), value.id, filePath, filePath.split("/").at(-1) ?? filePath, new Date().toISOString()],
    });
  await executeDatabaseTransaction(statements);
  await removeStoredAttachments(previousAttachments.map((row) => row.file_path).filter((path) => !value.attachmentPaths.includes(path)));
}

export async function saveReimbursement(value: Reimbursement, settlementPeriodId?: string): Promise<void> {
  const statements: DatabaseStatement[] = [
    {
      sql: `INSERT INTO reimbursements (id, reimbursement_date, from_person_id, to_person_id, amount_cents, payment_source_id, applies_to, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET reimbursement_date=excluded.reimbursement_date, from_person_id=excluded.from_person_id,
     to_person_id=excluded.to_person_id, amount_cents=excluded.amount_cents, payment_source_id=excluded.payment_source_id,
     applies_to=excluded.applies_to, notes=excluded.notes`,
      values: [
        value.id,
        dateOnly(value.date),
        value.fromPersonId,
        value.toPersonId,
        cents(value.amount),
        value.paymentSourceId,
        value.appliesTo,
        value.notes,
      ],
    },
    { sql: "DELETE FROM reimbursement_purchases WHERE reimbursement_id=?", values: [value.id] },
  ];
  for (const purchaseId of value.relatedPurchaseIds) {
    statements.push({
      sql: "INSERT INTO reimbursement_purchases (reimbursement_id, purchase_id) VALUES (?, ?)",
      values: [value.id, purchaseId],
    });
  }
  if (settlementPeriodId) {
    statements.push({
      sql: `INSERT INTO settlement_payments (id, settlement_period_id, reimbursement_id, created_at)
        VALUES (?, ?, ?, ?)`,
      values: [crypto.randomUUID(), settlementPeriodId, value.id, new Date().toISOString()],
    });
  }
  await executeDatabaseTransaction(statements);
}
