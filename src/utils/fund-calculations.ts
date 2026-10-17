import type { FundContribution } from "../types/fund-contribution";
import type { Purchase } from "../types/purchase";
import type { Refund } from "../types/refund";
import type { FundAdjustment } from "../types/fund-adjustment";
import { addMoney, subtractMoney } from "./money";

export function calculateFundContributionsTotal(contributions: FundContribution[], fundSourceId: string) {
  let totalContribution = 0;

  for (const contribution of contributions) {
    if (contribution.fundSourceId === fundSourceId) {
      totalContribution = addMoney(totalContribution, contribution.amount);
    }
  }

  return totalContribution;
}

export function calculatePurchasesPaidFromSourceTotal(purchases: Purchase[], paymentSourceId: string) {
  let totalPaidFromSource = 0;

  for (const purchase of purchases) {
    if (purchase.paymentSourceId === paymentSourceId) {
      totalPaidFromSource = addMoney(totalPaidFromSource, purchase.receiptTotal);
    }
  }

  return totalPaidFromSource;
}

export function calculateExpectedFundBalance(
  contributions: FundContribution[],
  purchases: Purchase[],
  refunds: Refund[],
  fundAdjustments: FundAdjustment[],
  fundSourceId: string,
) {
  const totalContributions = calculateFundContributionsTotal(contributions, fundSourceId);
  const totalPurchases = calculatePurchasesPaidFromSourceTotal(purchases, fundSourceId);

  const totalRefunds = calculateRefundsReceivedToSourceTotal(refunds, fundSourceId);

  const totalAdjustments = calculateFundAdjustmentsTotal(fundAdjustments, fundSourceId);

  return addMoney(subtractMoney(totalContributions, totalPurchases), totalRefunds, totalAdjustments);
}

export function calculateRefundsReceivedToSourceTotal(refunds: Refund[], paymentSourceId: string) {
  let totalRefundsReceived = 0;

  for (const refund of refunds) {
    if (refund.receivedToPaymentSourceId === paymentSourceId) {
      totalRefundsReceived = addMoney(totalRefundsReceived, refund.amount);
    }
  }

  return totalRefundsReceived;
}

export function calculateExpectedFundBalanceOnDate(
  contributions: FundContribution[],
  purchases: Purchase[],
  refunds: Refund[],
  fundAdjustments: FundAdjustment[],
  fundSourceId: string,
  asOfDate: Date,
) {
  const contributionsOnOrBeforeDate = contributions.filter((contribution) => contribution.date === null || contribution.date <= asOfDate);

  const purchasesOnOrBeforeDate = purchases.filter((purchase) => purchase.date <= asOfDate);

  const refundsOnOrBeforeDate = refunds.filter((refund) => refund.date <= asOfDate);

  return calculateExpectedFundBalance(
    contributionsOnOrBeforeDate,
    purchasesOnOrBeforeDate,
    refundsOnOrBeforeDate,
    fundAdjustments.filter((adjustment) => adjustment.date === null || adjustment.date <= asOfDate),
    fundSourceId,
  );
}

export function calculateFundBalanceDiscrepancy(expectedBalance: number, countedBalance: number) {
  return subtractMoney(countedBalance, expectedBalance);
}

export function calculateFundAdjustmentsTotal(adjustments: FundAdjustment[], fundSourceId: string) {
  let totalAdjustments = 0;

  for (const adjustment of adjustments) {
    if (adjustment.fundSourceId === fundSourceId) {
      totalAdjustments = addMoney(totalAdjustments, adjustment.direction === "increase" ? adjustment.amount : -adjustment.amount);
    }
  }

  return totalAdjustments;
}
