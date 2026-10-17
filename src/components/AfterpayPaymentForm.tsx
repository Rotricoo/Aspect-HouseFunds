import { useState, type FormEvent } from "react";
import type { AfterpayPayment } from "../types/afterpay-payment";
import type { PaymentSource } from "../types/payment-source";
import { formatDateOnly, parseDateOnly, todayDateOnly } from "../utils/date-only";
import { useDialogFocus } from "../hooks/use-dialog-focus";
import { useUnsavedChanges } from "../hooks/use-unsaved-changes";

interface Props {
  payment?: AfterpayPayment;
  paymentSources: PaymentSource[];
  maximumByAfterpaySourceId: Map<string, number>;
  onClose: () => void;
  onSubmit: (payment: AfterpayPayment) => Promise<void>;
}

export default function AfterpayPaymentForm({ payment, paymentSources, maximumByAfterpaySourceId, onClose, onSubmit }: Props) {
  const afterpaySources = paymentSources.filter((source) => source.type === "afterpay");
  const fundingSources = paymentSources.filter((source) => source.type !== "afterpay");
  const defaultAfterpayOwner = afterpaySources[0]?.ownership;
  const [afterpaySourceId, setAfterpaySourceId] = useState(payment?.afterpaySourceId ?? afterpaySources[0]?.id ?? "");
  const [paidFromPaymentSourceId, setPaidFromPaymentSourceId] = useState(
    payment?.paidFromPaymentSourceId ??
      fundingSources.find((source) => source.ownership === defaultAfterpayOwner && source.type === "bank-account")?.id ??
      fundingSources[0]?.id ??
      "",
  );
  const [amountInput, setAmountInput] = useState(payment ? String(payment.amount) : "");
  const [dateInput, setDateInput] = useState(payment ? formatDateOnly(payment.date) : todayDateOnly());
  const [notes, setNotes] = useState(payment?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const dialogRef = useDialogFocus<HTMLElement>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const amount = Math.round(Number(amountInput) * 100) / 100;
    const maximum =
      (maximumByAfterpaySourceId.get(afterpaySourceId) ?? 0) + (payment?.afterpaySourceId === afterpaySourceId ? payment.amount : 0);

    if (!afterpaySourceId || !paidFromPaymentSourceId || !dateInput || !Number.isFinite(amount) || amount <= 0) {
      setError("Choose the Afterpay account, payment account, date and an amount greater than zero.");
      return;
    }
    if (amount > maximum) {
      setError(`This payment is greater than the remaining Afterpay commitment (${maximum.toFixed(2)}).`);
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit({
        id: payment?.id ?? crypto.randomUUID(),
        afterpaySourceId,
        date: parseDateOnly(dateInput),
        amount,
        paidFromPaymentSourceId,
        notes: notes.trim() || null,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The Afterpay payment could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  const requestClose = useUnsavedChanges(hasUnsavedChanges, onClose, isSaving);

  return (
    <section ref={dialogRef} className="afterpay-payment-form" role="dialog" aria-modal="true" aria-labelledby="afterpay-payment-title">
      <button className="afterpay-payment-form__close" type="button" onClick={requestClose} aria-label="Close Afterpay payment form">
        ×
      </button>
      <header className="afterpay-payment-form__header">
        <p>Actual money paid</p>
        <h2 id="afterpay-payment-title">{payment ? "Edit Afterpay payment" : "Record Afterpay payment"}</h2>
        <span>Record the amount confirmed as paid. Exact instalment numbers are optional.</span>
      </header>
      <form className="afterpay-payment-form__form" onSubmit={handleSubmit} onChange={() => setHasUnsavedChanges(true)}>
        <label>
          <span>Afterpay account</span>
          <select value={afterpaySourceId} onChange={(event) => setAfterpaySourceId(event.target.value)} required>
            {afterpaySources.map((source) => (
              <option value={source.id} key={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Paid from</span>
          <select value={paidFromPaymentSourceId} onChange={(event) => setPaidFromPaymentSourceId(event.target.value)} required>
            {fundingSources.map((source) => (
              <option value={source.id} key={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Amount paid</span>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amountInput}
            onChange={(event) => setAmountInput(event.target.value)}
            placeholder="0.00"
            required
          />
        </label>
        <label>
          <span>Payment date</span>
          <input type="date" value={dateInput} onChange={(event) => setDateInput(event.target.value)} required />
        </label>
        <label className="afterpay-payment-form__wide">
          <span>Notes</span>
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Example: Confirmed amount paid so far" />
        </label>
        {error && (
          <p className="afterpay-payment-form__error" role="alert">
            {error}
          </p>
        )}
        <div className="afterpay-payment-form__actions">
          <button type="button" onClick={requestClose} disabled={isSaving}>
            Cancel
          </button>
          <button type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save payment"}
          </button>
        </div>
      </form>
    </section>
  );
}
