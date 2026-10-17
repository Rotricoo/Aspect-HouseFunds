import { useState } from "react";
import type { Person } from "../types/person-id";
import type { PaymentSource } from "../types/payment-source";
import type { SettlementGroup } from "../types/settlement-group";
import { useDialogFocus } from "../hooks/use-dialog-focus";

interface Props {
  people: Person[];
  paymentSources: PaymentSource[];
  settlementGroups: SettlementGroup[];
  onSavePerson: (person: Person) => Promise<void>;
  onSaveSource: (source: PaymentSource) => Promise<void>;
  onSaveGroup: (group: SettlementGroup) => Promise<void>;
  onComplete: () => void;
}

const steps = ["Household basics", "Members", "Payment sources", "Settlement groups", "Ready"];

export default function HouseholdOnboarding({
  people,
  paymentSources,
  settlementGroups,
  onSavePerson,
  onSaveSource,
  onSaveGroup,
  onComplete,
}: Props) {
  const dialogRef = useDialogFocus<HTMLDivElement>();
  const [currentStep, setCurrentStep] = useState(1);
  const [memberName, setMemberName] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [groupName, setGroupName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const existingPerson = people.find((person) => person.isActive);
  const resolvedMemberName = existingPerson?.name ?? memberName.trim();
  const resolvedSourceName = sourceName.trim() || paymentSources[0]?.name || "Shared payment source";
  const resolvedGroupName = groupName.trim() || settlementGroups[0]?.name || "Household group";

  function goToStep(step: number) {
    setError(null);
    setCurrentStep(step);
  }

  function handleContinue() {
    if (currentStep === 2 && !existingPerson && !memberName.trim()) {
      setError("Add a member name to continue.");
      return;
    }
    if (currentStep === 3 && !sourceName.trim() && paymentSources.length === 0) {
      setError("Add a payment source name to continue.");
      return;
    }
    if (currentStep === 4 && !groupName.trim() && settlementGroups.length === 0) {
      setError("Add a settlement group name to continue.");
      return;
    }
    goToStep(Math.min(currentStep + 1, steps.length));
  }

  async function handleSubmit() {
    setIsSaving(true);
    setError(null);
    const personId = existingPerson?.id ?? crypto.randomUUID();
    try {
      if (!existingPerson) {
        await onSavePerson({ id: personId, name: resolvedMemberName, weeklyContribution: 0, isActive: true });
      }
      if (paymentSources.length === 0) {
        await onSaveSource({
          id: crypto.randomUUID(),
          name: resolvedSourceName,
          type: "bank-account",
          ownership: "household",
          managedBy: "household",
          openingBalance: null,
        });
      }
      if (settlementGroups.length === 0) {
        await onSaveGroup({ id: crypto.randomUUID(), name: resolvedGroupName, memberPersonIds: [personId] });
      }
      onComplete();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "The household could not be created.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div ref={dialogRef} className="household-onboarding" role="dialog" aria-modal="true" aria-labelledby="household-onboarding-title">
      <div className="household-onboarding__card">
        <p className="household-onboarding__eyebrow">Welcome to Aspect - House Funds</p>
        <h1 id="household-onboarding-title">Set up your household</h1>
        <p>Take a minute to create the starting structure. You can customise everything later.</p>

        <ol className="household-onboarding__progress" aria-label="Onboarding progress">
          {steps.map((step, index) => {
            const stepNumber = index + 1;
            const isComplete = stepNumber < currentStep;
            const isCurrent = stepNumber === currentStep;
            return (
              <li
                key={step}
                className={`household-onboarding__progress-step ${isComplete ? "household-onboarding__progress-step--complete" : ""} ${
                  isCurrent ? "household-onboarding__progress-step--current" : ""
                }`}
                aria-current={isCurrent ? "step" : undefined}
              >
                <span className="household-onboarding__progress-marker">{isComplete ? "✓" : stepNumber}</span>
                <span className="household-onboarding__progress-label">{step}</span>
              </li>
            );
          })}
        </ol>

        {currentStep === 1 && (
          <section className="household-onboarding__step" aria-labelledby="household-onboarding-step-title">
            <p className="household-onboarding__step-kicker">Step 1 of 5</p>
            <h2 id="household-onboarding-step-title">Start with the basics</h2>
            <p>We will guide you through the people, money sources and settlement rules used by your household.</p>
          </section>
        )}

        {currentStep === 2 && (
          <section className="household-onboarding__step" aria-labelledby="household-onboarding-step-title">
            <p className="household-onboarding__step-kicker">Step 2 of 5</p>
            <h2 id="household-onboarding-step-title">Who shares this household?</h2>
            <label>
              <span>First member</span>
              <input
                value={existingPerson?.name ?? memberName}
                onChange={(event) => setMemberName(event.target.value)}
                placeholder="e.g. Alex"
                autoFocus
                disabled={Boolean(existingPerson)}
                aria-describedby={error ? "household-onboarding-error" : undefined}
                aria-invalid={Boolean(error)}
              />
            </label>
            {existingPerson && <p className="household-onboarding__hint">We found an active member and will keep using this person.</p>}
          </section>
        )}

        {currentStep === 3 && (
          <section className="household-onboarding__step" aria-labelledby="household-onboarding-step-title">
            <p className="household-onboarding__step-kicker">Step 3 of 5</p>
            <h2 id="household-onboarding-step-title">Where does shared money come from?</h2>
            <label>
              <span>Payment source</span>
              <input
                value={sourceName}
                onChange={(event) => setSourceName(event.target.value)}
                placeholder="e.g. Shared account"
                autoFocus
                aria-describedby={error ? "household-onboarding-error" : undefined}
                aria-invalid={Boolean(error)}
              />
            </label>
            {paymentSources.length > 0 && (
              <p className="household-onboarding__hint">An existing source is already available. You can manage more sources later.</p>
            )}
          </section>
        )}

        {currentStep === 4 && (
          <section className="household-onboarding__step" aria-labelledby="household-onboarding-step-title">
            <p className="household-onboarding__step-kicker">Step 4 of 5</p>
            <h2 id="household-onboarding-step-title">How should balances be settled?</h2>
            <label>
              <span>Settlement group</span>
              <input
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="e.g. Household"
                autoFocus
                aria-describedby={error ? "household-onboarding-error" : undefined}
                aria-invalid={Boolean(error)}
              />
            </label>
            {settlementGroups.length > 0 && (
              <p className="household-onboarding__hint">An existing group is already available. You can adjust it later.</p>
            )}
          </section>
        )}

        {currentStep === 5 && (
          <section className="household-onboarding__step" aria-labelledby="household-onboarding-step-title">
            <p className="household-onboarding__step-kicker">Step 5 of 5</p>
            <h2 id="household-onboarding-step-title">Review your setup</h2>
            <div className="household-onboarding__summary">
              <div>
                <span>Member</span>
                <strong>{resolvedMemberName}</strong>
              </div>
              <div>
                <span>Payment source</span>
                <strong>{resolvedSourceName}</strong>
              </div>
              <div>
                <span>Settlement group</span>
                <strong>{resolvedGroupName}</strong>
              </div>
            </div>
            <p className="household-onboarding__hint">You can add more members, sources, groups and categories from Household Setup.</p>
          </section>
        )}

        {error && (
          <p id="household-onboarding-error" className="household-onboarding__error" role="alert">
            {error}
          </p>
        )}
        <div className="household-onboarding__actions">
          {currentStep > 1 && (
            <button
              type="button"
              className="household-onboarding__secondary-action"
              onClick={() => goToStep(currentStep - 1)}
              disabled={isSaving}
            >
              Back
            </button>
          )}
          {currentStep < steps.length && (
            <button type="button" onClick={handleContinue}>
              Continue
            </button>
          )}
          {currentStep === steps.length && (
            <button type="button" onClick={() => void handleSubmit()} disabled={isSaving}>
              {isSaving ? "Creating household…" : "Create household"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
