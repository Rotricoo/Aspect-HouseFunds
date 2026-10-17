import type { PurchaseItem } from "./purchase-item";

export interface Purchase {
  id: string;
  date: Date;
  merchant: string;
  receiptTotal: number;
  paymentSourceId: string;
  items: PurchaseItem[];
  receiptItemCount: number | null;
  itemsAreConsolidated?: boolean;
  receiptRoundingAdjustment: number;
  receiptRoundingSplitBetweenPersonIds: string[];
  attachmentPaths: string[];
  notes: string | null;
}
