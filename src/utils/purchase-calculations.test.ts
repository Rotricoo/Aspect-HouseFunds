import { describe, expect, it } from "vitest";
import type { Purchase } from "../types/purchase";
import { calculateEqualSplit, calculatePersonPurchaseShare, isReceiptValid } from "./purchase-calculations";

function createPurchase(overrides: Partial<Purchase> = {}): Purchase {
  return {
    id: "purchase-1",
    date: new Date("2026-09-25"),
    merchant: "Test merchant",
    receiptTotal: 10,
    paymentSourceId: "shared-cash",
    receiptItemCount: 1,
    receiptRoundingAdjustment: 0,
    receiptRoundingSplitBetweenPersonIds: [],
    attachmentPaths: [],
    notes: null,
    items: [
      {
        id: "item-1",
        name: "Shared item",
        description: "Test item",
        quantity: 1,
        unitPrice: 10,
        totalAmount: 10,
        category: "Household",
        ownership: "household",
        ownerPersonIds: [],
        splitBetweenPersonIds: ["person-alex", "person-jordan", "person-sam"],
        notes: null,
      },
    ],
    ...overrides,
  };
}

describe("purchase calculations", () => {
  it("splits remainder cents without losing money", () => {
    const shares = calculateEqualSplit(10, ["person-alex", "person-jordan", "person-sam"]);

    expect(shares).toEqual({ "person-alex": 3.34, "person-jordan": 3.33, "person-sam": 3.33 });
    expect(Object.values(shares).reduce((total, share) => total + share, 0)).toBeCloseTo(10);
  });

  it("calculates each person's item responsibility", () => {
    const purchase = createPurchase();

    expect(calculatePersonPurchaseShare("person-alex", purchase)).toBe(3.34);
    expect(calculatePersonPurchaseShare("person-jordan", purchase)).toBe(3.33);
    expect(calculatePersonPurchaseShare("person-sam", purchase)).toBe(3.33);
  });

  it("validates receipt totals including cash rounding", () => {
    expect(isReceiptValid(createPurchase())).toBe(true);
    expect(isReceiptValid(createPurchase({ receiptTotal: 10.05, receiptRoundingAdjustment: 0.05 }))).toBe(true);
    expect(isReceiptValid(createPurchase({ receiptTotal: 10.01 }))).toBe(false);
  });
});
