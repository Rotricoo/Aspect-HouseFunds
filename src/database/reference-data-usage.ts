import type Database from "@tauri-apps/plugin-sql";

export async function countPersonUsage(database: Database, personId: string): Promise<number> {
  const result = await database.select<Array<{ total: number }>>(
    `SELECT
      (SELECT COUNT(*) FROM purchase_item_owners WHERE person_id = ?) +
      (SELECT COUNT(*) FROM purchase_item_splits WHERE person_id = ?) +
      (SELECT COUNT(*) FROM purchase_rounding_splits WHERE person_id = ?) +
      (SELECT COUNT(*) FROM fund_contributions WHERE contributor_person_id = ?) +
      (SELECT COUNT(*) FROM reimbursements WHERE from_person_id = ? OR to_person_id = ?) +
      (SELECT COUNT(*) FROM refund_beneficiaries WHERE person_id = ?) +
      (SELECT COUNT(*) FROM recurring_bill_splits WHERE person_id = ?) +
      (SELECT COUNT(*) FROM recurring_contribution_plan_members WHERE person_id = ?) +
      (SELECT COUNT(*) FROM recurring_contribution_occurrences WHERE person_id = ?) +
      (SELECT COUNT(*) FROM fund_adjustment_splits WHERE person_id = ?) AS total`,
    Array.from({ length: 11 }, () => personId),
  );
  return result[0]?.total ?? 0;
}

export async function countPaymentSourceUsage(database: Database, sourceId: string): Promise<number> {
  const result = await database.select<Array<{ total: number }>>(
    `SELECT
      (SELECT COUNT(*) FROM purchases WHERE payment_source_id = ?) +
      (SELECT COUNT(*) FROM fund_contributions WHERE fund_source_id = ?) +
      (SELECT COUNT(*) FROM fund_transfers WHERE from_payment_source_id = ? OR to_payment_source_id = ?) +
      (SELECT COUNT(*) FROM reimbursements WHERE payment_source_id = ?) +
      (SELECT COUNT(*) FROM refunds WHERE received_to_payment_source_id = ?) +
      (SELECT COUNT(*) FROM fund_balance_checks WHERE fund_source_id = ?) +
      (SELECT COUNT(*) FROM fund_adjustments WHERE fund_source_id = ?) +
      (SELECT COUNT(*) FROM recurring_bills WHERE default_payment_source_id = ?) +
      (SELECT COUNT(*) FROM recurring_bill_occurrences WHERE payment_source_id = ?) +
      (SELECT COUNT(*) FROM recurring_contribution_plans WHERE destination_fund_source_id = ?) +
      (SELECT COUNT(*) FROM payment_installments WHERE afterpay_source_id = ? OR paid_from_payment_source_id = ?) +
      (SELECT COUNT(*) FROM afterpay_payments WHERE afterpay_source_id = ? OR paid_from_payment_source_id = ?) AS total`,
    Array.from({ length: 15 }, () => sourceId),
  );
  return result[0]?.total ?? 0;
}

export async function countCategoryUsage(database: Database, categoryId: string, categoryName: string): Promise<number> {
  const result = await database.select<Array<{ total: number }>>(
    `SELECT (SELECT COUNT(*) FROM purchase_items WHERE category_id = ? OR (category_id IS NULL AND category = ? COLLATE NOCASE))
      + (SELECT COUNT(*) FROM recurring_bills WHERE category_id = ? OR (category_id IS NULL AND category = ? COLLATE NOCASE)) AS total`,
    [categoryId, categoryName, categoryId, categoryName],
  );
  return result[0]?.total ?? 0;
}

export async function countSettlementGroupHistory(database: Database, groupId: string): Promise<number> {
  return countRows(database, "SELECT COUNT(*) AS total FROM settlement_snapshot_transfers WHERE from_group_id = ? OR to_group_id = ?", [
    groupId,
    groupId,
  ]);
}

async function countRows(database: Database, query: string, values: unknown[]): Promise<number> {
  const result = await database.select<Array<{ total: number }>>(query, values);
  return result[0]?.total ?? 0;
}
