import type { PersonId } from "./person-id";

export interface Reimbursement {
  id: string;
  date: Date;
  fromPersonId: PersonId;
  toPersonId: PersonId;
  amount: number;
  paymentSourceId: string;
  appliesTo: "immediate" | "afterpay";
  relatedPurchaseIds: string[];
  notes: string | null;
}
