import { useState, type FormEvent } from "react";
import type { PaymentSource } from "../types/payment-source";
import type { Person, PersonId } from "../types/person-id";
import type { RecurringBillFrequency, RecurringContributionPlan } from "../types/recurring-bill";
import { formatDateOnly, parseDateOnly, todayDateOnly } from "../utils/date-only";
import { useDialogFocus } from "../hooks/use-dialog-focus";
import { useUnsavedChanges } from "../hooks/use-unsaved-changes";

interface Props {
  plan?: RecurringContributionPlan;
  paymentSources: PaymentSource[];
  onSave: (plan: RecurringContributionPlan, effectiveFrom: Date) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
  people: Person[];
}

export default function RecurringContributionPlanForm({ plan, paymentSources, onSave, onDelete, onClose, people }: Props) {
  const activePeople = people.filter((person) => person.isActive);
  const [name, setName] = useState(plan?.name ?? "");
  const [frequency, setFrequency] = useState<RecurringBillFrequency>(plan?.frequency ?? "weekly");
  const [amount, setAmount] = useState(String(plan?.amountPerPerson ?? ""));
  const [members, setMembers] = useState<PersonId[]>(plan?.contributorPersonIds ?? activePeople.map((person) => person.id));
  const [sourceId, setSourceId] = useState(
    plan?.destinationFundSourceId ?? paymentSources.find((source) => source.ownership === "household")?.id ?? "",
  );
  const [startsOn, setStartsOn] = useState(formatDateOnly(plan?.startsOn ?? new Date()));
  const [effectiveFrom, setEffectiveFrom] = useState(todayDateOnly());
  const [isActive, setIsActive] = useState(plan?.isActive ?? true);
  const [notes, setNotes] = useState(plan?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isDirty =
    Boolean(name || amount || notes) &&
    (!plan ||
      name !== plan.name ||
      Number(amount) !== plan.amountPerPerson ||
      frequency !== plan.frequency ||
      sourceId !== plan.destinationFundSourceId ||
      startsOn !== formatDateOnly(plan.startsOn) ||
      isActive !== plan.isActive ||
      notes !== (plan.notes ?? "") ||
      members.join() !== plan.contributorPersonIds.join());
  const dialogRef = useDialogFocus<HTMLFormElement>();
  const requestClose = useUnsavedChanges(isDirty, onClose, isSaving);

  function toggleMember(personId: PersonId) {
    setMembers((current) => (current.includes(personId) ? current.filter((member) => member !== personId) : [...current, personId]));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim() || Number(amount) <= 0 || members.length === 0 || !sourceId) {
      setError("Add a name, positive amount, destination fund and at least one member.");
      return;
    }
    setIsSaving(true);
    try {
      await onSave(
        {
          id: plan?.id ?? crypto.randomUUID(),
          name: name.trim(),
          frequency,
          amountPerPerson: Number(amount),
          contributorPersonIds: members,
          destinationFundSourceId: sourceId,
          startsOn: parseDateOnly(startsOn),
          isActive,
          notes: notes.trim() || null,
        },
        parseDateOnly(effectiveFrom),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The contribution plan could not be saved.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div
      className="recurring-template-form"
      role="presentation"
      onMouseDown={(event) => event.target === event.currentTarget && requestClose()}
    >
      <form className="recurring-template-form__dialog" ref={dialogRef} role="dialog" aria-modal="true" onSubmit={submit}>
        <header className="recurring-template-form__header">
          <div>
            <p>Weekly funding rule</p>
            <h2>{plan ? "Edit contribution plan" : "New contribution plan"}</h2>
          </div>
          <button type="button" aria-label="Close" onClick={requestClose}>
            ×
          </button>
        </header>
        <div className="recurring-template-form__grid">
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Weekly household contribution" />
          </label>
          <label>
            Amount per person
            <input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} />
          </label>
          <label>
            Frequency
            <select value={frequency} onChange={(event) => setFrequency(event.target.value as RecurringBillFrequency)}>
              <option value="weekly">Weekly</option>
              <option value="fortnightly">Fortnightly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
            </select>
          </label>
          <label>
            Starts on
            <input type="date" value={startsOn} onChange={(event) => setStartsOn(event.target.value)} />
          </label>
          <label>
            Destination fund
            <select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
              {paymentSources
                .filter((source) => source.ownership === "household")
                .map((source) => (
                  <option value={source.id} key={source.id}>
                    {source.name}
                  </option>
                ))}
            </select>
          </label>
          <fieldset>
            <legend>Members</legend>
            {activePeople.map((person) => (
              <label key={person.id}>
                <input type="checkbox" checked={members.includes(person.id)} onChange={() => toggleMember(person.id)} /> {person.name}
              </label>
            ))}
          </fieldset>
          <label className="recurring-template-form__wide">
            Notes
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Purpose or agreement behind this contribution"
            />
          </label>
          <label className="recurring-template-form__toggle">
            <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} /> Active plan
          </label>
          {plan && (
            <>
              <label>
                Apply schedule changes from
                <input type="date" value={effectiveFrom} onChange={(event) => setEffectiveFrom(event.target.value)} required />
              </label>
              <p className="recurring-template-form__wide recurring-template-form__notice">
                Future automatic contributions are regenerated from this date. Paid history and manual edits remain unchanged.
              </p>
            </>
          )}
        </div>
        {error && (
          <p className="recurring-template-form__error" role="alert">
            {error}
          </p>
        )}
        <footer className="recurring-template-form__footer">
          {onDelete && (
            <button className="recurring-template-form__delete" type="button" onClick={() => void onDelete()}>
              Delete
            </button>
          )}
          <button type="button" onClick={requestClose}>
            Cancel
          </button>
          <button type="submit" disabled={isSaving}>
            {isSaving ? "Saving…" : "Save plan"}
          </button>
        </footer>
      </form>
    </div>
  );
}
