import type { PersonId } from "../types/person-id";
import type { RecurringBill, RecurringBillFrequency, RecurringContributionPlan } from "../types/recurring-bill";
import { formatDateOnly, parseDateOnly, todayDateOnly } from "../utils/date-only";
import type { DatabaseStatement } from "./database-transaction";

export interface BillOccurrenceSeed {
  recurringBillId: string;
  periodStartDate: string;
  periodEndDate: string;
  dueDate: string;
}

export interface ContributionOccurrenceSeed {
  recurringContributionPlanId: string;
  personId: PersonId;
  dueDate: string;
}

export function addRecurringFrequency(date: Date, frequency: RecurringBillFrequency): Date {
  const result = new Date(date);
  if (frequency === "weekly") result.setDate(result.getDate() + 7);
  if (frequency === "fortnightly") result.setDate(result.getDate() + 14);
  if (frequency === "monthly") result.setMonth(result.getMonth() + 1);
  if (frequency === "quarterly") result.setMonth(result.getMonth() + 3);
  if (frequency === "yearly") result.setFullYear(result.getFullYear() + 1);
  return result;
}

function generationHorizon(endDate?: Date | null): Date {
  if (endDate) return new Date(endDate);
  const horizon = parseDateOnly(todayDateOnly());
  horizon.setDate(horizon.getDate() + 90);
  return horizon;
}

export function buildBillOccurrenceStatements(bill: RecurringBill, previous: BillOccurrenceSeed | null): DatabaseStatement[] {
  if (!bill.isActive || bill.defaultAmount === null) return [];
  const limit = generationHorizon(bill.endsOn);
  let periodStart = previous ? parseDateOnly(previous.periodEndDate) : new Date(bill.startsOn);
  if (previous) periodStart.setDate(periodStart.getDate() + 1);
  let dueDate = previous ? addRecurringFrequency(parseDateOnly(previous.dueDate), bill.frequency) : new Date(periodStart);
  const statements: DatabaseStatement[] = [];

  while (periodStart <= limit) {
    const nextPeriodStart = addRecurringFrequency(periodStart, bill.frequency);
    const periodEnd = new Date(nextPeriodStart);
    periodEnd.setDate(periodEnd.getDate() - 1);
    if (periodEnd > limit) break;
    const start = formatDateOnly(periodStart);
    statements.push({
      sql: `INSERT OR IGNORE INTO recurring_bill_occurrences
        (id, recurring_bill_id, period_start_date, period_end_date, due_date, amount_cents, status, paid_date,
         payment_source_id, purchase_id, notes, is_generated, is_manually_overridden)
        VALUES (?, ?, ?, ?, ?, ?, 'scheduled', NULL, ?, NULL, ?, 1, 0)`,
      values: [
        `${bill.id}-${start}`,
        bill.id,
        start,
        formatDateOnly(periodEnd),
        formatDateOnly(dueDate),
        Math.round(bill.defaultAmount * 100),
        bill.defaultPaymentSourceId,
        "Generated automatically from the recurring bill template.",
      ],
    });
    periodStart = nextPeriodStart;
    dueDate = addRecurringFrequency(dueDate, bill.frequency);
  }
  return statements;
}

export function buildContributionOccurrenceStatements(
  plan: RecurringContributionPlan,
  personId: PersonId,
  previous: ContributionOccurrenceSeed | null,
): DatabaseStatement[] {
  if (!plan.isActive || !plan.contributorPersonIds.includes(personId)) return [];
  const limit = generationHorizon();
  let dueDate = previous ? addRecurringFrequency(parseDateOnly(previous.dueDate), plan.frequency) : new Date(plan.startsOn);
  const statements: DatabaseStatement[] = [];
  while (dueDate <= limit) {
    const date = formatDateOnly(dueDate);
    statements.push({
      sql: `INSERT OR IGNORE INTO recurring_contribution_occurrences
        (id, recurring_contribution_plan_id, person_id, due_date, amount_cents, status, paid_date,
         fund_contribution_id, notes, is_generated, is_manually_overridden)
        VALUES (?, ?, ?, ?, ?, 'scheduled', NULL, NULL, ?, 1, 0)`,
      values: [
        `${plan.id}-${personId.toLowerCase()}-${date}`,
        plan.id,
        personId,
        date,
        Math.round(plan.amountPerPerson * 100),
        "Generated automatically from the recurring contribution plan.",
      ],
    });
    dueDate = addRecurringFrequency(dueDate, plan.frequency);
  }
  return statements;
}
