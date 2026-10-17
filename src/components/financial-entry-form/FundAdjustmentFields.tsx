import type { FundAdjustment } from "../../types/fund-adjustment";
import type { PaymentSource } from "../../types/payment-source";
import type { Person, PersonId } from "../../types/person-id";

interface FundAdjustmentFieldsProps {
  entryType: "balance-check" | "adjustment";
  householdSources: PaymentSource[];
  fundSourceId: string;
  adjustmentDirection: FundAdjustment["direction"];
  adjustmentReason: FundAdjustment["reason"];
  adjustmentAllocationKind: FundAdjustment["allocationKind"];
  adjustmentSplitPersonIds: PersonId[];
  onFundSourceChange: (value: string) => void;
  onDirectionChange: (value: FundAdjustment["direction"]) => void;
  onReasonChange: (value: FundAdjustment["reason"]) => void;
  onAllocationKindChange: (value: FundAdjustment["allocationKind"]) => void;
  onSplitToggle: (personId: PersonId) => void;
  people: Person[];
}

export default function FundAdjustmentFields({
  entryType,
  householdSources,
  fundSourceId,
  adjustmentDirection,
  adjustmentReason,
  adjustmentAllocationKind,
  adjustmentSplitPersonIds,
  onFundSourceChange,
  onDirectionChange,
  onReasonChange,
  onAllocationKindChange,
  onSplitToggle,
  people,
}: FundAdjustmentFieldsProps) {
  return (
    <>
      <label className="financial-entry-form__field financial-entry-form__field--wide">
        <span>Household fund</span>
        <select value={fundSourceId} onChange={(event) => onFundSourceChange(event.target.value)}>
          {householdSources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>
      </label>

      {entryType === "adjustment" && (
        <>
          <label className="financial-entry-form__field">
            <span>Direction</span>
            <select value={adjustmentDirection} onChange={(event) => onDirectionChange(event.target.value as FundAdjustment["direction"])}>
              <option value="increase">Increase balance</option>
              <option value="decrease">Decrease balance</option>
            </select>
          </label>
          <label className="financial-entry-form__field">
            <span>Reason</span>
            <select value={adjustmentReason} onChange={(event) => onReasonChange(event.target.value as FundAdjustment["reason"])}>
              <option value="cash-count-correction">Cash count correction</option>
              <option value="cash-found">Cash found</option>
              <option value="cash-lost">Cash lost</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="financial-entry-form__field financial-entry-form__field--wide">
            <span>Financial effect</span>
            <select
              value={adjustmentAllocationKind}
              onChange={(event) => onAllocationKindChange(event.target.value as FundAdjustment["allocationKind"])}
            >
              <option value="balance-only">Balance correction only — does not change who owes whom</option>
              <option value="household-expense">Household expense without receipt — allocate responsibility</option>
            </select>
          </label>
          {adjustmentAllocationKind === "household-expense" && (
            <fieldset className="financial-entry-form__people">
              <legend>Split expense between</legend>
              {people
                .filter((person) => person.isActive)
                .map((person) => (
                  <label key={person.id}>
                    <input
                      type="checkbox"
                      checked={adjustmentSplitPersonIds.includes(person.id)}
                      onChange={() => onSplitToggle(person.id)}
                    />
                    {person.name}
                  </label>
                ))}
            </fieldset>
          )}
        </>
      )}
    </>
  );
}
