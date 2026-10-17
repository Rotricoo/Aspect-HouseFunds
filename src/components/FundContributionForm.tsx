import { useState, type FormEvent } from "react";
import type { FundContribution } from "../types/fund-contribution";
import type { PaymentSource } from "../types/payment-source";
import type { PersonId } from "../types/person-id";
import type { Person } from "../types/person-id";
import { formatDateOnly, parseDateOnly, todayDateOnly } from "../utils/date-only";
import { useUnsavedChanges } from "../hooks/use-unsaved-changes";
import { useDialogFocus } from "../hooks/use-dialog-focus";
import { getSharedSourceLabel } from "../utils/household-labels";

interface FundContributionFormProps {
  onClose: () => void;
  onSubmit: (contribution: FundContribution) => Promise<void>;
  paymentSources: PaymentSource[];
  contribution?: FundContribution;
  people: Person[];
}

function getTodayInputValue(): string {
  return todayDateOnly();
}

function FundContributionForm({ onClose, onSubmit, paymentSources, contribution, people }: FundContributionFormProps) {
  const activePeople = people.filter((person) => person.isActive);
  const householdFundSources = paymentSources.filter((source) => source.ownership === "household" && source.type !== "afterpay");
  const [contributorPersonId, setContributorPersonId] = useState<PersonId>(contribution?.contributorPersonId ?? activePeople[0]?.id ?? "");
  const [fundSourceId, setFundSourceId] = useState(contribution?.fundSourceId ?? householdFundSources[0]?.id ?? "");
  const [amountInput, setAmountInput] = useState(contribution ? String(contribution.amount) : "");
  const [dateInput, setDateInput] = useState(contribution?.date ? formatDateOnly(contribution.date) : getTodayInputValue());
  const [notes, setNotes] = useState(contribution?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useDialogFocus<HTMLElement>();
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const amount = Number(amountInput);
    if (!fundSourceId || !dateInput || !Number.isFinite(amount) || amount <= 0) {
      setError("Choose a destination, date and an amount greater than zero.");
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit({
        id: contribution?.id ?? crypto.randomUUID(),
        date: parseDateOnly(dateInput),
        fundSourceId,
        contributorPersonId,
        amount: Math.round(amount * 100) / 100,
        notes: notes.trim() || null,
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The contribution could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  const requestClose = useUnsavedChanges(hasUnsavedChanges, onClose, isSaving);

  return (
    <section
      ref={dialogRef}
      className="fund-contribution-form"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fund-contribution-form-title"
    >
      <button className="fund-contribution-form__close" onClick={requestClose} type="button" aria-label="Close contribution form">
        <span aria-hidden="true">×</span>
      </button>

      <header className="fund-contribution-form__header">
        <p>Shared money entry</p>
        <h2 id="fund-contribution-form-title">{contribution ? "Edit contribution" : "Record contribution"}</h2>
        <span>Use this when someone adds new personal money to {getSharedSourceLabel(paymentSources)}.</span>
      </header>

      <form className="fund-contribution-form__form" onSubmit={handleSubmit} onChange={() => setHasUnsavedChanges(true)}>
        <label className="fund-contribution-form__field">
          <span>Contributed by</span>
          <select value={contributorPersonId} onChange={(event) => setContributorPersonId(event.target.value as PersonId)}>
            {activePeople.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </select>
        </label>

        <label className="fund-contribution-form__field">
          <span>Destination fund</span>
          <select value={fundSourceId} onChange={(event) => setFundSourceId(event.target.value)} required>
            {householdFundSources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </label>

        <label className="fund-contribution-form__field">
          <span>Amount</span>
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

        <label className="fund-contribution-form__field">
          <span>Date</span>
          <input type="date" value={dateInput} onChange={(event) => setDateInput(event.target.value)} required />
        </label>

        <label className="fund-contribution-form__field fund-contribution-form__field--wide">
          <span>Notes</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Example: Weekly rent contribution deposited into the house account"
          />
        </label>

        <aside className="fund-contribution-form__explanation">
          <strong>This creates new shared money.</strong>
          <span>
            Moving money that is already inside the household is a transfer. Paying a pay-later instalment uses a separate payment flow.
          </span>
        </aside>

        {error && <p className="fund-contribution-form__error">{error}</p>}

        <div className="fund-contribution-form__actions">
          <button className="fund-contribution-form__cancel" onClick={requestClose} type="button" disabled={isSaving}>
            Cancel
          </button>
          <button className="fund-contribution-form__submit" type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : "Record contribution"}
          </button>
        </div>
      </form>
    </section>
  );
}

export default FundContributionForm;
