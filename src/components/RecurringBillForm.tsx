import { useState, type FormEvent } from "react";
import { useUnsavedChanges } from "../hooks/use-unsaved-changes";
import type { PaymentSource } from "../types/payment-source";
import type { Person, PersonId } from "../types/person-id";
import type { RecurringBill, RecurringBillFrequency } from "../types/recurring-bill";
import { formatDateOnly, parseDateOnly, todayDateOnly } from "../utils/date-only";
import { useDialogFocus } from "../hooks/use-dialog-focus";

interface Props {
  bill?: RecurringBill;
  paymentSources: PaymentSource[];
  onClose: () => void;
  onSave: (bill: RecurringBill, effectiveFrom: Date) => Promise<void>;
  onDelete?: () => Promise<void>;
  categories?: string[];
  people: Person[];
}

export default function RecurringBillForm({ bill, paymentSources, onClose, onSave, onDelete, categories = [], people }: Props) {
  const activePeople = people.filter((person) => person.isActive);
  const [name, setName] = useState(bill?.name ?? "");
  const [merchant, setMerchant] = useState(bill?.merchant ?? "");
  const [category, setCategory] = useState(bill?.category ?? "Utilities");
  const [frequency, setFrequency] = useState<RecurringBillFrequency>(bill?.frequency ?? "monthly");
  const [amount, setAmount] = useState(bill?.defaultAmount === null || bill?.defaultAmount === undefined ? "" : String(bill.defaultAmount));
  const [sourceId, setSourceId] = useState(bill?.defaultPaymentSourceId ?? paymentSources[0]?.id ?? "");
  const [leadDays, setLeadDays] = useState(String(bill?.preferredPaymentLeadDays ?? 0));
  const [startsOn, setStartsOn] = useState(bill ? formatDateOnly(bill.startsOn) : todayDateOnly());
  const [endsOn, setEndsOn] = useState(bill?.endsOn ? formatDateOnly(bill.endsOn) : "");
  const [effectiveFrom, setEffectiveFrom] = useState(todayDateOnly());
  const [members, setMembers] = useState<PersonId[]>(bill?.splitBetweenPersonIds ?? activePeople.map((person) => person.id));
  const [isActive, setIsActive] = useState(bill?.isActive ?? true);
  const [notes, setNotes] = useState(bill?.notes ?? "");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useDialogFocus<HTMLElement>();
  const requestClose = useUnsavedChanges(isDirty, onClose, isSaving);

  function toggleMember(personId: PersonId) {
    setMembers((current) => (current.includes(personId) ? current.filter((id) => id !== personId) : [...current, personId]));
    setIsDirty(true);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsedAmount = amount === "" ? null : Number(amount);
    if (!name.trim() || !merchant.trim() || !sourceId || members.length === 0 || (parsedAmount !== null && parsedAmount <= 0)) {
      setError("Complete the required fields and choose at least one household member.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onSave(
        {
          id: bill?.id ?? crypto.randomUUID(),
          name: name.trim(),
          merchant: merchant.trim(),
          category: category.trim() || "Utilities",
          frequency,
          defaultAmount: parsedAmount,
          defaultPaymentSourceId: sourceId,
          splitBetweenPersonIds: members,
          preferredPaymentLeadDays: Math.max(0, Number(leadDays) || 0),
          startsOn: parseDateOnly(startsOn),
          endsOn: endsOn ? parseDateOnly(endsOn) : null,
          isActive,
          notes: notes.trim() || null,
        },
        parseDateOnly(effectiveFrom),
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The recurring bill could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="recurring-template-form" role="presentation">
      <section
        ref={dialogRef}
        className="recurring-template-form__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="recurring-template-title"
      >
        <button className="recurring-template-form__close" onClick={requestClose} type="button" aria-label="Close recurring bill form">
          ×
        </button>
        <p>Recurring bill template</p>
        <h2 id="recurring-template-title">{bill ? "Edit recurring bill" : "New recurring bill"}</h2>
        <form className="recurring-template-form__fields" onSubmit={submit} onChange={() => setIsDirty(true)}>
          <label>
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            <span>Merchant</span>
            <input value={merchant} onChange={(e) => setMerchant(e.target.value)} required />
          </label>
          <label>
            <span>Category</span>
            <input list="recurring-category-options" value={category} onChange={(e) => setCategory(e.target.value)} required />
            <datalist id="recurring-category-options">
              {categories.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </label>
          <label>
            <span>Frequency</span>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringBillFrequency)}>
              <option value="weekly">Weekly</option>
              <option value="fortnightly">Fortnightly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
          <label>
            <span>Default amount</span>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Leave blank if variable"
            />
          </label>
          <label>
            <span>Payment source</span>
            <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
              {paymentSources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Starts on</span>
            <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} required />
          </label>
          <label>
            <span>Ends on</span>
            <input type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
          </label>
          <label>
            <span>Pay this many days early</span>
            <input type="number" min="0" value={leadDays} onChange={(e) => setLeadDays(e.target.value)} />
          </label>
          <fieldset>
            <legend>Split between</legend>
            {activePeople.map((person) => (
              <label key={person.id}>
                <input type="checkbox" checked={members.includes(person.id)} onChange={() => toggleMember(person.id)} />
                {person.name}
              </label>
            ))}
          </fieldset>
          <label className="recurring-template-form__wide">
            <span>Notes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          <label className="recurring-template-form__active">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active template
          </label>
          {bill && (
            <>
              <label>
                <span>Apply schedule changes from</span>
                <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} required />
              </label>
              <p className="recurring-template-form__wide recurring-template-form__notice">
                Future automatic payments are regenerated from this date. Paid history and payments edited manually remain unchanged.
              </p>
            </>
          )}
          {error && (
            <p className="recurring-template-form__error" role="alert">
              {error}
            </p>
          )}
          <div className="recurring-template-form__actions">
            {onDelete && (
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm("Delete this template? Templates with payment history must be deactivated instead.")) return;
                  try {
                    await onDelete();
                  } catch (deleteError) {
                    setError(deleteError instanceof Error ? deleteError.message : "The template could not be deleted.");
                  }
                }}
                disabled={isSaving}
              >
                Delete
              </button>
            )}
            <button type="button" onClick={requestClose} disabled={isSaving}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving}>
              {isSaving ? "Saving…" : "Save template"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
