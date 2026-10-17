import { useState, type FormEvent } from "react";
import type { RecurringContributionOccurrence, RecurringContributionPlan } from "../types/recurring-bill";
import type { Person } from "../types/person-id";
import { parseDateOnly, formatDateOnly } from "../utils/date-only";
import { formatCurrency, formatDate } from "../utils/formatters";
import { useDialogFocus } from "../hooks/use-dialog-focus";
import { getPersonName } from "../utils/household-labels";
import { useUnsavedChanges } from "../hooks/use-unsaved-changes";

interface Props {
  occurrence: RecurringContributionOccurrence;
  plan: RecurringContributionPlan;
  onClose: () => void;
  onSave: (occurrence: RecurringContributionOccurrence) => Promise<void>;
  people: Person[];
}

function RecurringContributionOccurrenceForm({ occurrence, plan, onClose, onSave, people }: Props) {
  const [status, setStatus] = useState(occurrence.status);
  const [paidDate, setPaidDate] = useState(formatDateOnly(occurrence.paidDate ?? new Date()));
  const [amount, setAmount] = useState(occurrence.amount.toFixed(2));
  const [isSaving, setIsSaving] = useState(false);
  const isDirty =
    status !== occurrence.status ||
    Number(amount) !== occurrence.amount ||
    (status === "paid" && paidDate !== formatDateOnly(occurrence.paidDate ?? new Date()));
  const requestClose = useUnsavedChanges(isDirty, onClose);
  const dialogRef = useDialogFocus<HTMLFormElement>();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return;
    setIsSaving(true);
    try {
      await onSave({
        ...occurrence,
        amount: Math.round(parsedAmount * 100) / 100,
        status,
        paidDate: status === "paid" ? parseDateOnly(paidDate) : null,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="recurring-payment-form"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && requestClose()}
    >
      <form
        className="recurring-payment-form__dialog"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contribution-occurrence-title"
        onSubmit={handleSubmit}
      >
        <header className="recurring-payment-form__header">
          <div>
            <p>Weekly contribution</p>
            <h3 id="contribution-occurrence-title">
              {getPersonName(occurrence.personId, people)} · {formatDate(occurrence.dueDate)}
            </h3>
          </div>
          <button type="button" onClick={requestClose} aria-label="Close">
            ×
          </button>
        </header>
        <p>
          {plan.name} · expected {formatCurrency(plan.amountPerPerson)}
        </p>
        <div className="recurring-payment-form__grid">
          <label>
            <span>Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as RecurringContributionOccurrence["status"])}>
              <option value="scheduled">Scheduled</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label>
            <span>Amount</span>
            <input min="0.01" step="0.01" type="number" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          {status === "paid" && (
            <label>
              <span>Paid date</span>
              <input required type="date" value={paidDate} onChange={(event) => setPaidDate(event.target.value)} />
            </label>
          )}
        </div>
        <footer className="recurring-payment-form__actions">
          <button type="button" onClick={requestClose}>
            Cancel
          </button>
          <button type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save contribution"}
          </button>
        </footer>
      </form>
    </div>
  );
}

export default RecurringContributionOccurrenceForm;
