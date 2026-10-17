import type { PaymentSource } from "./payment-source";
import type { PersonId } from "./person-id";

export interface FinancialSourceReport {
  sourceId: string;
  sourceName: string;
  sourceType: PaymentSource["type"];
  ownership: PaymentSource["ownership"];
  contributions: number;
  purchases: number;
  installmentPayments: number;
  refunds: number;
  adjustments: number;
  transfersIn: number;
  transfersOut: number;
  netMovement: number;
  expectedBalance: number | null;
}

export interface MemberFinancialReport {
  personId: PersonId;
  totalResponsibility: number;
  sharedFundContribution: number;
  sharedFundResponsibility: number;
  sharedFundRefundBenefit: number;
  sharedFundPosition: number;
  immediatePersonalPaid: number;
  immediatePersonalResponsibility: number;
  immediatePosition: number;
  afterpayCommitted: number;
  afterpayResponsibility: number;
  afterpayPosition: number;
  combinedPersonalPosition: number;
  payableNowPosition: number;
  overallPosition: number;
}

export interface SettlementTransfer {
  fromPersonId: PersonId;
  toPersonId: PersonId;
  amount: number;
}

export interface FundReconciliationReport {
  balanceCheckId: string;
  sourceId: string;
  sourceName: string;
  checkedAt: Date;
  expectedBalance: number;
  countedBalance: number;
  discrepancy: number;
  notes: string | null;
}

export interface FinancialReportSummary {
  grossPurchases: number;
  refundsReceived: number;
  netRecordedSpending: number;
  sharedFundsExpectedBalance: number;
  personallyAdvancedNow: number;
  afterpayCommitted: number;
}

export interface FinancialReport {
  asOfDate: Date;
  summary: FinancialReportSummary;
  sources: FinancialSourceReport[];
  members: MemberFinancialReport[];
  settlementGroups: SettlementGroupFinancialReport[];
  groupSharedFundSettlements: SettlementGroupTransfer[];
  groupImmediateSettlements: SettlementGroupTransfer[];
  groupPayableNowSettlements: SettlementGroupTransfer[];
  groupAfterpayCommitmentSettlements: SettlementGroupTransfer[];
  groupCombinedPersonalSettlements: SettlementGroupTransfer[];
  groupOverallSettlements: SettlementGroupTransfer[];
  sharedFundSettlements: SettlementTransfer[];
  immediateSettlements: SettlementTransfer[];
  payableNowSettlements: SettlementTransfer[];
  afterpayCommitmentSettlements: SettlementTransfer[];
  combinedPersonalSettlements: SettlementTransfer[];
  overallSettlements: SettlementTransfer[];
  reconciliations: FundReconciliationReport[];
  warnings: string[];
}

export interface SettlementGroupFinancialReport {
  groupId: string;
  groupName: string;
  memberPersonIds: PersonId[];
  totalResponsibility: number;
  sharedFundPosition: number;
  immediatePosition: number;
  afterpayPosition: number;
  combinedPersonalPosition: number;
  payableNowPosition: number;
  overallPosition: number;
}

export interface SettlementGroupTransfer {
  fromGroupId: string;
  fromGroupName: string;
  toGroupId: string;
  toGroupName: string;
  amount: number;
}
