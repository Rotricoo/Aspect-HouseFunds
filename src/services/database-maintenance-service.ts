import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { openHouseFundDatabase } from "../database/connection";
import { todayDateOnly } from "../utils/date-only";

export interface AttachmentMigrationReport {
  migrated: number;
  alreadyManaged: number;
  missingFileNames: string[];
}

function today(): string {
  return todayDateOnly();
}

export async function migrateLegacyAttachments(): Promise<AttachmentMigrationReport> {
  return invoke<AttachmentMigrationReport>("migrate_legacy_attachments");
}

export async function createDatabaseBackup(): Promise<string | null> {
  const destinationPath = await save({
    title: "Back up Aspect - House Funds database",
    defaultPath: `aspect-house-funds-backup-${today()}.db`,
    filters: [{ name: "Aspect - House Funds SQLite backup", extensions: ["db"] }],
  });
  if (!destinationPath) return null;

  await invoke("create_database_backup", { destinationPath });
  return destinationPath;
}

export async function createAutomaticBackup(retentionCount: number): Promise<string> {
  return invoke<string>("create_automatic_backup", { retentionCount });
}

function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export async function exportFinancialLedgerCsv(): Promise<string | null> {
  const destinationPath = await save({
    title: "Export Aspect - House Funds financial ledger",
    defaultPath: `aspect-house-funds-ledger-${today()}.csv`,
    filters: [{ name: "CSV spreadsheet", extensions: ["csv"] }],
  });
  if (!destinationPath) return null;

  const database = await openHouseFundDatabase();
  const rows = await database.select<
    Array<{ event_date: string | null; event_type: string; description: string; amount_cents: number; source: string | null }>
  >(`
    SELECT purchase_date AS event_date, 'purchase' AS event_type, merchant AS description,
      -receipt_total_cents AS amount_cents, payment_source_id AS source FROM purchases
    UNION ALL
    SELECT contribution_date, 'contribution', 'Contribution by ' || contributor_person_id,
      amount_cents, fund_source_id FROM fund_contributions
    UNION ALL
    SELECT refund_date, 'refund', merchant, amount_cents, received_to_payment_source_id FROM refunds
    UNION ALL
    SELECT reimbursement_date, 'reimbursement', from_person_id || ' to ' || to_person_id,
      amount_cents, payment_source_id FROM reimbursements
    UNION ALL
    SELECT transfer_date, 'transfer', from_payment_source_id || ' to ' || to_payment_source_id,
      amount_cents, to_payment_source_id FROM fund_transfers
    UNION ALL
    SELECT adjustment_date, 'adjustment', reason,
      CASE direction WHEN 'increase' THEN amount_cents ELSE -amount_cents END, fund_source_id FROM fund_adjustments
    UNION ALL
    SELECT payment_date, 'afterpay-payment', 'Afterpay payment', -amount_cents,
      paid_from_payment_source_id FROM afterpay_payments
    ORDER BY event_date, event_type
  `);
  const csv = [
    ["Date", "Type", "Description", "Amount", "Payment source"].map(csvCell).join(","),
    ...rows.map((row) =>
      [row.event_date, row.event_type, row.description, (row.amount_cents / 100).toFixed(2), row.source].map(csvCell).join(","),
    ),
  ].join("\n");
  await invoke("write_export_file", { destinationPath, contents: csv });
  return destinationPath;
}

export async function restoreDatabaseBackup(): Promise<string | null> {
  const sourcePath = await open({
    title: "Restore Aspect - House Funds database",
    multiple: false,
    directory: false,
    filters: [{ name: "Aspect - House Funds SQLite backup", extensions: ["db"] }],
  });
  if (!sourcePath || Array.isArray(sourcePath)) return null;

  const database = await openHouseFundDatabase();
  await database.close();
  await invoke("restore_database_backup", { sourcePath });
  return sourcePath;
}
