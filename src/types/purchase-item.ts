export interface PurchaseItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  category: string;
  categoryId?: string | null;
  ownership: "household" | "personal";
  ownerPersonIds: string[];
  splitBetweenPersonIds: string[];
  notes: string | null;
}
