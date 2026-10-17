export interface Refund {
  id: string;
  date: Date;
  merchant: string;
  amount: number;
  receivedToPaymentSourceId: string;
  originalPurchaseId: string;
  originalPurchaseItemId: string | null;
  beneficiaryPersonIds: string[];
  attachmentPaths: string[];
  notes: string | null;
}
