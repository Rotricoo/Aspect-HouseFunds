import type { PaymentSource } from "../../types/payment-source";
import type { Person, PersonId } from "../../types/person-id";
import type { Purchase } from "../../types/purchase";

interface RefundEntryFieldsProps {
  purchases: Purchase[];
  paymentSources: PaymentSource[];
  merchant: string;
  originalPurchaseId: string;
  originalPurchaseItemId: string;
  beneficiaryPersonIds: PersonId[];
  receivedToPaymentSourceId: string;
  onMerchantChange: (value: string) => void;
  onPurchaseChange: (value: string) => void;
  onItemChange: (value: string) => void;
  onRefundSourceChange: (value: string) => void;
  onBeneficiaryToggle: (personId: PersonId) => void;
  people: Person[];
}

export default function RefundEntryFields({
  purchases,
  paymentSources,
  merchant,
  originalPurchaseId,
  originalPurchaseItemId,
  beneficiaryPersonIds,
  receivedToPaymentSourceId,
  onMerchantChange,
  onPurchaseChange,
  onItemChange,
  onRefundSourceChange,
  onBeneficiaryToggle,
  people,
}: RefundEntryFieldsProps) {
  const selectedPurchase = purchases.find((purchase) => purchase.id === originalPurchaseId);

  return (
    <>
      <label className="financial-entry-form__field">
        <span>Merchant</span>
        <input value={merchant} onChange={(event) => onMerchantChange(event.target.value)} required />
      </label>
      <label className="financial-entry-form__field">
        <span>Original purchase</span>
        <select value={originalPurchaseId} onChange={(event) => onPurchaseChange(event.target.value)} required>
          <option value="">Select purchase</option>
          {purchases.map((purchase) => (
            <option key={purchase.id} value={purchase.id}>
              {purchase.merchant} — {purchase.date.toLocaleDateString("en-AU")}
            </option>
          ))}
        </select>
      </label>
      <label className="financial-entry-form__field">
        <span>Original item (optional)</span>
        <select value={originalPurchaseItemId} onChange={(event) => onItemChange(event.target.value)} disabled={!selectedPurchase}>
          <option value="">Whole purchase or not specified</option>
          {selectedPurchase?.items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      <label className="financial-entry-form__field">
        <span>Refund received into</span>
        <select value={receivedToPaymentSourceId} onChange={(event) => onRefundSourceChange(event.target.value)}>
          {paymentSources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="financial-entry-form__people">
        <legend>Refund benefits</legend>
        {people
          .filter((person) => person.isActive)
          .map((person) => (
            <label key={person.id}>
              <input type="checkbox" checked={beneficiaryPersonIds.includes(person.id)} onChange={() => onBeneficiaryToggle(person.id)} />
              {person.name}
            </label>
          ))}
      </fieldset>
    </>
  );
}
