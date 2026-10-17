import { useState, type FormEvent } from "react";
import type { RecurringBill, RecurringBillOccurrence } from "../types/recurring-bill";
import type { PaymentSource } from "../types/payment-source";
import { formatCurrency, formatDate } from "../utils/formatters";
import {
  chooseAttachments,
  removeStoredAttachments,
  storeAttachments,
  type SelectedAttachment,
  type StoredAttachment,
} from "../services/attachment-service";
import { useUnsavedChanges } from "../hooks/use-unsaved-changes";
import { formatDateOnly, parseDateOnly } from "../utils/date-only";
import { useDialogFocus } from "../hooks/use-dialog-focus";

interface RecurringBillOccurrenceFormProps {
  bill: RecurringBill;
  occurrence: RecurringBillOccurrence;
  onClose: () => void;
  onSave: (occurrence: RecurringBillOccurrence, attachments: StoredAttachment[]) => Promise<void>;
  paymentSources: PaymentSource[];
}

function toDateInputValue(date: Date | null): string {
  return date ? formatDateOnly(date) : "";
}

function RecurringBillOccurrenceForm({ bill, occurrence, onClose, onSave, paymentSources }: RecurringBillOccurrenceFormProps) {
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const dialogRef = useDialogFocus<HTMLElement>();
  const [amount, setAmount] = useState(String(occurrence.amount));
  const [status, setStatus] = useState(occurrence.status);
  const [paidDate, setPaidDate] = useState(toDateInputValue(occurrence.paidDate));
  const [paymentSourceId, setPaymentSourceId] = useState(occurrence.paymentSourceId ?? bill.defaultPaymentSourceId);
  const [notes, setNotes] = useState(occurrence.notes ?? "");
  const [selectedAttachments, setSelectedAttachments] = useState<SelectedAttachment[]>([]);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const paymentIsAlreadyRecorded = occurrence.status === "paid" && Boolean(occurrence.purchaseId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage("Enter an amount greater than zero.");
      return;
    }
    if (status === "paid" && (!paidDate || !paymentSourceId)) {
      setErrorMessage("Paid date and payment source are required when a payment is marked as paid.");
      return;
    }

    setIsSaving(true);
    setErrorMessage("");
    let storedAttachments: StoredAttachment[] = [];
    try {
      storedAttachments = await storeAttachments(selectedAttachments);
      await onSave(
        {
          ...occurrence,
          amount: parsedAmount,
          status,
          paidDate: status === "paid" ? parseDateOnly(paidDate) : null,
          paymentSourceId: status === "paid" ? paymentSourceId : occurrence.paymentSourceId,
          notes: notes.trim() || null,
        },
        storedAttachments,
      );
      onClose();
    } catch (error) {
      await removeStoredAttachments(storedAttachments.map((attachment) => attachment.filePath));
      const errorMessage = error instanceof Error ? error.message : typeof error === "string" ? error : "The payment could not be saved.";
      console.error("Recurring payment could not be saved.", error);
      setErrorMessage(errorMessage);
    } finally {
      setIsSaving(false);
    }
  }

  const requestClose = useUnsavedChanges(hasUnsavedChanges, onClose, isSaving);

  return (
    <div
      className="recurring-payment-form"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && requestClose()}
    >
      <section
        ref={dialogRef}
        className="recurring-payment-form__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recurring-payment-form-title"
      >
        <header className="recurring-payment-form__header">
          <div>
            <p>Recurring payment</p>
            <h3 id="recurring-payment-form-title">{bill.name}</h3>
          </div>
          <button className="recurring-payment-form__close" type="button" onClick={requestClose} aria-label="Close payment form">
            ×
          </button>
        </header>

        <div className="recurring-payment-form__context">
          <span>
            Period{" "}
            <strong>
              {formatDate(occurrence.periodStartDate)} – {formatDate(occurrence.periodEndDate)}
            </strong>
          </span>
          <span>
            Due <strong>{formatDate(occurrence.dueDate)}</strong>
          </span>
          <span>
            Original amount <strong>{formatCurrency(occurrence.amount)}</strong>
          </span>
        </div>

        <form className="recurring-payment-form__fields" onSubmit={handleSubmit} onChange={() => setHasUnsavedChanges(true)}>
          <label>
            <span>Amount</span>
            <input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
          </label>
          <label>
            <span>Status</span>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as RecurringBillOccurrence["status"])}
              disabled={paymentIsAlreadyRecorded}
            >
              <option value="scheduled">Scheduled</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
              <option value="paid">Paid</option>
            </select>
          </label>
          <label>
            <span>Paid date</span>
            <input type="date" value={paidDate} onChange={(event) => setPaidDate(event.target.value)} disabled={status !== "paid"} />
          </label>
          <label>
            <span>Payment source</span>
            <select value={paymentSourceId} onChange={(event) => setPaymentSourceId(event.target.value)} disabled={status !== "paid"}>
              {paymentSources.map((source) => (
                <option value={source.id} key={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </label>
          <label className="recurring-payment-form__wide-field">
            <span>Receipt or proof of payment</span>
            <button
              type="button"
              onClick={async () => {
                try {
                  const chosenAttachments = await chooseAttachments();
                  setSelectedAttachments((current) => [...current, ...chosenAttachments]);
                  if (chosenAttachments.length > 0) setHasUnsavedChanges(true);
                } catch (error) {
                  setErrorMessage(error instanceof Error ? error.message : "The attachment could not be stored.");
                }
              }}
            >
              Choose files
            </button>
            <small>
              {selectedAttachments.length === 0
                ? "No new files selected"
                : selectedAttachments.map((attachment) => attachment.originalFileName).join(", ")}
            </small>
          </label>
          <label className="recurring-payment-form__wide-field">
            <span>Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Add payment details or anything the household should know"
              rows={4}
            />
          </label>

          {paymentIsAlreadyRecorded && (
            <p className="recurring-payment-form__notice">
              This payment already has a linked purchase. Saving will update it instead of creating a duplicate.
            </p>
          )}
          {errorMessage && (
            <p className="recurring-payment-form__error" role="alert">
              {errorMessage}
            </p>
          )}

          <footer className="recurring-payment-form__actions">
            <button type="button" onClick={requestClose} disabled={isSaving}>
              Cancel
            </button>
            {status !== "paid" && !paymentIsAlreadyRecorded && (
              <button
                className="recurring-payment-form__mark-paid"
                type="button"
                onClick={() => {
                  setStatus("paid");
                  if (!paidDate) setPaidDate(toDateInputValue(new Date()));
                }}
              >
                Mark as paid
              </button>
            )}
            <button className="recurring-payment-form__save" type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : "Save changes"}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default RecurringBillOccurrenceForm;
