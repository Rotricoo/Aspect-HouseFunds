export type FinancialMovementType = "contribution" | "refund" | "reimbursement" | "transfer" | "balance-check" | "adjustment";

export interface FinancialMovementCancellation {
  entityType: FinancialMovementType;
  entityId: string;
  cancelledAt: Date;
  reason: string;
}

export type EditableFinancialMovement =
  | { type: "contribution"; value: import("./fund-contribution").FundContribution }
  | { type: "refund"; value: import("./refund").Refund }
  | { type: "reimbursement"; value: import("./reimbursement").Reimbursement }
  | { type: "transfer"; value: import("./fund-transfer").FundTransfer }
  | { type: "balance-check"; value: import("./fund-balance-check").FundBalanceCheck }
  | { type: "adjustment"; value: import("./fund-adjustment").FundAdjustment };
