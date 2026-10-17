import type Database from "@tauri-apps/plugin-sql";
import type { Purchase } from "../types/purchase";
import type { PersonId } from "../types/person-id";
import type {
  RecurringBill,
  RecurringBillOccurrence,
  RecurringContributionOccurrence,
  RecurringContributionPlan,
} from "../types/recurring-bill";
import { openHouseFundDatabase } from "./connection";
import { removeStoredAttachments, type StoredAttachment } from "../services/attachment-service";
import { executeDatabaseTransaction, type DatabaseStatement } from "./database-transaction";
import { formatDateOnly, parseDateOnly } from "../utils/date-only";
import {
  buildBillOccurrenceStatements,
  buildContributionOccurrenceStatements,
  type BillOccurrenceSeed,
  type ContributionOccurrenceSeed,
} from "./recurring-schedule-generator";

interface RecurringBillRow {
  id: string;
  name: string;
  merchant: string;
  category: string;
  category_id: string | null;
  frequency: RecurringBill["frequency"];
  default_amount_cents: number | null;
  default_payment_source_id: string;
  preferred_payment_lead_days: number;
  starts_on: string;
  ends_on: string | null;
  is_active: number;
  notes: string | null;
}

interface OccurrenceRow {
  id: string;
  recurring_bill_id: string;
  period_start_date: string;
  period_end_date: string;
  due_date: string;
  amount_cents: number;
  status: RecurringBillOccurrence["status"];
  paid_date: string | null;
  payment_source_id: string | null;
  purchase_id: string | null;
  notes: string | null;
  is_generated: number;
  is_manually_overridden: number;
}

interface ContributionPlanRow {
  id: string;
  name: string;
  frequency: RecurringContributionPlan["frequency"];
  amount_per_person_cents: number;
  destination_fund_source_id: string;
  starts_on: string;
  is_active: number;
  notes: string | null;
}

interface ContributionOccurrenceRow {
  id: string;
  recurring_contribution_plan_id: string;
  person_id: PersonId;
  due_date: string;
  amount_cents: number;
  status: RecurringContributionOccurrence["status"];
  paid_date: string | null;
  fund_contribution_id: string | null;
  notes: string | null;
  is_generated: number;
  is_manually_overridden: number;
}

interface RelationRow {
  parent_id: string;
  person_id: PersonId;
}

async function ensureRecurringOccurrences(database: Database): Promise<void> {
  const bills = await database.select<RecurringBillRow[]>("SELECT * FROM recurring_bills WHERE is_active = 1");
  const occurrences = await database.select<OccurrenceRow[]>("SELECT * FROM recurring_bill_occurrences ORDER BY period_start_date");
  const statements: DatabaseStatement[] = [
    {
      sql: "UPDATE recurring_bill_occurrences SET status = 'overdue' WHERE status = 'scheduled' AND due_date < ?",
      values: [formatDateOnly(new Date())],
    },
  ];

  for (const bill of bills) {
    const existing = occurrences.filter((occurrence) => occurrence.recurring_bill_id === bill.id);
    statements.push(
      ...buildBillOccurrenceStatements(
        {
          id: bill.id,
          name: bill.name,
          merchant: bill.merchant,
          category: bill.category,
          frequency: bill.frequency,
          defaultAmount: bill.default_amount_cents === null ? null : fromCents(bill.default_amount_cents),
          defaultPaymentSourceId: bill.default_payment_source_id,
          splitBetweenPersonIds: [],
          preferredPaymentLeadDays: bill.preferred_payment_lead_days,
          startsOn: parseDateOnly(bill.starts_on),
          endsOn: bill.ends_on ? parseDateOnly(bill.ends_on) : null,
          isActive: Boolean(bill.is_active),
          notes: bill.notes,
        },
        existing.at(-1)
          ? {
              recurringBillId: existing.at(-1)!.recurring_bill_id,
              periodStartDate: existing.at(-1)!.period_start_date,
              periodEndDate: existing.at(-1)!.period_end_date,
              dueDate: existing.at(-1)!.due_date,
            }
          : null,
      ),
    );
  }

  if (statements.length > 0) await executeDatabaseTransaction(statements);
}

async function ensureRecurringContributionOccurrences(database: Database): Promise<void> {
  const [plans, members, existing] = await Promise.all([
    database.select<ContributionPlanRow[]>("SELECT * FROM recurring_contribution_plans WHERE is_active = 1"),
    database.select<RelationRow[]>(
      "SELECT recurring_contribution_plan_id AS parent_id, person_id FROM recurring_contribution_plan_members",
    ),
    database.select<ContributionOccurrenceRow[]>("SELECT * FROM recurring_contribution_occurrences"),
  ]);
  const peopleByPlan = groupPeople(members);
  const today = new Date();
  const statements: DatabaseStatement[] = [
    {
      sql: "UPDATE recurring_contribution_occurrences SET status = 'overdue' WHERE status = 'scheduled' AND due_date < ?",
      values: [formatDateOnly(today)],
    },
  ];

  for (const plan of plans) {
    for (const personId of peopleByPlan.get(plan.id) ?? []) {
      const personOccurrences = existing
        .filter((occurrence) => occurrence.recurring_contribution_plan_id === plan.id && occurrence.person_id === personId)
        .sort((first, second) => first.due_date.localeCompare(second.due_date));
      statements.push(
        ...buildContributionOccurrenceStatements(
          {
            id: plan.id,
            name: plan.name,
            frequency: plan.frequency,
            amountPerPerson: fromCents(plan.amount_per_person_cents),
            contributorPersonIds: peopleByPlan.get(plan.id) ?? [],
            destinationFundSourceId: plan.destination_fund_source_id,
            startsOn: parseDateOnly(plan.starts_on),
            isActive: Boolean(plan.is_active),
            notes: plan.notes,
          },
          personId,
          personOccurrences.at(-1)
            ? {
                recurringContributionPlanId: personOccurrences.at(-1)!.recurring_contribution_plan_id,
                personId: personOccurrences.at(-1)!.person_id,
                dueDate: personOccurrences.at(-1)!.due_date,
              }
            : null,
        ),
      );
    }
  }
  await executeDatabaseTransaction(statements);
}

export interface RecurringData {
  bills: RecurringBill[];
  occurrences: RecurringBillOccurrence[];
  contributionPlans: RecurringContributionPlan[];
  contributionOccurrences: RecurringContributionOccurrence[];
  linkedPurchases: Purchase[];
}

export interface SaveRecurringOccurrenceInput {
  bill: RecurringBill;
  occurrence: RecurringBillOccurrence;
  attachments: StoredAttachment[];
}

function toDate(value: string): Date {
  return parseDateOnly(value);
}

function toDateOnly(date: Date): string {
  return formatDateOnly(date);
}

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function fromCents(amount: number): number {
  return amount / 100;
}

function groupPeople(rows: RelationRow[]): Map<string, PersonId[]> {
  const grouped = new Map<string, PersonId[]>();
  for (const row of rows) {
    grouped.set(row.parent_id, [...(grouped.get(row.parent_id) ?? []), row.person_id]);
  }
  return grouped;
}

export function createPurchaseFromRecurringOccurrence(bill: RecurringBill, occurrence: RecurringBillOccurrence): Purchase {
  const purchaseId = occurrence.purchaseId ?? occurrence.id;
  return {
    id: purchaseId,
    date: occurrence.paidDate ?? occurrence.dueDate,
    merchant: bill.merchant,
    receiptTotal: occurrence.amount,
    paymentSourceId: occurrence.paymentSourceId ?? bill.defaultPaymentSourceId,
    receiptItemCount: 1,
    receiptRoundingAdjustment: 0,
    receiptRoundingSplitBetweenPersonIds: [],
    attachmentPaths: [],
    items: [
      {
        id: `${purchaseId}-charge`,
        name: bill.name,
        description: `${bill.name} for ${toDateOnly(occurrence.periodStartDate)} to ${toDateOnly(occurrence.periodEndDate)}`,
        quantity: 1,
        unitPrice: occurrence.amount,
        totalAmount: occurrence.amount,
        category: bill.category,
        ownership: "household",
        ownerPersonIds: [],
        splitBetweenPersonIds: bill.splitBetweenPersonIds,
        notes: occurrence.notes,
      },
    ],
    notes: occurrence.notes,
  };
}

async function loadPurchasesFromDatabase(database: Database, purchaseIds?: string[]): Promise<Purchase[]> {
  if (purchaseIds && purchaseIds.length === 0) return [];
  const placeholders = purchaseIds?.map(() => "?").join(", ") ?? "";
  const purchaseFilter = purchaseIds ? ` WHERE id IN (${placeholders})` : "";
  const itemFilter = purchaseIds ? ` WHERE purchase_id IN (${placeholders})` : "";
  const purchaseRows = await database.select<
    Array<{
      id: string;
      purchase_date: string;
      merchant: string;
      receipt_total_cents: number;
      payment_source_id: string;
      receipt_item_count: number | null;
      items_are_consolidated: number;
      receipt_rounding_adjustment_cents: number;
      notes: string | null;
    }>
  >(`SELECT * FROM purchases${purchaseFilter}`, purchaseIds ?? []);
  const itemRows = await database.select<
    Array<{
      id: string;
      purchase_id: string;
      name: string;
      description: string;
      quantity: number;
      unit_price_cents: number;
      total_amount_cents: number;
      category: string;
      category_id: string | null;
      ownership: "household" | "personal";
      notes: string | null;
    }>
  >(`SELECT * FROM purchase_items${itemFilter}`, purchaseIds ?? []);
  const itemIds = itemRows.map((item) => item.id);
  const itemPlaceholders = itemIds.map(() => "?").join(", ");
  const splitRows =
    itemIds.length === 0
      ? []
      : await database.select<Array<{ purchase_item_id: string; person_id: string }>>(
          `SELECT * FROM purchase_item_splits WHERE purchase_item_id IN (${itemPlaceholders})`,
          itemIds,
        );
  const ownerRows =
    itemIds.length === 0
      ? []
      : await database.select<Array<{ purchase_item_id: string; person_id: string }>>(
          `SELECT * FROM purchase_item_owners WHERE purchase_item_id IN (${itemPlaceholders})`,
          itemIds,
        );
  const roundingRows = purchaseIds
    ? await database.select<Array<{ purchase_id: string; person_id: string }>>(
        `SELECT * FROM purchase_rounding_splits WHERE purchase_id IN (${placeholders})`,
        purchaseIds,
      )
    : await database.select<Array<{ purchase_id: string; person_id: string }>>("SELECT * FROM purchase_rounding_splits");
  const attachmentRows = purchaseIds
    ? await database.select<Array<{ entity_id: string; file_path: string }>>(
        `SELECT entity_id, file_path FROM attachments WHERE entity_type = 'purchase' AND entity_id IN (${placeholders})`,
        purchaseIds,
      )
    : await database.select<Array<{ entity_id: string; file_path: string }>>(
        "SELECT entity_id, file_path FROM attachments WHERE entity_type = 'purchase'",
      );

  return purchaseRows.map((purchase) => ({
    id: purchase.id,
    date: toDate(purchase.purchase_date),
    merchant: purchase.merchant,
    receiptTotal: fromCents(purchase.receipt_total_cents),
    paymentSourceId: purchase.payment_source_id,
    receiptItemCount: purchase.receipt_item_count,
    itemsAreConsolidated: Boolean(purchase.items_are_consolidated),
    receiptRoundingAdjustment: fromCents(purchase.receipt_rounding_adjustment_cents),
    receiptRoundingSplitBetweenPersonIds: roundingRows.filter((row) => row.purchase_id === purchase.id).map((row) => row.person_id),
    attachmentPaths: attachmentRows.filter((row) => row.entity_id === purchase.id).map((row) => row.file_path),
    notes: purchase.notes,
    items: itemRows
      .filter((item) => item.purchase_id === purchase.id)
      .map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        quantity: item.quantity,
        unitPrice: fromCents(item.unit_price_cents),
        totalAmount: fromCents(item.total_amount_cents),
        category: item.category,
        categoryId: item.category_id,
        ownership: item.ownership,
        ownerPersonIds: ownerRows.filter((row) => row.purchase_item_id === item.id).map((row) => row.person_id),
        splitBetweenPersonIds: splitRows.filter((row) => row.purchase_item_id === item.id).map((row) => row.person_id),
        notes: item.notes,
      })),
  }));
}

export async function loadAllPurchases(): Promise<Purchase[]> {
  return loadPurchasesFromDatabase(await openHouseFundDatabase());
}

export async function savePurchase(purchase: Purchase): Promise<void> {
  const database = await openHouseFundDatabase();
  const categoryRows = await database.select<Array<{ id: string; name: string }>>("SELECT id, name FROM categories");
  const categoryIdByName = new Map(categoryRows.map((category) => [category.name.toLocaleLowerCase(), category.id]));
  const previousAttachments = await database.select<Array<{ file_path: string }>>(
    "SELECT file_path FROM attachments WHERE entity_type = 'purchase' AND entity_id = ?",
    [purchase.id],
  );
  const statements: DatabaseStatement[] = [
    {
      sql: `INSERT INTO purchases (id, purchase_date, merchant, receipt_total_cents, payment_source_id, receipt_item_count, items_are_consolidated, receipt_rounding_adjustment_cents, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET purchase_date=excluded.purchase_date, merchant=excluded.merchant,
     receipt_total_cents=excluded.receipt_total_cents, payment_source_id=excluded.payment_source_id,
     receipt_item_count=excluded.receipt_item_count, items_are_consolidated=excluded.items_are_consolidated,
     receipt_rounding_adjustment_cents=excluded.receipt_rounding_adjustment_cents, notes=excluded.notes`,
      values: [
        purchase.id,
        toDateOnly(purchase.date),
        purchase.merchant,
        toCents(purchase.receiptTotal),
        purchase.paymentSourceId,
        purchase.receiptItemCount,
        purchase.itemsAreConsolidated ? 1 : 0,
        toCents(purchase.receiptRoundingAdjustment),
        purchase.notes,
      ],
    },
    { sql: "DELETE FROM purchase_items WHERE purchase_id = ?", values: [purchase.id] },
  ];
  for (const item of purchase.items) {
    statements.push({
      sql: `INSERT INTO purchase_items (id, purchase_id, name, description, quantity, unit_price_cents, total_amount_cents, category, category_id, ownership, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values: [
        item.id,
        purchase.id,
        item.name,
        item.description,
        item.quantity,
        toCents(item.unitPrice),
        toCents(item.totalAmount),
        item.category,
        item.categoryId ?? categoryIdByName.get(item.category.trim().toLocaleLowerCase()) ?? null,
        item.ownership,
        item.notes,
      ],
    });
    for (const personId of item.ownerPersonIds) {
      statements.push({ sql: "INSERT INTO purchase_item_owners (purchase_item_id, person_id) VALUES (?, ?)", values: [item.id, personId] });
    }
    for (const personId of item.splitBetweenPersonIds) {
      statements.push({ sql: "INSERT INTO purchase_item_splits (purchase_item_id, person_id) VALUES (?, ?)", values: [item.id, personId] });
    }
  }
  statements.push({ sql: "DELETE FROM purchase_rounding_splits WHERE purchase_id = ?", values: [purchase.id] });
  for (const personId of purchase.receiptRoundingSplitBetweenPersonIds) {
    statements.push({
      sql: "INSERT INTO purchase_rounding_splits (purchase_id, person_id) VALUES (?, ?)",
      values: [purchase.id, personId],
    });
  }
  statements.push({ sql: "DELETE FROM attachments WHERE entity_type = 'purchase' AND entity_id = ?", values: [purchase.id] });
  for (const filePath of purchase.attachmentPaths) {
    statements.push({
      sql: "INSERT INTO attachments (id, entity_type, entity_id, file_path, original_file_name, created_at) VALUES (?, 'purchase', ?, ?, ?, ?)",
      values: [crypto.randomUUID(), purchase.id, filePath, filePath.split("/").at(-1) ?? filePath, new Date().toISOString()],
    });
  }
  await executeDatabaseTransaction(statements);
  await removeStoredAttachments(previousAttachments.map((row) => row.file_path).filter((path) => !purchase.attachmentPaths.includes(path)));
}

export async function deletePurchase(purchaseId: string): Promise<void> {
  const database = await openHouseFundDatabase();
  const attachmentRows = await database.select<Array<{ file_path: string }>>(
    "SELECT file_path FROM attachments WHERE entity_type = 'purchase' AND entity_id = ?",
    [purchaseId],
  );
  await executeDatabaseTransaction([
    { sql: "DELETE FROM attachments WHERE entity_type = 'purchase' AND entity_id = ?", values: [purchaseId] },
    { sql: "DELETE FROM purchases WHERE id = ?", values: [purchaseId] },
  ]);
  await removeStoredAttachments(attachmentRows.map((attachment) => attachment.file_path));
}

export async function loadRecurringData(): Promise<RecurringData> {
  const database = await openHouseFundDatabase();
  await ensureRecurringOccurrences(database);
  await ensureRecurringContributionOccurrences(database);
  const [billRows, billSplitRows, occurrenceRows, planRows, planMemberRows, contributionOccurrenceRows] = await Promise.all([
    database.select<RecurringBillRow[]>("SELECT * FROM recurring_bills ORDER BY starts_on, name"),
    database.select<RelationRow[]>("SELECT recurring_bill_id AS parent_id, person_id FROM recurring_bill_splits"),
    database.select<OccurrenceRow[]>("SELECT * FROM recurring_bill_occurrences ORDER BY due_date"),
    database.select<ContributionPlanRow[]>("SELECT * FROM recurring_contribution_plans ORDER BY starts_on"),
    database.select<RelationRow[]>(
      "SELECT recurring_contribution_plan_id AS parent_id, person_id FROM recurring_contribution_plan_members",
    ),
    database.select<ContributionOccurrenceRow[]>("SELECT * FROM recurring_contribution_occurrences ORDER BY due_date, person_id"),
  ]);
  const billPeople = groupPeople(billSplitRows);
  const planPeople = groupPeople(planMemberRows);
  const bills: RecurringBill[] = billRows.map((row) => ({
    id: row.id,
    name: row.name,
    merchant: row.merchant,
    category: row.category,
    categoryId: row.category_id,
    frequency: row.frequency,
    defaultAmount: row.default_amount_cents === null ? null : fromCents(row.default_amount_cents),
    defaultPaymentSourceId: row.default_payment_source_id,
    splitBetweenPersonIds: billPeople.get(row.id) ?? [],
    preferredPaymentLeadDays: row.preferred_payment_lead_days,
    startsOn: toDate(row.starts_on),
    endsOn: row.ends_on ? toDate(row.ends_on) : null,
    isActive: Boolean(row.is_active),
    notes: row.notes,
  }));
  const occurrences: RecurringBillOccurrence[] = occurrenceRows.map((row) => ({
    id: row.id,
    recurringBillId: row.recurring_bill_id,
    periodStartDate: toDate(row.period_start_date),
    periodEndDate: toDate(row.period_end_date),
    dueDate: toDate(row.due_date),
    amount: fromCents(row.amount_cents),
    status: row.status,
    paidDate: row.paid_date ? toDate(row.paid_date) : null,
    paymentSourceId: row.payment_source_id,
    purchaseId: row.purchase_id,
    notes: row.notes,
  }));
  const contributionPlans: RecurringContributionPlan[] = planRows.map((row) => ({
    id: row.id,
    name: row.name,
    frequency: row.frequency,
    amountPerPerson: fromCents(row.amount_per_person_cents),
    contributorPersonIds: planPeople.get(row.id) ?? [],
    destinationFundSourceId: row.destination_fund_source_id,
    startsOn: toDate(row.starts_on),
    isActive: Boolean(row.is_active),
    notes: row.notes,
  }));
  const contributionOccurrences: RecurringContributionOccurrence[] = contributionOccurrenceRows.map((row) => ({
    id: row.id,
    recurringContributionPlanId: row.recurring_contribution_plan_id,
    personId: row.person_id,
    dueDate: toDate(row.due_date),
    amount: fromCents(row.amount_cents),
    status: row.status,
    paidDate: row.paid_date ? toDate(row.paid_date) : null,
    fundContributionId: row.fund_contribution_id,
    notes: row.notes,
  }));
  const linkedPurchaseIds = occurrences.flatMap((occurrence) => (occurrence.purchaseId ? [occurrence.purchaseId] : []));
  return {
    bills,
    occurrences,
    contributionPlans,
    contributionOccurrences,
    linkedPurchases: await loadPurchasesFromDatabase(database, linkedPurchaseIds),
  };
}

export async function saveRecurringContributionOccurrence(
  occurrence: RecurringContributionOccurrence,
  plan: RecurringContributionPlan,
): Promise<RecurringContributionOccurrence> {
  const contributionId = occurrence.status === "paid" ? (occurrence.fundContributionId ?? `recurring-contribution-${occurrence.id}`) : null;
  const paidDate = occurrence.status === "paid" ? (occurrence.paidDate ?? occurrence.dueDate) : null;
  const statements: DatabaseStatement[] = [];
  const contributionIdToDelete = occurrence.status !== "paid" ? occurrence.fundContributionId : null;

  if (contributionId && paidDate) {
    statements.push({
      sql: `INSERT INTO fund_contributions (id, contribution_date, fund_source_id, contributor_person_id, amount_cents, notes)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET contribution_date=excluded.contribution_date, fund_source_id=excluded.fund_source_id,
        contributor_person_id=excluded.contributor_person_id, amount_cents=excluded.amount_cents, notes=excluded.notes`,
      values: [
        contributionId,
        toDateOnly(paidDate),
        plan.destinationFundSourceId,
        occurrence.personId,
        toCents(occurrence.amount),
        `Generated from ${plan.name}.`,
      ],
    });
  }

  statements.push({
    sql: `UPDATE recurring_contribution_occurrences
      SET amount_cents = ?, status = ?, paid_date = ?, fund_contribution_id = ?, notes = ?, is_manually_overridden = 1 WHERE id = ?`,
    values: [
      toCents(occurrence.amount),
      occurrence.status,
      paidDate ? toDateOnly(paidDate) : null,
      contributionId,
      occurrence.notes,
      occurrence.id,
    ],
  });
  if (contributionIdToDelete) {
    statements.push({ sql: "DELETE FROM fund_contributions WHERE id = ?", values: [contributionIdToDelete] });
  }
  await executeDatabaseTransaction(statements);
  return { ...occurrence, paidDate, fundContributionId: contributionId };
}

export async function saveRecurringBill(bill: RecurringBill, effectiveFrom = new Date()): Promise<void> {
  const database = await openHouseFundDatabase();
  const categoryRows = await database.select<Array<{ id: string; name: string }>>("SELECT id, name FROM categories");
  const categoryId =
    bill.categoryId ??
    categoryRows.find((category) => category.name.localeCompare(bill.category, undefined, { sensitivity: "accent" }) === 0)?.id ??
    null;
  const effectiveDate = toDateOnly(effectiveFrom);
  const previousRows = await database.select<BillOccurrenceSeed[]>(
    `SELECT recurring_bill_id AS recurringBillId, period_start_date AS periodStartDate,
      period_end_date AS periodEndDate, due_date AS dueDate
     FROM recurring_bill_occurrences WHERE recurring_bill_id = ? AND due_date < ? ORDER BY due_date DESC LIMIT 1`,
    [bill.id, effectiveDate],
  );
  const statements: DatabaseStatement[] = [
    {
      sql: `INSERT INTO recurring_bills
      (id, name, merchant, category, category_id, frequency, default_amount_cents, default_payment_source_id, preferred_payment_lead_days, starts_on, ends_on, is_active, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name=excluded.name, merchant=excluded.merchant, category=excluded.category, category_id=excluded.category_id,
      frequency=excluded.frequency, default_amount_cents=excluded.default_amount_cents,
      default_payment_source_id=excluded.default_payment_source_id, preferred_payment_lead_days=excluded.preferred_payment_lead_days,
      starts_on=excluded.starts_on, ends_on=excluded.ends_on, is_active=excluded.is_active, notes=excluded.notes`,
      values: [
        bill.id,
        bill.name,
        bill.merchant,
        bill.category,
        categoryId,
        bill.frequency,
        bill.defaultAmount === null ? null : toCents(bill.defaultAmount),
        bill.defaultPaymentSourceId,
        bill.preferredPaymentLeadDays,
        toDateOnly(bill.startsOn),
        bill.endsOn ? toDateOnly(bill.endsOn) : null,
        bill.isActive ? 1 : 0,
        bill.notes,
      ],
    },
    { sql: "DELETE FROM recurring_bill_splits WHERE recurring_bill_id = ?", values: [bill.id] },
  ];
  for (const personId of bill.splitBetweenPersonIds) {
    statements.push({ sql: "INSERT INTO recurring_bill_splits (recurring_bill_id, person_id) VALUES (?, ?)", values: [bill.id, personId] });
  }
  statements.push({
    sql: `DELETE FROM recurring_bill_occurrences
      WHERE recurring_bill_id = ? AND due_date >= ? AND is_generated = 1 AND is_manually_overridden = 0
        AND status IN ('scheduled', 'overdue', 'cancelled')`,
    values: [bill.id, effectiveDate],
  });
  statements.push(...buildBillOccurrenceStatements(bill, previousRows[0] ?? null));
  await executeDatabaseTransaction(statements);
}

export async function saveRecurringContributionPlan(plan: RecurringContributionPlan, effectiveFrom = new Date()): Promise<void> {
  const database = await openHouseFundDatabase();
  const effectiveDate = toDateOnly(effectiveFrom);
  const previousRows = await database.select<ContributionOccurrenceSeed[]>(
    `SELECT recurring_contribution_plan_id AS recurringContributionPlanId, person_id AS personId, due_date AS dueDate
     FROM recurring_contribution_occurrences WHERE recurring_contribution_plan_id = ? AND due_date < ? ORDER BY due_date`,
    [plan.id, effectiveDate],
  );
  const statements: DatabaseStatement[] = [
    {
      sql: `INSERT INTO recurring_contribution_plans
        (id, name, frequency, amount_per_person_cents, destination_fund_source_id, starts_on, is_active, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name, frequency=excluded.frequency,
        amount_per_person_cents=excluded.amount_per_person_cents,
        destination_fund_source_id=excluded.destination_fund_source_id,
        starts_on=excluded.starts_on, is_active=excluded.is_active, notes=excluded.notes`,
      values: [
        plan.id,
        plan.name,
        plan.frequency,
        toCents(plan.amountPerPerson),
        plan.destinationFundSourceId,
        toDateOnly(plan.startsOn),
        plan.isActive ? 1 : 0,
        plan.notes,
      ],
    },
    { sql: "DELETE FROM recurring_contribution_plan_members WHERE recurring_contribution_plan_id = ?", values: [plan.id] },
  ];
  for (const personId of plan.contributorPersonIds) {
    statements.push({
      sql: "INSERT INTO recurring_contribution_plan_members (recurring_contribution_plan_id, person_id) VALUES (?, ?)",
      values: [plan.id, personId],
    });
  }
  statements.push({
    sql: `DELETE FROM recurring_contribution_occurrences
      WHERE recurring_contribution_plan_id = ? AND due_date >= ? AND is_generated = 1 AND is_manually_overridden = 0
        AND status IN ('scheduled', 'overdue', 'cancelled')`,
    values: [plan.id, effectiveDate],
  });
  for (const personId of plan.contributorPersonIds) {
    const previous = previousRows.filter((row) => row.personId === personId).at(-1) ?? null;
    statements.push(...buildContributionOccurrenceStatements(plan, personId, previous));
  }
  await executeDatabaseTransaction(statements);
}

export async function deleteRecurringContributionPlan(planId: string): Promise<void> {
  const database = await openHouseFundDatabase();
  const rows = await database.select<Array<{ total: number }>>(
    "SELECT COUNT(*) AS total FROM recurring_contribution_occurrences WHERE recurring_contribution_plan_id = ?",
    [planId],
  );
  if ((rows[0]?.total ?? 0) > 0) throw new Error("A contribution plan with history cannot be deleted. Deactivate it instead.");
  await executeDatabaseTransaction([
    { sql: "DELETE FROM recurring_contribution_plan_members WHERE recurring_contribution_plan_id = ?", values: [planId] },
    { sql: "DELETE FROM recurring_contribution_plans WHERE id = ?", values: [planId] },
  ]);
}

export async function deleteRecurringBill(billId: string): Promise<void> {
  const database = await openHouseFundDatabase();
  const rows = await database.select<Array<{ total: number }>>(
    "SELECT COUNT(*) AS total FROM recurring_bill_occurrences WHERE recurring_bill_id = ?",
    [billId],
  );
  if ((rows[0]?.total ?? 0) > 0) throw new Error("A recurring bill with payment history cannot be deleted. Deactivate it instead.");
  await database.execute("DELETE FROM recurring_bills WHERE id = ?", [billId]);
}

export async function saveRecurringOccurrence({ bill, occurrence, attachments }: SaveRecurringOccurrenceInput) {
  const database = await openHouseFundDatabase();
  const statements: DatabaseStatement[] = [];
  let savedPurchase: Purchase | null = null;
  let purchaseId = occurrence.purchaseId;
  let removedPurchaseId: string | null = null;
  let removedAttachmentPaths: string[] = [];

  if (occurrence.status === "paid") {
    purchaseId ??= occurrence.id;
    const occurrenceWithPurchase = { ...occurrence, purchaseId };
    savedPurchase = createPurchaseFromRecurringOccurrence(bill, occurrenceWithPurchase);
    const existingItems = await database.select<Array<{ id: string }>>("SELECT id FROM purchase_items WHERE purchase_id = ? LIMIT 1", [
      purchaseId,
    ]);
    const itemId = existingItems[0]?.id ?? savedPurchase.items[0].id;
    savedPurchase.items[0].id = itemId;
    savedPurchase.attachmentPaths = attachments.map((attachment) => attachment.filePath);

    statements.push({
      sql: `INSERT INTO purchases (id, purchase_date, merchant, receipt_total_cents, payment_source_id, receipt_item_count, items_are_consolidated, receipt_rounding_adjustment_cents, notes)
       VALUES (?, ?, ?, ?, ?, 1, 0, 0, ?)
       ON CONFLICT(id) DO UPDATE SET purchase_date = excluded.purchase_date, merchant = excluded.merchant,
       receipt_total_cents = excluded.receipt_total_cents, payment_source_id = excluded.payment_source_id, notes = excluded.notes`,
      values: [
        purchaseId,
        toDateOnly(savedPurchase.date),
        savedPurchase.merchant,
        toCents(savedPurchase.receiptTotal),
        savedPurchase.paymentSourceId,
        savedPurchase.notes,
      ],
    });
    statements.push({
      sql: `INSERT INTO purchase_items (id, purchase_id, name, description, quantity, unit_price_cents, total_amount_cents, category, ownership, notes)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?, 'household', ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description, unit_price_cents = excluded.unit_price_cents,
       total_amount_cents = excluded.total_amount_cents, category = excluded.category, notes = excluded.notes`,
      values: [
        itemId,
        purchaseId,
        bill.name,
        savedPurchase.items[0].description,
        toCents(occurrence.amount),
        toCents(occurrence.amount),
        bill.category,
        occurrence.notes,
      ],
    });
    statements.push({ sql: "DELETE FROM purchase_item_splits WHERE purchase_item_id = ?", values: [itemId] });
    for (const personId of bill.splitBetweenPersonIds) {
      statements.push({ sql: "INSERT INTO purchase_item_splits (purchase_item_id, person_id) VALUES (?, ?)", values: [itemId, personId] });
    }
    for (const attachment of attachments) {
      statements.push({
        sql: "INSERT OR IGNORE INTO attachments (id, entity_type, entity_id, file_path, original_file_name, created_at) VALUES (?, 'purchase', ?, ?, ?, ?)",
        values: [crypto.randomUUID(), purchaseId, attachment.filePath, attachment.originalFileName, new Date().toISOString()],
      });
    }
  } else if (purchaseId) {
    removedPurchaseId = purchaseId;
    const attachmentRows = await database.select<Array<{ file_path: string }>>(
      "SELECT file_path FROM attachments WHERE entity_type = 'purchase' AND entity_id = ?",
      [purchaseId],
    );
    removedAttachmentPaths = attachmentRows.map((attachment) => attachment.file_path);
    purchaseId = null;
  }

  const savedOccurrence = {
    ...occurrence,
    purchaseId,
    paidDate: occurrence.status === "paid" ? occurrence.paidDate : null,
    paymentSourceId: occurrence.status === "paid" ? occurrence.paymentSourceId : null,
  };
  statements.push({
    sql: `UPDATE recurring_bill_occurrences SET amount_cents = ?, status = ?, paid_date = ?, payment_source_id = ?, purchase_id = ?, notes = ?, is_manually_overridden = 1 WHERE id = ?`,
    values: [
      toCents(savedOccurrence.amount),
      savedOccurrence.status,
      savedOccurrence.paidDate ? toDateOnly(savedOccurrence.paidDate) : null,
      savedOccurrence.paymentSourceId,
      savedOccurrence.purchaseId,
      savedOccurrence.notes,
      savedOccurrence.id,
    ],
  });
  if (removedPurchaseId) {
    statements.push(
      { sql: "DELETE FROM attachments WHERE entity_type = 'purchase' AND entity_id = ?", values: [removedPurchaseId] },
      { sql: "DELETE FROM purchases WHERE id = ?", values: [removedPurchaseId] },
    );
  }
  await executeDatabaseTransaction(statements);
  await removeStoredAttachments(removedAttachmentPaths);
  return { occurrence: savedOccurrence, purchase: savedPurchase, removedPurchaseId };
}
