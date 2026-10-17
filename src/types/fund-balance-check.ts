export interface FundBalanceCheck {
  id: string;
  fundSourceId: string;
  countedAmount: number;
  checkedAt: Date;
  notes: string | null;
}
