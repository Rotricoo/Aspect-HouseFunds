export interface FundTransfer {
  id: string;
  date: Date;
  fromPaymentSourceId: string;
  toPaymentSourceId: string;
  amount: number;
  notes: string | null;
}
