import { parseDateOnly } from "../utils/date-only";
import type { Category } from "../types/category";
import type { PaymentSource } from "../types/payment-source";
import type { Person } from "../types/person-id";
import type { Purchase } from "../types/purchase";
import type { SettlementGroup } from "../types/settlement-group";

export interface DemoData {
  people: Person[];
  paymentSources: PaymentSource[];
  settlementGroups: SettlementGroup[];
  categories: Category[];
  purchases: Purchase[];
}

export const DEMO_STORAGE_KEY = "aspect-house-funds-web-demo";

export function createDemoData(): DemoData {
  const personId = "demo-member";
  const sourceId = "demo-shared-account";
  const categoryId = "demo-groceries";

  return {
    people: [{ id: personId, name: "Demo Member", weeklyContribution: 50, isActive: true }],
    paymentSources: [
      {
        id: sourceId,
        name: "Demo Shared Account",
        type: "bank-account",
        ownership: "household",
        managedBy: "household",
        openingBalance: 1200,
      },
    ],
    settlementGroups: [{ id: "demo-household", name: "Demo Household", memberPersonIds: [personId] }],
    categories: [{ id: categoryId, name: "Groceries", isActive: true }],
    purchases: [
      {
        id: "demo-purchase",
        date: parseDateOnly("2026-01-15"),
        merchant: "Demo Market",
        receiptTotal: 42.5,
        paymentSourceId: sourceId,
        receiptItemCount: 1,
        itemsAreConsolidated: false,
        receiptRoundingAdjustment: 0,
        receiptRoundingSplitBetweenPersonIds: [],
        attachmentPaths: [],
        notes: "Fictional portfolio demo purchase.",
        items: [
          {
            id: "demo-purchase-item",
            name: "Shared groceries",
            description: "Shared groceries",
            quantity: 1,
            unitPrice: 42.5,
            totalAmount: 42.5,
            category: "Groceries",
            categoryId,
            ownership: "household",
            ownerPersonIds: [],
            splitBetweenPersonIds: [personId],
            notes: null,
          },
        ],
      },
    ],
  };
}

export function loadDemoData(): DemoData {
  const fallback = createDemoData();
  const stored = window.localStorage.getItem(DEMO_STORAGE_KEY);
  if (!stored) return fallback;

  try {
    const parsed = JSON.parse(stored) as DemoData;
    return {
      ...fallback,
      ...parsed,
      purchases: parsed.purchases.map((purchase) => ({ ...purchase, date: new Date(purchase.date) })),
    };
  } catch {
    window.localStorage.removeItem(DEMO_STORAGE_KEY);
    return fallback;
  }
}

export function saveDemoData(data: Pick<DemoData, "people" | "paymentSources" | "settlementGroups" | "categories" | "purchases">) {
  window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(data));
}
