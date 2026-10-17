import type { PaymentSource } from "../../types/payment-source";

interface TransferEntryFieldsProps {
  householdSources: PaymentSource[];
  fromPaymentSourceId: string;
  toPaymentSourceId: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
}

export default function TransferEntryFields({
  householdSources,
  fromPaymentSourceId,
  toPaymentSourceId,
  onFromChange,
  onToChange,
}: TransferEntryFieldsProps) {
  return (
    <>
      <label className="financial-entry-form__field">
        <span>From fund</span>
        <select value={fromPaymentSourceId} onChange={(event) => onFromChange(event.target.value)}>
          {householdSources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>
      </label>
      <label className="financial-entry-form__field">
        <span>To fund</span>
        <select value={toPaymentSourceId} onChange={(event) => onToChange(event.target.value)}>
          {householdSources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.name}
            </option>
          ))}
        </select>
      </label>
    </>
  );
}
