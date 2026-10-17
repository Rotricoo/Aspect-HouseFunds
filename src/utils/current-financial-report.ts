import type { AfterpayPayment } from "../types/afterpay-payment";
import type { FinancialMovementCancellation, FinancialMovementType } from "../types/financial-movement";
import type { FundAdjustment } from "../types/fund-adjustment";
import type { FundBalanceCheck } from "../types/fund-balance-check";
import type { FundContribution } from "../types/fund-contribution";
import type { FundTransfer } from "../types/fund-transfer";
import type { PaymentInstallment } from "../types/payment-installment";
import type { PaymentSource } from "../types/payment-source";
import type { Purchase } from "../types/purchase";
import type { Refund } from "../types/refund";
import type { Reimbursement } from "../types/reimbursement";
import type { SettlementGroup } from "../types/settlement-group";
import type { Person } from "../types/person-id";
import { generateFinancialReport } from "./financial-report-calculations";

interface CurrentFinancialReportInput {
  purchases: Purchase[];
  contributions: FundContribution[];
  paymentInstallments: PaymentInstallment[];
  afterpayPayments: AfterpayPayment[];
  refunds: Refund[];
  reimbursements: Reimbursement[];
  fundTransfers: FundTransfer[];
  balanceChecks: FundBalanceCheck[];
  fundAdjustments: FundAdjustment[];
  paymentSources: PaymentSource[];
  settlementGroups: SettlementGroup[];
  cancellations: FinancialMovementCancellation[];
  asOfDate?: Date;
  people?: Person[];
}

export function createCurrentFinancialReport(input: CurrentFinancialReportInput) {
  const cancelled = new Set(input.cancellations.map((item) => `${item.entityType}:${item.entityId}`));
  const active = <T extends { id: string }>(type: FinancialMovementType, values: T[]) =>
    values.filter((value) => !cancelled.has(`${type}:${value.id}`));

  return generateFinancialReport({
    purchases: input.purchases,
    contributions: active("contribution", input.contributions),
    paymentInstallments: input.paymentInstallments,
    afterpayPayments: input.afterpayPayments,
    refunds: active("refund", input.refunds),
    reimbursements: active("reimbursement", input.reimbursements),
    fundTransfers: active("transfer", input.fundTransfers),
    balanceChecks: active("balance-check", input.balanceChecks),
    adjustments: active("adjustment", input.fundAdjustments),
    paymentSources: input.paymentSources,
    settlementGroups: input.settlementGroups,
    asOfDate: input.asOfDate ?? new Date(),
    // Archived members remain part of historical calculations. They are only
    // excluded from new-entry selectors by the UI.
    personIds: input.people?.map((person) => person.id),
  });
}
