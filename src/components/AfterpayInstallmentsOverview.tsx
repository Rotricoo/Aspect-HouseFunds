import { useMemo, useState } from "react";
import type { AfterpayPayment } from "../types/afterpay-payment";
import type { PaymentInstallment } from "../types/payment-installment";
import type { PaymentSource } from "../types/payment-source";
import type { Purchase } from "../types/purchase";
import { formatCurrency, formatDate } from "../utils/formatters";
import { sumMoney } from "../utils/money";
import AfterpayPaymentForm from "./AfterpayPaymentForm";

interface AfterpayInstallmentsOverviewProps {
  installments: PaymentInstallment[];
  payments: AfterpayPayment[];
  purchases: Purchase[];
  paymentSources: PaymentSource[];
  onPaymentSave: (payment: AfterpayPayment) => Promise<void>;
  onPaymentDelete: (payment: AfterpayPayment) => Promise<void>;
}

export default function AfterpayInstallmentsOverview({
  installments,
  payments,
  purchases,
  paymentSources,
  onPaymentSave,
  onPaymentDelete,
}: AfterpayInstallmentsOverviewProps) {
  const [paymentBeingEdited, setPaymentBeingEdited] = useState<AfterpayPayment | null>(null);
  const [isPaymentFormOpen, setIsPaymentFormOpen] = useState(false);
  const afterpaySources = paymentSources.filter((source) => source.type === "afterpay");
  const afterpayPurchases = purchases.filter((purchase) => afterpaySources.some((source) => source.id === purchase.paymentSourceId));
  const totalPurchased = sumMoney(afterpayPurchases, (purchase) => purchase.receiptTotal);
  const totalPaid = sumMoney(payments, (payment) => payment.amount);
  const legacyPaid = sumMoney(
    installments.filter((installment) => installment.status === "paid"),
    (installment) => installment.amount,
  );
  const totalRecordedPaid = totalPaid + legacyPaid;
  const totalRemaining = Math.max(0, totalPurchased - totalRecordedPaid);

  const maximumByAfterpaySourceId = useMemo(
    () =>
      new Map(
        afterpaySources.map((source) => {
          const purchased = sumMoney(
            afterpayPurchases.filter((purchase) => purchase.paymentSourceId === source.id),
            (purchase) => purchase.receiptTotal,
          );
          const sourcePayments = sumMoney(
            payments.filter((payment) => payment.afterpaySourceId === source.id),
            (payment) => payment.amount,
          );
          const sourceLegacyPaid = sumMoney(
            installments.filter((installment) => installment.afterpaySourceId === source.id && installment.status === "paid"),
            (installment) => installment.amount,
          );
          return [source.id, Math.max(0, purchased - sourcePayments - sourceLegacyPaid)] as const;
        }),
      ),
    [afterpayPurchases, afterpaySources, installments, payments],
  );

  const sortedPayments = [...payments].sort((first, second) => second.date.getTime() - first.date.getTime());
  const sortedInstallments = [...installments].sort(
    (first, second) => first.dueDate.getTime() - second.dueDate.getTime() || first.installmentNumber - second.installmentNumber,
  );

  return (
    <section className="fund-balance-report__section afterpay-installments" aria-labelledby="afterpay-title">
      <div className="afterpay-installments__heading">
        <div>
          <p>Afterpay</p>
          <h3 className="fund-balance-report__section-title" id="afterpay-title">
            Confirmed balance
          </h3>
          <span className="afterpay-installments__intro">
            Record the total confirmed as paid. You do not need to identify the exact instalment.
          </span>
        </div>
        <button
          className="afterpay-installments__action"
          type="button"
          onClick={() => {
            setPaymentBeingEdited(null);
            setIsPaymentFormOpen(true);
          }}
          disabled={totalRemaining <= 0}
        >
          + Record payment
        </button>
      </div>

      <div className="afterpay-installments__summary">
        <article>
          <span>Original purchases</span>
          <strong>{formatCurrency(totalPurchased)}</strong>
        </article>
        <article>
          <span>Confirmed paid</span>
          <strong>{formatCurrency(totalRecordedPaid)}</strong>
        </article>
        <article>
          <span>Still committed</span>
          <strong>{formatCurrency(totalRemaining)}</strong>
        </article>
      </div>

      <div className="afterpay-installments__accounts">
        {afterpaySources.map((source) => (
          <article key={source.id}>
            <span>{source.name}</span>
            <strong>{formatCurrency(maximumByAfterpaySourceId.get(source.id) ?? 0)} remaining</strong>
          </article>
        ))}
      </div>

      {sortedPayments.length > 0 && (
        <details className="afterpay-installments__details" open>
          <summary>Payment history ({sortedPayments.length})</summary>
          <div className="afterpay-installments__payment-list">
            {sortedPayments.map((payment) => {
              const account = paymentSources.find((source) => source.id === payment.afterpaySourceId);
              const paidFrom = paymentSources.find((source) => source.id === payment.paidFromPaymentSourceId);
              return (
                <article className="afterpay-installments__payment" key={payment.id}>
                  <div>
                    <strong>{formatCurrency(payment.amount)}</strong>
                    <span>{formatDate(payment.date)}</span>
                  </div>
                  <p>
                    {account?.name ?? payment.afterpaySourceId} · paid from {paidFrom?.name ?? payment.paidFromPaymentSourceId}
                  </p>
                  {payment.notes && <small>{payment.notes}</small>}
                  <div className="afterpay-installments__payment-actions">
                    <button
                      type="button"
                      onClick={() => {
                        setPaymentBeingEdited(payment);
                        setIsPaymentFormOpen(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        if (window.confirm(`Delete the ${formatCurrency(payment.amount)} Afterpay payment?`)) {
                          try {
                            await onPaymentDelete(payment);
                          } catch {
                            // Global persistence feedback already explains the database error.
                          }
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </details>
      )}

      <details className="afterpay-installments__details">
        <summary>View estimated instalment schedule ({sortedInstallments.length})</summary>
        <p className="afterpay-installments__explanation">
          This schedule is kept for planning only. Confirmed payments above are what change the amount currently owed.
        </p>
        <div className="fund-balance-report__table-wrapper">
          <table className="fund-balance-report__table">
            <thead>
              <tr>
                <th>Purchase</th>
                <th>Instalment</th>
                <th>Amount</th>
                <th>Due date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedInstallments.map((installment) => {
                const purchase = purchases.find((item) => item.id === installment.purchaseId);
                return (
                  <tr key={installment.id}>
                    <th scope="row">{purchase?.merchant ?? "Unknown purchase"}</th>
                    <td>
                      {installment.installmentNumber} of {installment.totalInstallments}
                    </td>
                    <td>{formatCurrency(installment.amount)}</td>
                    <td>{formatDate(installment.dueDate)}</td>
                    <td>
                      <span className={`afterpay-installments__status afterpay-installments__status--${installment.status}`}>
                        {installment.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </details>

      {isPaymentFormOpen && (
        <AfterpayPaymentForm
          payment={paymentBeingEdited ?? undefined}
          paymentSources={paymentSources}
          maximumByAfterpaySourceId={maximumByAfterpaySourceId}
          onClose={() => {
            setIsPaymentFormOpen(false);
            setPaymentBeingEdited(null);
          }}
          onSubmit={async (payment) => {
            await onPaymentSave(payment);
            setIsPaymentFormOpen(false);
            setPaymentBeingEdited(null);
          }}
        />
      )}
    </section>
  );
}
