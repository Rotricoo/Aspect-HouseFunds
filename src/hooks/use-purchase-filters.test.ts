import { describe, expect, it } from "vitest";
import type { Purchase } from "../types/purchase";
import { parseDateOnly } from "../utils/date-only";
import { filterAndSortPurchases } from "./use-purchase-filters";

function createPurchase(id: string, date: string, merchant: string, paymentSourceId: string): Purchase {
  return {
    id,
    date: parseDateOnly(date),
    merchant,
    receiptTotal: 10,
    paymentSourceId,
    receiptItemCount: 1,
    itemsAreConsolidated: false,
    receiptRoundingAdjustment: 0,
    receiptRoundingSplitBetweenPersonIds: [],
    attachmentPaths: [],
    notes: null,
    items: [
      {
        id: `${id}-item`,
        name: "Test item",
        description: "Test item",
        quantity: 1,
        unitPrice: 10,
        totalAmount: 10,
        category: "General",
        ownership: "household",
        ownerPersonIds: [],
        splitBetweenPersonIds: ["person-alex", "person-jordan", "person-sam"],
        notes: null,
      },
    ],
  };
}

const purchases = [
  createPurchase("older", "2026-09-20", "Example Market", "shared-cash"),
  createPurchase("recent", "2026-09-26", "Example Market", "jordan-bank"),
  createPurchase("today", "2026-09-30", "Demo Online Store", "sam-pay-later"),
];

function filter(overrides: Partial<Parameters<typeof filterAndSortPurchases>[0]> = {}) {
  return filterAndSortPurchases({
    purchases,
    period: "all",
    merchant: "",
    startDate: "",
    endDate: "",
    paymentSourceId: "",
    sortOrder: "newest",
    today: parseDateOnly("2026-09-30"),
    ...overrides,
  });
}

describe("purchase filtering", () => {
  it("filters the inclusive seven-day period without losing today's purchases", () => {
    expect(filter({ period: "week" }).map((purchase) => purchase.id)).toEqual(["today", "recent"]);
  });

  it("combines merchant, date and payment-source filters", () => {
    expect(
      filter({ merchant: "example", startDate: "2026-09-25", endDate: "2026-09-27", paymentSourceId: "jordan-bank" }).map(
        (purchase) => purchase.id,
      ),
    ).toEqual(["recent"]);
  });

  it("sorts purchases in either date direction", () => {
    expect(filter({ sortOrder: "oldest" }).map((purchase) => purchase.id)).toEqual(["older", "recent", "today"]);
    expect(filter({ sortOrder: "newest" }).map((purchase) => purchase.id)).toEqual(["today", "recent", "older"]);
  });
});
