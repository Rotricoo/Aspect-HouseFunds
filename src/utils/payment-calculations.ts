import type { PaymentInstallment } from "../types/payment-installment";

export function calculateInstallmentAmounts(totalAmount: number, totalInstallments: number): number[] {
  if (!Number.isInteger(totalInstallments) || totalInstallments <= 0) {
    throw new Error("The number of instalments must be a positive whole number.");
  }

  const totalCents = Math.round(totalAmount * 100);
  const baseCents = Math.floor(totalCents / totalInstallments);
  const remainderCents = totalCents - baseCents * totalInstallments;

  return Array.from({ length: totalInstallments }, (_, index) => (baseCents + (index < remainderCents ? 1 : 0)) / 100);
}

export function generateAfterpayInstallments(
  purchaseId: string,
  totalAmount: number,
  firstDueDate: Date,
  afterpaySourceId: string,
  totalInstallments: number,
  scheduleIsEstimated: boolean = true,
): PaymentInstallment[] {
  const installmentAmounts = calculateInstallmentAmounts(totalAmount, totalInstallments);

  return installmentAmounts.map((amount, index) => {
    const installmentNumber = index + 1;
    const dueDate = new Date(firstDueDate);
    dueDate.setDate(firstDueDate.getDate() + index * 14);

    return {
      id: `${purchaseId}-installment-${installmentNumber}`,
      purchaseId,
      installmentNumber,
      totalInstallments,
      dueDate,
      paidDate: null,
      amount,
      status: "unconfirmed",
      afterpaySourceId,
      paidFromPaymentSourceId: null,
      scheduleIsEstimated,
      notes: scheduleIsEstimated ? "Estimated from the purchase date; confirm against the account provider." : null,
    };
  });
}
