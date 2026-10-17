export interface AfterpayPayment {
  id: string;
  afterpaySourceId: string;
  date: Date;
  amount: number;
  paidFromPaymentSourceId: string;
  notes: string | null;
}
