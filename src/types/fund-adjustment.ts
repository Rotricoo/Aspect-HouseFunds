import type { PersonId } from "./person-id";

export interface FundAdjustment {
  id: string;
  fundSourceId: string;
  date: Date;
  amount: number;
  direction: "increase" | "decrease";
  reason: "cash-count-correction" | "cash-found" | "cash-lost" | "other";
  allocationKind: "balance-only" | "household-expense";
  splitBetweenPersonIds: PersonId[];
  notes: string;
  attachmentPaths: string[];
}
