export interface PaymentInstallment {
  id: string;
  purchaseId: string;
  installmentNumber: number;
  totalInstallments: number;
  dueDate: Date;
  paidDate: Date | null;
  amount: number;
  status: "unconfirmed" | "pending" | "paid" | "overdue";
  afterpaySourceId: string;
  paidFromPaymentSourceId: string | null;
  scheduleIsEstimated: boolean;
  notes: string | null;
}
