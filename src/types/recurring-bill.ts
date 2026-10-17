import type { PersonId } from "./person-id";

export type RecurringBillFrequency = "weekly" | "fortnightly" | "monthly" | "quarterly" | "yearly";

export interface RecurringBill {
  id: string;
  name: string;
  merchant: string;
  category: string;
  categoryId?: string | null;
  frequency: RecurringBillFrequency;
  defaultAmount: number | null;
  defaultPaymentSourceId: string;
  splitBetweenPersonIds: PersonId[];
  preferredPaymentLeadDays: number;
  startsOn: Date;
  endsOn: Date | null;
  isActive: boolean;
  notes: string | null;
}

export interface RecurringContributionPlan {
  id: string;
  name: string;
  frequency: RecurringBillFrequency;
  amountPerPerson: number;
  contributorPersonIds: PersonId[];
  destinationFundSourceId: string;
  startsOn: Date;
  isActive: boolean;
  notes: string | null;
}

export type RecurringContributionOccurrenceStatus = "scheduled" | "paid" | "overdue" | "cancelled";

export interface RecurringContributionOccurrence {
  id: string;
  recurringContributionPlanId: string;
  personId: PersonId;
  dueDate: Date;
  amount: number;
  status: RecurringContributionOccurrenceStatus;
  paidDate: Date | null;
  fundContributionId: string | null;
  notes: string | null;
}

export type RecurringBillOccurrenceStatus = "scheduled" | "paid" | "overdue" | "cancelled";

export interface RecurringBillOccurrence {
  id: string;
  recurringBillId: string;
  periodStartDate: Date;
  periodEndDate: Date;
  dueDate: Date;
  amount: number;
  status: RecurringBillOccurrenceStatus;
  paidDate: Date | null;
  paymentSourceId: string | null;
  purchaseId: string | null;
  notes: string | null;
}
