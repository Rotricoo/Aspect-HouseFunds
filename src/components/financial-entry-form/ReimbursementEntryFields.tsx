import type { PaymentSource } from "../../types/payment-source";
import type { Person, PersonId } from "../../types/person-id";
import type { Purchase } from "../../types/purchase";
import type { Reimbursement } from "../../types/reimbursement";

interface ReimbursementEntryFieldsProps {
  purchases: Purchase[];
  paymentSources: PaymentSource[];
  fromPersonId: PersonId;
  toPersonId: PersonId;
  paymentSourceId: string;
  appliesTo: Reimbursement["appliesTo"];
  relatedPurchaseId: string;
  onFromPersonChange: (value: PersonId) => void;
  onToPersonChange: (value: PersonId) => void;
  onPaymentSourceChange: (value: string) => void;
  onAppliesToChange: (value: Reimbursement["appliesTo"]) => void;
  onRelatedPurchaseChange: (value: string) => void;
  people: Person[];
}

export default function ReimbursementEntryFields({
  purchases,
  paymentSources,
  fromPersonId,
  toPersonId,
  paymentSourceId,
  appliesTo,
  relatedPurchaseId,
  onFromPersonChange,
  onToPersonChange,
  onPaymentSourceChange,
  onAppliesToChange,
  onRelatedPurchaseChange,
  people,
}: ReimbursementEntryFieldsProps) {
  const activePeople = people.filter((person) => person.isActive);
  return (
    <>
      <label className="financial-entry-form__field">
        <span>Paid by</span>
        <select value={fromPersonId} onChange={(event) => onFromPersonChange(event.target.value as PersonId)}>
          {activePeople.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </label>
      <label className="financial-entry-form__field">
        <span>Paid to</span>
        <select value={toPersonId} onChange={(event) => onToPersonChange(event.target.value as PersonId)}>
          {activePeople.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </select>
      </label>
      <label className="financial-entry-form__field">
        <span>Paid from</span>
        <select value={paymentSourceId} onChange={(event) => onPaymentSourceChange(event.target.value)}>
          {paymentSources
            .filter((source) => source.ownership === fromPersonId && source.type !== "afterpay")
            .map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
        </select>
      </label>
      <label className="financial-entry-form__field">
        <span>Applies to</span>
        <select value={appliesTo} onChange={(event) => onAppliesToChange(event.target.value as Reimbursement["appliesTo"])}>
          <option value="immediate">Immediate personal advance</option>
          <option value="afterpay">Afterpay commitment</option>
        </select>
      </label>
      <label className="financial-entry-form__field financial-entry-form__field--wide">
        <span>Related purchase (optional)</span>
        <select value={relatedPurchaseId} onChange={(event) => onRelatedPurchaseChange(event.target.value)}>
          <option value="">No specific purchase</option>
          {purchases.map((purchase) => (
            <option key={purchase.id} value={purchase.id}>
              {purchase.merchant} — {purchase.date.toLocaleDateString("en-AU")}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
