import type { PurchaseItem } from "../types/purchase-item";
import type { Purchase } from "../types/purchase";
import { addMoney, fromMoneyCents, toMoneyCents } from "./money";

// Calculates the total amount of all items in a purchase.
export function calculatePurchaseItemsTotal(items: PurchaseItem[]): number {
  let totalItemsAmount = 0;
  for (const item of items) {
    totalItemsAmount = addMoney(totalItemsAmount, item.totalAmount);
  }
  return totalItemsAmount;
}

// Validates if the receipt total matches the sum of item totals plus any rounding adjustment.
export function isReceiptValid(purchase: Purchase): boolean {
  const calculatedTotalCents = Math.round((calculatePurchaseItemsTotal(purchase.items) + purchase.receiptRoundingAdjustment) * 100);
  const receiptTotalCents = Math.round(purchase.receiptTotal * 100);

  return calculatedTotalCents === receiptTotalCents;
}

// Calculates the share of a purchase that a specific person is responsible for, including their portion of any rounding adjustment.
export function calculatePersonPurchaseShare(personId: string, purchase: Purchase): number {
  let personTotal = 0;

  for (let index = 0; index < purchase.items.length; index++) {
    const item = purchase.items[index];

    if (item.splitBetweenPersonIds.includes(personId)) {
      const itemShares = calculateEqualSplit(item.totalAmount, item.splitBetweenPersonIds, index);

      personTotal = addMoney(personTotal, itemShares[personId]);
    }
  }

  if (purchase.receiptRoundingSplitBetweenPersonIds.includes(personId)) {
    const roundingShares = calculateEqualSplit(
      purchase.receiptRoundingAdjustment,
      purchase.receiptRoundingSplitBetweenPersonIds,
      purchase.items.length,
    );

    personTotal = addMoney(personTotal, roundingShares[personId]);
  }

  return personTotal;
}

// Calculates the suggested cash settlement amount by rounding the exact amount to the nearest whole number.
export function calculateSuggestedCashSettlement(exactAmount: number): number {
  return Math.round(exactAmount);
}

// Calculates the number of items listed on the receipt for a purchase.
export function calculatePurchaseReceiptItemCount(purchase: Purchase): number {
  let itemCount = 0;

  for (const item of purchase.items) {
    itemCount += item.quantity;
  }

  return itemCount;
}

// Validates if the number of items listed on the receipt matches the actual number of items in the purchase.
export function isReceiptItemCountValid(purchase: Purchase): boolean | null {
  if (purchase.receiptItemCount === null) {
    return null;
  }

  if (purchase.itemsAreConsolidated === true) {
    return null;
  }

  return calculatePurchaseReceiptItemCount(purchase) === purchase.receiptItemCount;
}

// Calculates an equal split of a total amount among a list of person IDs, distributing any remainder cents fairly.
export function calculateEqualSplit(totalAmount: number, personIds: string[], startIndex: number = 0) {
  // input validation, If personIds is empty just return
  if (personIds.length === 0) {
    return {};
  }

  const totalCents = toMoneyCents(totalAmount);
  const baseCents = Math.floor(totalCents / personIds.length);
  const remainderCents = totalCents - baseCents * personIds.length;

  const shares: Record<string, number> = {};

  for (const personId of personIds) {
    shares[personId] = fromMoneyCents(baseCents);
  }

  for (let index = 0; index < remainderCents; index++) {
    const personId = personIds[(startIndex + index) % personIds.length];

    shares[personId] = fromMoneyCents(toMoneyCents(shares[personId]) + 1);
  }

  return shares;
}
