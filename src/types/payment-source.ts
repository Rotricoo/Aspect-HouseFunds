import type { PersonId } from "./person-id";

export interface PaymentSource {
  id: string;
  name: string;
  type: "cash" | "bank-account" | "afterpay";
  ownership: "household" | PersonId | null;
  managedBy: "household" | PersonId | null;
  openingBalance: number | null;
}
